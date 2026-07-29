import {
  INTERVIEW_NAME_AMBIENT_REASK_LINE,
} from '@features/aria/interviewNameValidation';
import {
  NON_ENGLISH_VOICE_PROMPT,
  countSpokenWords,
  computeWhisperRatioReaskState,
  getWhisperReaskTurnContext,
  isNamePromptInterviewMoment,
  isShortAnswerOkForWhisperRatioGate,
  shouldRejectVoiceForNonEnglish,
  WHISPER_RATIO_REASK_MAX_ATTEMPTS_PER_QUESTION,
} from '@features/aria/interviewLanguageGate';
import {
  hasQuestionRecoveryPromptAlreadySpokenForSeq,
  looksLikeCompleteShortUserReply,
} from '@features/aria/interviewAnswerRelevance';
import { resolveMetaCommentForInterviewTurn } from '@features/aria/metaCommentClassification';
import {
  SILENT_BUFFER_RETAKE_PROMPT,
  WHISPER_RATIO_REASK_PROMPT,
  MIN_SPEECH_AFTER_VAD_FOR_WHISPER_MS,
} from '@features/aria/onRecordingCompleteConstants';
import type { RecordingCompleteBufferContext } from '@features/aria/computeRecordingCompleteBufferContext';
import type { OnRecordingCompleteDeps, OnRecordingCompleteParams } from '@features/aria/onRecordingCompleteTypes';
import type { TranscribeSafeResult } from '@features/aria/transcribeSafeTypes';
import { resolvePlausibleInterviewFirstName } from '@features/aria/interviewNameValidation';
import { getWhisperInfraExhaustedUserMessage } from '@features/aria/interviewUserFacingErrors';
import { queueResumeDeferredUserSpeech, flushResumeDeferredUserSpeechWhenUnblocked } from '@features/aria/resumeDeferredUserSpeech';
import { isResumeWelcomeFlowBlockingTurnProcessing } from '@features/aria/resumeWelcomeTurnProcessingGate';
import { getSessionLogRuntime } from '@utilities/sessionLogging';
import {
  incrementReAskCountThisSession,
  markLastAudioSessionEventType,
  setLastWhisperRatioTelemetry,
  writeAudioSessionLog,
} from '@utilities/sessionLogging/audioSessionLogEnvelope';
import { remoteLog } from '@utilities/remoteLog';

export async function applyRecordingCompletePostTranscribeGates(
  deps: OnRecordingCompleteDeps,
  params: OnRecordingCompleteParams,
  ctx: RecordingCompleteBufferContext,
  transcribed: TranscribeSafeResult,
): Promise<boolean> {
  const { blob, nativeUri } = params;
  const { analysis } = ctx;

  if (!transcribed) {
    return false;
  }
  if ('kind' in transcribed && transcribed.kind === 'whisper_infra_exhausted') {
    await deps.deleteTurnAudioFile(nativeUri);
    const emptyTranscriptionLikelySpeech =
      transcribed.failureReason === 'empty_transcription_retryable';
    if (emptyTranscriptionLikelySpeech) {
      const nameTurnPending =
        !deps.interviewNameRef.current &&
        (deps.interviewNameReaskPendingRef.current ||
          isNamePromptInterviewMoment(deps.lastQuestionTextRef.current));
      await deps.deliverRecordingRetryLine(
        nameTurnPending ? INTERVIEW_NAME_AMBIENT_REASK_LINE : SILENT_BUFFER_RETAKE_PROMPT,
      );
      return false;
    }
    const infraMsg = getWhisperInfraExhaustedUserMessage({
      lastHttpStatus: transcribed.lastHttpStatus,
      failureReason: transcribed.failureReason,
    });
    deps.setMessages((prev) => [...prev, { role: 'assistant', content: infraMsg }]);
    deps.setVoiceState('speaking');
    await deps
      .speakTextSafe(infraMsg, {
        telemetrySource: 'turn',
        skipLastQuestionRef: true,
      })
      .catch(() => {});
    deps.setVoiceState('idle');
    return false;
  }

  const { text: userText, language, confidence } = transcribed;
  deps.lastVoiceTurnLanguageRef.current = language;
  deps.lastVoiceTurnConfidenceRef.current = confidence;
  const wc = countSpokenWords(userText);
  const durMs = analysis.audio_duration_ms;
  const speechAfterVadMs =
    analysis.firstSpeechOffsetMs != null &&
    analysis.firstSpeechOffsetMs >= 0 &&
    durMs > 0
      ? Math.max(0, durMs - analysis.firstSpeechOffsetMs)
      : null;
  // Native recordings often lack decoded duration; never treat unknown duration as near-empty
  // when Whisper already returned speech (e.g. name replies like "Matt!").
  const nearEmptyMicCapture =
    durMs > 0 &&
    speechAfterVadMs != null &&
    speechAfterVadMs < MIN_SPEECH_AFTER_VAD_FOR_WHISPER_MS &&
    wc <= 2 &&
    durMs <= 8000;
  if (nearEmptyMicCapture) {
    await deps.deleteTurnAudioFile(nativeUri);
    await deps.deliverRecordingRetryLine(SILENT_BUFFER_RETAKE_PROMPT);
    return false;
  }
  const wps = durMs > 0 ? wc / (durMs / 1000) : 0;
  const lastQuestionText = deps.lastQuestionTextRef.current;
  const lastAssistantCue =
    [...deps.messages].reverse().find((m) => m.role === 'assistant')?.content ?? null;
  const nameCollectionCtx = {
    interviewName: deps.interviewNameRef.current,
    nameReaskPending: deps.interviewNameReaskPendingRef.current,
    lastQuestionText,
    lastAssistantCue,
  };

  const turnContext = getWhisperReaskTurnContext(lastQuestionText, nameCollectionCtx);
  const shortAnswerOk = isShortAnswerOkForWhisperRatioGate(lastQuestionText);
  const ratioFlag = wps < 0.3 || (!shortAnswerOk && wc < 3);
  const ratioReaskState = computeWhisperRatioReaskState({
    turnContext,
    transcriptText: userText,
    wordCount: wc,
    wordsPerSecond: wps,
    shortAnswerOk,
  });
  let willRatioReask = ratioReaskState.shouldFire;
  if (
    willRatioReask &&
    deps.whisperRatioReaskAttemptsForCurrentQuestionRef.current >= WHISPER_RATIO_REASK_MAX_ATTEMPTS_PER_QUESTION
  ) {
    willRatioReask = false;
  }
  if (
    willRatioReask &&
    hasQuestionRecoveryPromptAlreadySpokenForSeq(
      deps.recoveryAssistantSpokenAtSubstantiveSeqRef.current,
      deps.substantiveInterviewQuestionDeliveredSeqRef.current,
    ) &&
    looksLikeCompleteShortUserReply(userText)
  ) {
    willRatioReask = false;
  }
  const priorUserUtteranceCountForWhisperGate = deps.messages.filter(
    (m) => m.role === 'user' && !(m as { isWelcomeBack?: boolean }).isWelcomeBack,
  ).length;
  const suppressMetaClassificationPostMetaAckAwaitingSubstantiveGate =
    deps.metaCommentAckAwaitingSubstantiveBaselineSeqRef.current !== null &&
    deps.substantiveInterviewQuestionDeliveredSeqRef.current ===
      deps.metaCommentAckAwaitingSubstantiveBaselineSeqRef.current;
  const metaResolvedForWhisperGate = resolveMetaCommentForInterviewTurn(userText, {
    lastQuestionText: deps.lastQuestionTextRef.current,
    priorUserUtteranceCount: priorUserUtteranceCountForWhisperGate,
    isInterviewAppRoute: deps.isInterviewAppRoute,
    hasProfileFirstName: !!resolvePlausibleInterviewFirstName(deps.interviewNameRef.current),
    interviewName: deps.interviewNameRef.current,
    nameReaskPending: deps.interviewNameReaskPendingRef.current,
    lastAssistantCue,
    suppressMetaClassificationPostMetaAckAwaitingSubstantive: suppressMetaClassificationPostMetaAckAwaitingSubstantiveGate,
    spokenWordCount: wc,
  });
  if (willRatioReask && metaResolvedForWhisperGate.effective != null) {
    willRatioReask = false;
  }
  setLastWhisperRatioTelemetry(ratioFlag, durMs, wc);
  if (deps.userId) {
    const r = getSessionLogRuntime();
    markLastAudioSessionEventType('whisper_audio_ratio');
    writeAudioSessionLog({
      userId: deps.userId,
      attemptId: r.attemptId,
      eventType: 'whisper_audio_ratio',
      eventData: {
        audio_duration_ms: durMs,
        word_count: wc,
        words_per_second: Math.round(wps * 1000) / 1000,
        ratio_flag: ratioFlag,
        moment_number: deps.currentInterviewMomentRef.current,
      },
      platform: r.platform,
    });
  }
  if (deps.userId && ratioReaskState.logSuppressedReason === 'valid_hard_stop') {
    const r = getSessionLogRuntime();
    writeAudioSessionLog({
      userId: deps.userId,
      attemptId: r.attemptId,
      eventType: 're_ask_suppressed',
      eventData: {
        re_ask_suppressed_reason: 'valid_hard_stop',
        transcript_text: userText,
        word_count: wc,
        words_per_second: Math.round(wps * 1000) / 1000,
        moment_number: deps.currentInterviewMomentRef.current,
        scenario_number: deps.currentScenarioRef.current,
      },
      platform: r.platform,
    });
  }
  if (willRatioReask) {
    deps.whisperRatioReaskAttemptsForCurrentQuestionRef.current += 1;
    if (deps.userId) {
      const r = getSessionLogRuntime();
      const n = incrementReAskCountThisSession();
      markLastAudioSessionEventType('re_ask_fired');
      writeAudioSessionLog({
        userId: deps.userId,
        attemptId: r.attemptId,
        eventType: 're_ask_fired',
        eventData: {
          trigger_reason: 'low_confidence',
          confidence_score: confidence,
          moment_number: deps.currentInterviewMomentRef.current,
          re_ask_count_this_session: n,
        },
        platform: r.platform,
      });
    }
    await deps.deleteTurnAudioFile(nativeUri);
    deps.recoveryAssistantSpokenAtSubstantiveSeqRef.current =
      deps.substantiveInterviewQuestionDeliveredSeqRef.current;
    deps.setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: WHISPER_RATIO_REASK_PROMPT },
    ]);
    deps.setVoiceState('speaking');
    await deps
      .speakTextSafe(WHISPER_RATIO_REASK_PROMPT, {
        telemetrySource: 'turn',
        skipLastQuestionRef: true,
      })
      .catch(() => {});
    deps.setVoiceState('idle');
    return false;
  }
  if (shouldRejectVoiceForNonEnglish(userText, language)) {
    void deps.deleteTurnAudioFile(nativeUri);
    deps.setMessages((prev) => [
      ...prev,
      { role: 'assistant', content: NON_ENGLISH_VOICE_PROMPT },
    ]);
    deps.setVoiceState('speaking');
    await deps.speakTextSafe(NON_ENGLISH_VOICE_PROMPT).catch(() => {});
    deps.setVoiceState('idle');
    return false;
  }
  const turnIndex = deps.turnAudioIndexRef.current;
  deps.turnAudioIndexRef.current += 1;
  const scenarioNumber = deps.currentScenarioRef.current ?? null;
  void deps.processTurnAudioWithRetry({
    audioBlob: blob,
    nativeUri,
    turnIndex,
    scenarioNumber,
  });
  deps.lastUserTurnAudioDurationMsRef.current =
    typeof analysis.audio_duration_ms === 'number' && Number.isFinite(analysis.audio_duration_ms)
      ? analysis.audio_duration_ms
      : null;
  if (
    isResumeWelcomeFlowBlockingTurnProcessing(
      {
        resumeLoadingFlowActiveRef: deps.resumeLoadingFlowActiveRef,
        resumeOfferWelcomeTtsRef: deps.resumeOfferWelcomeTtsRef,
        resumeRepeatChoicePendingRef: deps.resumeRepeatChoicePendingRef,
        interviewSessionAttemptIdRef: deps.interviewSessionAttemptIdRef,
      },
      {
        substantiveTranscript: {
          text: userText,
          wordCount: wc,
          lastQuestionText: deps.lastQuestionTextRef.current,
        },
      },
    )
  ) {
    queueResumeDeferredUserSpeech(userText);
    void remoteLog('[RESUME_WELCOME] post_transcribe_turn_blocked', {
      attemptId: deps.interviewSessionAttemptIdRef.current,
      wordCount: wc,
      resumeLoading: deps.resumeLoadingFlowActiveRef.current,
      welcomeOffered: deps.resumeOfferWelcomeTtsRef.current,
      repeatChoicePending: deps.resumeRepeatChoicePendingRef.current,
      lastQuestionPreview: (deps.lastQuestionTextRef.current ?? '').slice(0, 120),
      transcriptPreview: userText.slice(0, 120),
      deferredForAfterResumePlayback: true,
    });
    void flushResumeDeferredUserSpeechWhenUnblocked({
      processUserSpeech: deps.processUserSpeech,
      resumeLoadingFlowActiveRef: deps.resumeLoadingFlowActiveRef,
      resumeOfferWelcomeTtsRef: deps.resumeOfferWelcomeTtsRef,
      resumeRepeatChoicePendingRef: deps.resumeRepeatChoicePendingRef,
      interviewSessionAttemptIdRef: deps.interviewSessionAttemptIdRef,
    });
    deps.setVoiceState('idle');
    return false;
  }
  deps.processUserSpeech(userText);
  return true;
}
