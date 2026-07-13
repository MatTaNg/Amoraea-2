import {
  updateUserInterviewApplication,
} from '@data/repos/usersInterviewRepo';
import { buildFallbackIntroBriefingText } from '@features/aria/interviewPreambleBriefing';
import {
  capitalizeNameCandidate,
  extractInterviewNameFromResponse,
  looksLikeName,
  stripNameTokenPunctuationForValidation,
} from '@features/aria/interviewNameExtraction';
import {
  INTERVIEW_NAME_AMBIENT_REASK_LINE,
  INTERVIEW_NAME_PROCEDURAL_MISHEAR_LINE,
  INTERVIEW_NAME_REPEAT_REASK_LINE,
  applyInterviewNameWhisperCorrection,
  isInterviewNameProceduralMishear,
  isInterviewNameWhisperEcho,
  isLikelyAmbientSpeech,
  isPlausibleInterviewName,
  resolvePlausibleInterviewFirstName,
} from '@features/aria/interviewNameValidation';
import {
  isNamePromptInterviewMoment,
  looksLikeReadinessAffirmation,
  looksLikeReadinessYesHomophone,
} from '@features/aria/interviewLanguageGate';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import {
  pruneOrphanedPreNameSubstantiveUserTurns,
  shouldPersistNameRetryUserTurnInTranscript,
} from '@features/aria/interviewNameCollectionTranscript';
import { getScenarioNumberForNewMessage } from '@features/aria/scenarioNumberDetection';
import { remoteLog } from '@utilities/remoteLog';
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';

export type PreClaudeTurnNameEntryGateResult = {
  isNameEntryTurn: boolean;
  haltTurn: boolean;
  participantFirstNameForSpoken?: string;
};

function appendNameRetryUserTurn(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
): void {
  if (!shouldPersistNameRetryUserTurnInTranscript(trimmed)) {
    void remoteLog('[NAME_RETRY_SUBSTANTIVE_MISROUTE_OMITTED_FROM_TRANSCRIPT]', {
      preview: trimmed.slice(0, 220),
    });
    return;
  }
  const momentForNameReask = deps.currentInterviewMomentRef.current;
  const scenarioForNameReask =
    ((deps.currentScenarioRef.current as number | undefined) ??
      getScenarioNumberForNewMessage(deps.messages, 'user')) ||
    1;
  const userMsgNameRetry: MessageWithScenario = {
    role: 'user',
    content: trimmed,
    scenarioNumber: scenarioForNameReask as 1 | 2 | 3,
    interviewMoment: momentForNameReask,
  };
  deps.setMessages([...deps.messages, userMsgNameRetry]);
  deps.setCurrentTranscript('');
  deps.transcriptAtReleaseRef.current = '';
}

/** First-turn name capture: extract, re-ask on failure, or confirm and deliver intro briefing. */
export async function runPreClaudeTurnNameEntryGate(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
): Promise<PreClaudeTurnNameEntryGateResult> {
  const lastAssistantCue =
    [...deps.messages].reverse().find((m) => m.role === 'assistant')?.content ?? '';
  const namePromptActive =
    deps.interviewNameReaskPendingRef.current ||
    isNamePromptInterviewMoment(deps.lastQuestionTextRef.current) ||
    isNamePromptInterviewMoment(lastAssistantCue);
  const isNameEntryTurn =
    deps.isInterviewAppRoute && !deps.interviewNameRef.current && namePromptActive;
  if (!isNameEntryTurn) {
    return { isNameEntryTurn: false, haltTurn: false };
  }

  const acceptingAfterReask = deps.interviewNameReaskPendingRef.current;
  const namePromptContext = deps.lastQuestionTextRef.current;
  const whisperCorrectedTrimmed = applyInterviewNameWhisperCorrection(trimmed);
  const extraction = extractInterviewNameFromResponse(whisperCorrectedTrimmed);
  const whisperEchoOfPrompt = isInterviewNameWhisperEcho(trimmed, namePromptContext);
  const proceduralMishearOnNameTurn =
    isInterviewNameProceduralMishear(trimmed) ||
    looksLikeReadinessYesHomophone(trimmed) ||
    looksLikeReadinessAffirmation(trimmed);
  const hasPlausibleExtractedName =
    !!extraction.extractedName &&
    !extraction.isFalseNameTrigger &&
    !whisperEchoOfPrompt &&
    !proceduralMishearOnNameTurn &&
    isPlausibleInterviewName(extraction.extractedName);

  if (isLikelyAmbientSpeech(trimmed, 'what can I call you') && !hasPlausibleExtractedName) {
    console.log('[NameExtraction] likely ambient speech detected:', trimmed, '— prompting again');
    if (!deps.interviewNameReaskUsedRef.current) {
      deps.interviewNameRef.current = null;
      deps.interviewNameReaskPendingRef.current = true;
      deps.interviewNameReaskUsedRef.current = true;
      appendNameRetryUserTurn(deps, trimmed);
      await deps.deliverRecordingRetryLine(INTERVIEW_NAME_AMBIENT_REASK_LINE);
      deps.setIsWaiting(false);
      return { isNameEntryTurn: true, haltTurn: true };
    }
  }

  void remoteLog('interview_name_extracted', {
    raw_response: trimmed,
    whisper_corrected_response: whisperCorrectedTrimmed !== trimmed ? whisperCorrectedTrimmed : null,
    extracted_name: extraction.extractedName || null,
    extraction_method: extraction.extractionMethod,
    false_name_trigger: extraction.isFalseNameTrigger,
    procedural_mishear_on_name_turn: proceduralMishearOnNameTurn,
    whisper_echo_of_prompt: whisperEchoOfPrompt,
    accepting_after_reask: acceptingAfterReask,
    plausible_name: isPlausibleInterviewName(extraction.extractedName),
  });
  if (deps.userId) {
    const rtd = getSessionLogRuntime();
    writeSessionLog({
      userId: deps.userId,
      attemptId: rtd.attemptId,
      eventType: 'interview_name_extracted',
      eventData: {
        raw_response: trimmed,
        extracted_name: extraction.extractedName || null,
        extraction_method: extraction.extractionMethod,
      },
      platform: rtd.platform,
    });
  }

  const transcriptLooksLikeName = looksLikeName(trimmed);
  const implausibleName =
    proceduralMishearOnNameTurn ||
    whisperEchoOfPrompt ||
    !extraction.extractedName ||
    extraction.isFalseNameTrigger ||
    !isPlausibleInterviewName(extraction.extractedName) ||
    (extraction.extractionMethod === 'uncertain' && !transcriptLooksLikeName);

  if (implausibleName) {
    console.warn(
      '[NameExtraction] implausible name extracted:',
      extraction.extractedName,
      acceptingAfterReask ? '— re-asking after prior re-ask' : '— re-asking',
    );
    deps.interviewNameRef.current = null;
    deps.interviewNameReaskPendingRef.current = true;
    if (!deps.interviewNameReaskUsedRef.current) {
      deps.interviewNameReaskUsedRef.current = true;
    }
    const reaskText = proceduralMishearOnNameTurn
      ? INTERVIEW_NAME_PROCEDURAL_MISHEAR_LINE
      : whisperEchoOfPrompt || acceptingAfterReask
        ? INTERVIEW_NAME_REPEAT_REASK_LINE
        : 'Sorry, I want to make sure I got your name right — what should I call you?';
    appendNameRetryUserTurn(deps, trimmed);
    await deps.deliverRecordingRetryLine(reaskText);
    deps.setIsWaiting(false);
    return { isNameEntryTurn: true, haltTurn: true };
  }

  const shortNameReplyCandidate =
    looksLikeName(trimmed) && trimmed.split(/\s+/).filter(Boolean).length <= 2
      ? resolvePlausibleInterviewFirstName(
          capitalizeNameCandidate(
            stripNameTokenPunctuationForValidation(trimmed.split(/\s+/).filter(Boolean)[0] ?? ''),
          ),
        )
      : null;
  const extractedName = resolvePlausibleInterviewFirstName(
    extraction.extractedName || shortNameReplyCandidate,
  );
  const nameTurnConfidence = deps.lastVoiceTurnConfidenceRef.current;
  const whisperNameCorrected = whisperCorrectedTrimmed !== trimmed;
  const directPlausibleExtractedName =
    extraction.extractionMethod === 'direct' &&
    !!extraction.extractedName &&
    isPlausibleInterviewName(extraction.extractedName);
  const lowConfidenceSingleWordName =
    !acceptingAfterReask &&
    !whisperNameCorrected &&
    !directPlausibleExtractedName &&
    !!extractedName &&
    trimmed.split(/\s+/).filter(Boolean).length === 1 &&
    nameTurnConfidence != null &&
    nameTurnConfidence < 0.45;
  if (!extractedName || lowConfidenceSingleWordName) {
    deps.interviewNameRef.current = null;
    deps.interviewNameReaskPendingRef.current = true;
    await deps.deliverRecordingRetryLine(
      acceptingAfterReask ? INTERVIEW_NAME_REPEAT_REASK_LINE : INTERVIEW_NAME_AMBIENT_REASK_LINE,
    );
    deps.setIsWaiting(false);
    return { isNameEntryTurn: true, haltTurn: true };
  }

  console.log('[NameExtraction] name confirmed:', extractedName);
  try {
    deps.interviewNameRef.current = extractedName;
    deps.interviewNameReaskPendingRef.current = false;
    await updateUserInterviewApplication(deps.userId, { name: extractedName });
    deps.invalidateProfileQuery();
  } catch (_) {
    // ignore
  }
  const momentForNameConfirm = deps.currentInterviewMomentRef.current;
  const scenarioForNameConfirm =
    ((deps.currentScenarioRef.current as number | undefined) ??
      getScenarioNumberForNewMessage(deps.messages, 'user')) ||
    1;
  const userMsgNameConfirm: MessageWithScenario = {
    role: 'user',
    content: trimmed,
    scenarioNumber: scenarioForNameConfirm as 1 | 2 | 3,
    interviewMoment: momentForNameConfirm,
  };
  const briefingText = buildFallbackIntroBriefingText(extractedName);
  const briefingMsg: MessageWithScenario = {
    role: 'assistant',
    content: briefingText,
    scenarioNumber: 1,
    interviewMoment: 1,
  };
  const messagesAfterName = [
    ...pruneOrphanedPreNameSubstantiveUserTurns(deps.messages),
    userMsgNameConfirm,
    briefingMsg,
  ];
  deps.setMessages(messagesAfterName);
  deps.currentMessagesRef.current = messagesAfterName;
  deps.setCurrentTranscript('');
  deps.transcriptAtReleaseRef.current = '';
  deps.lastQuestionTextRef.current = briefingText;
  await deps.speakTextSafe(briefingText, ASSISTANT_INTERVIEW_SPEECH);
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
  return {
    isNameEntryTurn: true,
    haltTurn: true,
    participantFirstNameForSpoken: extractedName,
  };
}
