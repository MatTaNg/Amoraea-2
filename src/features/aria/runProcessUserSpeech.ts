import { buildAnthropicMessagesHeaders, getAnthropicEndpoint } from '@features/aria/anthropicClientConfig';
import { CLOSING_LINE_INSTRUCTIONS } from '@features/aria/interviewAssistantReflection';
import {
  getErrorMessage,
  shouldSuppressRecoverableConversationChatError,
} from '@features/aria/interviewUserFacingErrors';
import { INTERVIEWER_SYSTEM } from '@features/aria/interviewerFrameworkPrompt';
import {
  ASSISTANT_SPEECH_POSTPROCESS_NOTICE,
  CLOSING_QUESTION_HANDLING,
  COMMUNICATION_QUESTION_CHECK,
  DISTRESS_HANDLING_INSTRUCTIONS,
  INVALID_SCENARIO_REDIRECT,
  MISUNDERSTANDING_HANDLING_INSTRUCTIONS,
  NO_REPEAT_INSTRUCTIONS,
  OFF_TOPIC_INSTRUCTIONS,
  OPENING_INSTRUCTIONS,
  PAUSE_HANDLING_INSTRUCTIONS,
  PER_REQUEST_REFLECTION_LOCK,
  PERSONAL_DISCLOSURE_TRANSITION,
  PUSHBACK_RESPONSE_INSTRUCTIONS,
  REFLECTION_PARAPHRASE_FIDELITY,
  REPEAT_HANDLING_INSTRUCTIONS,
  SCENARIO_BOUNDARY_INSTRUCTIONS,
  SCENARIO_CLOSING_INSTRUCTIONS,
  SCENARIO_COMPLETE_TOKEN_INSTRUCTIONS,
  SCENARIO_REDIRECT_QUESTIONS,
  SCENARIO_SWITCHING_INSTRUCTIONS,
  SCENARIO_TRANSITION_CLOSING,
  SCORE_REQUEST_INSTRUCTIONS,
  SHORT_AMBIGUOUS_NO_SCENARIO_REPLAY_INSTRUCTIONS,
  SKIP_HANDLING_INSTRUCTIONS,
  THIN_RESPONSE_INSTRUCTIONS,
  UNIVERSAL_ACK_BEFORE_MOVE_INSTRUCTIONS,
} from '@features/aria/interviewPromptInstructions';
import { getCurrentScenario } from '@utilities/storage/InterviewStorage';
import { buildElongatingProbeStateSuffix } from '@features/aria/elongatingProbe';
import { countUserTurnsAfterLastMoment5PrimaryAnchor } from '@features/aria/interviewProgressSync';
import { saveInterviewProgress } from '@features/aria/interviewLocalPersistence';
import { transcriptHasMoment5ResolutionFollowUpAsked } from '@features/aria/moment5ProbeLogic';
import { normalizeProcessUserSpeechTurnInput } from '@features/aria/normalizeProcessUserSpeechTurnInput';
import { prepareClaudeApiMessages } from '@features/aria/prepareClaudeApiMessages';
import type { ProcessUserSpeechDeps, ProcessUserSpeechParams } from '@features/aria/processUserSpeechTypes';
import { isStaleInterviewUserTurn } from '@features/aria/resumeWelcomeTurnProcessingGate';
import { runClaudeParallelStreamTtsCall } from '@features/aria/runClaudeParallelStreamTtsCall';
import { runPostClaudeAssistantTurn } from '@features/aria/runPostClaudeAssistantTurn';
import { runPreClaudeTurnGates } from '@features/aria/runPreClaudeTurnGates';
import { classifyError, withRetry } from '@utilities/withRetry';
import { remoteLog } from '@utilities/remoteLog';
import { CLAUDE_SONNET_MODEL } from '@utilities/anthropicMessagesClient';

export async function runProcessUserSpeech(
  deps: ProcessUserSpeechDeps,
  params: ProcessUserSpeechParams,
): Promise<void> {
  const {
    userId,
    isAdmin,
    status,
    messages,
    setVoiceState,
    setIsWaiting,
    showChatError,
    preClaudeTurnGateDepsRef,
    claudeParallelStreamTtsDepsRef,
    postClaudeTurnDepsRef,
    parallelStreamingTtsRef,
    interviewSessionIdRef,
    moment5PostPromptUserTurnCountRef,
    moment5PrimaryAnchorDeliveredSessionRef,
    moment5ResolutionFollowUpIssuedRef,
    moment5ResolutionDeliveredRef,
    currentInterviewMomentRef,
    scoredScenariosRef,
    scenarioScoresRef,
    resumeActiveScenarioRef,
    interviewUserTurnEpochRef,
  } = deps;
  const { spokenText } = params;
  const turnEpochAtStart = interviewUserTurnEpochRef.current;

    if (!spokenText.trim()) {
      setVoiceState('idle');
      return;
    }
    const normalizedTurn = normalizeProcessUserSpeechTurnInput(deps, spokenText);
    if (!normalizedTurn.continue) {
      return;
    }
    const { trimmed, resumeGatePendingEarly } = normalizedTurn;

    if (isStaleInterviewUserTurn(turnEpochAtStart, interviewUserTurnEpochRef)) {
      void remoteLog('[RESUME_WELCOME] process_user_speech_stale_epoch', {
        interviewSessionId: interviewSessionIdRef.current,
        turnEpochAtStart,
        turnEpochNow: interviewUserTurnEpochRef.current,
      });
      setVoiceState('idle');
      setIsWaiting(false);
      return;
    }

    const preClaudeGateParams: import('@features/aria/preClaudeTurnGateTypes').PreClaudeTurnGateParams = {
      spokenText,
      trimmed,
      resumeGatePendingEarly,
      messagesToUse: [],
      userScenarioTag: 1,
      participantFirstNameForSpoken: '',
      isPersonalOpening: false,
      replyingToScenarioAQ1: false,
      replyingToScenarioBQ1: false,
      replyingToScenarioCQ1: false,
      shouldForceScenarioAContemptProbe: false,
      shouldForceScenarioBFullAppreciationProbe: false,
      shouldForceScenarioBJamesRepairProbe: false,
      shouldForceScenarioCRepairProbe: false,
      shouldForceScenarioCSophiePerspectiveProbe: false,
      shouldForceMoment4ThresholdProbe: false,
      specificEmmaLineAlreadyAddressed: false,
      suppressForcedConstructProbesForMetaFrustration: false,
      scenarioAContemptGateUserText: '',
      sidedEntirelyWithJames: false,
      scenarioBQ1Engaged: false,
      moment5CombinedUserText: '',
      moment4ThresholdHintInAnswer: false,
      metaCommentClassification: null,
      repeatedFrustrationInMoment: false,
      alreadyAnsweredPriorSubstantiveVerified: undefined,
      checkingInFrustrationAdjacent: false,
      maxTok: 380,
      closingInstruction: '',
      progressSuffix: '',
      participantFirstNameSystemSuffix: '',
      elongatingSuppressedForUserTurn: false,
      metaCommentSystemSuffix: '',
      muteParallelTtsForScenarioAContemptProbeStream: false,
      muteParallelTtsForS3ToM4HandoffStream: false,
      allowScenarioARepairAfterContemptAnswer: false,
      lastAssistantContent: '',
      isNameEntryTurn: false,
      frustrationSkipAcceptancePipeline: false,
      frustrationSkipDeclinePipeline: false,
      proactiveScenarioSkipConfirmationInjection: false,
      elongatingProbeStateForApi: false,
      skipContinuationSnap: '',
      hadPriorSubstantiveAnswerForFrustrationOffer: undefined as boolean | undefined,
    };
    const preClaudeGateContinue = await runPreClaudeTurnGates(
      preClaudeTurnGateDepsRef.current,
      preClaudeGateParams,
    );
    if (!preClaudeGateContinue) {
      return;
    }
    let {
      messagesToUse,
      userScenarioTag,
      participantFirstNameForSpoken,
      isPersonalOpening,
      replyingToScenarioAQ1,
      replyingToScenarioBQ1,
      replyingToScenarioCQ1,
      shouldForceScenarioAContemptProbe,
      shouldForceScenarioBFullAppreciationProbe,
      shouldForceScenarioBJamesRepairProbe,
      shouldForceScenarioCRepairProbe,
      shouldForceScenarioCSophiePerspectiveProbe,
      shouldForceMoment4ThresholdProbe,
      specificEmmaLineAlreadyAddressed,
      suppressForcedConstructProbesForMetaFrustration,
      scenarioAContemptGateUserText,
      sidedEntirelyWithJames,
      scenarioBQ1Engaged,
      moment5CombinedUserText,
      moment4ThresholdHintInAnswer,
      metaCommentClassification,
      repeatedFrustrationInMoment,
      alreadyAnsweredPriorSubstantiveVerified,
      checkingInFrustrationAdjacent,
      maxTok,
      closingInstruction,
      progressSuffix,
      participantFirstNameSystemSuffix,
      elongatingSuppressedForUserTurn,
      metaCommentSystemSuffix,
      muteParallelTtsForScenarioAContemptProbeStream,
      muteParallelTtsForS3ToM4HandoffStream,
      allowScenarioARepairAfterContemptAnswer,
      lastAssistantContent,
      elongatingProbeStateForApi,
      skipContinuationSnap,
      hadPriorSubstantiveAnswerForFrustrationOffer,
    } = preClaudeGateParams;

      const requestBody = {
        model: CLAUDE_SONNET_MODEL,
        max_tokens: maxTok,
        system:
          INTERVIEWER_SYSTEM +
          participantFirstNameSystemSuffix +
          OPENING_INSTRUCTIONS +
          SCENARIO_SWITCHING_INSTRUCTIONS +
          SCENARIO_BOUNDARY_INSTRUCTIONS +
          SCENARIO_CLOSING_INSTRUCTIONS +
          CLOSING_QUESTION_HANDLING +
          SCENARIO_TRANSITION_CLOSING +
          REFLECTION_PARAPHRASE_FIDELITY +
          ASSISTANT_SPEECH_POSTPROCESS_NOTICE +
          PERSONAL_DISCLOSURE_TRANSITION +
          SKIP_HANDLING_INSTRUCTIONS +
          SCORE_REQUEST_INSTRUCTIONS +
          OFF_TOPIC_INSTRUCTIONS +
          REPEAT_HANDLING_INSTRUCTIONS +
          THIN_RESPONSE_INSTRUCTIONS +
          SHORT_AMBIGUOUS_NO_SCENARIO_REPLAY_INSTRUCTIONS +
          skipContinuationSnap +
          metaCommentSystemSuffix +
          UNIVERSAL_ACK_BEFORE_MOVE_INSTRUCTIONS +
          NO_REPEAT_INSTRUCTIONS +
          PAUSE_HANDLING_INSTRUCTIONS +
          DISTRESS_HANDLING_INSTRUCTIONS +
          MISUNDERSTANDING_HANDLING_INSTRUCTIONS +
          SCENARIO_REDIRECT_QUESTIONS +
          INVALID_SCENARIO_REDIRECT +
          COMMUNICATION_QUESTION_CHECK +
          PUSHBACK_RESPONSE_INSTRUCTIONS +
          SCENARIO_COMPLETE_TOKEN_INSTRUCTIONS +
          CLOSING_LINE_INSTRUCTIONS +
          closingInstruction +
          progressSuffix +
          buildElongatingProbeStateSuffix(elongatingProbeStateForApi) +
          PER_REQUEST_REFLECTION_LOCK,
        messages: prepareClaudeApiMessages(messagesToUse),
      };
    const apiUrl = getAnthropicEndpoint();
    const headers = buildAnthropicMessagesHeaders({ apiUrl });

    let data: { content?: Array<{ text?: string }>; error?: { message?: string } };
    const textToParallelStream = { full: '', spokenStarted: false, closingSpoken: false };
    const postM5ForStreamBuffer = Math.max(
      moment5PostPromptUserTurnCountRef.current,
      countUserTurnsAfterLastMoment5PrimaryAnchor(
        messagesToUse.map((m) => ({
          role: m.role,
          content: (m as { content?: string }).content ?? '',
          isWelcomeBack: (m as { isWelcomeBack?: boolean }).isWelcomeBack,
        })),
        moment5PrimaryAnchorDeliveredSessionRef.current,
      ),
    );
    const m5ResolutionFollowUpSeen =
      moment5ResolutionDeliveredRef.current ||
      moment5ResolutionFollowUpIssuedRef.current ||
      transcriptHasMoment5ResolutionFollowUpAsked(
        messagesToUse.map((m) => ({
          role: m.role,
          content: (m as { content?: string }).content ?? '',
          isWelcomeBack: (m as { isWelcomeBack?: boolean }).isWelcomeBack,
        })),
      );
    /** After resolution follow-up + user answer (or 2+ post-M5 turns), buffer the full close stream for one deduped TTS. */
    const bufferAllStreamTtsForMoment5Close =
      currentInterviewMomentRef.current === 5 &&
      (postM5ForStreamBuffer >= 2 ||
        (postM5ForStreamBuffer >= 1 && m5ResolutionFollowUpSeen));
    void remoteLog('[M5_CLOSING_BUFFER_GATE]', {
      interviewSessionId: interviewSessionIdRef.current,
      bufferAllStreamTtsForMoment5Close,
      postM5ForStreamBuffer,
      postM5UserTurnsRef: moment5PostPromptUserTurnCountRef.current,
      m5ResolutionFollowUpSeen,
    });
    parallelStreamingTtsRef.current = {
      active: false,
      cancelRequested: false,
      accumulatedFullText: '',
      spokenCompleteText: '',
      s3SophiePerspectiveProbeDeliveredThisStream: false,
    };
    const metaFrustrationFirstSignalBuffered =
      metaCommentClassification?.type === 'frustration' && !repeatedFrustrationInMoment;
    const makeCall = async (): Promise<typeof data> =>
      runClaudeParallelStreamTtsCall(claudeParallelStreamTtsDepsRef.current, {
        apiUrl,
        headers,
        requestBody,
        participantFirstNameForSpoken,
        muteParallelTtsForScenarioAContemptProbeStream,
        muteParallelTtsForS3ToM4HandoffStream,
        metaFrustrationFirstSignalBuffered,
        bufferAllStreamTtsForMoment5Close,
        messagesToUse,
        trimmed,
        elongatingSuppressedForUserTurn,
        specificEmmaLineAlreadyAddressed,
        shouldForceScenarioAContemptProbe,
        allowScenarioARepairAfterContemptAnswer,
        shouldForceScenarioBJamesRepairProbe,
        shouldForceScenarioCRepairProbe,
        shouldForceScenarioCSophiePerspectiveProbe,
        shouldForceMoment4ThresholdProbe,
        userScenarioTag,
        hadPriorSubstantiveAnswerForFrustrationOffer,
        textToParallelStream,
      });

    const numUserMessages = messagesToUse.filter((m) => m.role === 'user').length;
    const isFirstExchange = numUserMessages === 1;
    if (isFirstExchange) {
      await new Promise((r) => setTimeout(r, 500));
    }
    try {
      data = await withRetry(makeCall, {
        retries: 4,
        baseDelay: isFirstExchange ? 3000 : 12000,
        maxDelay: isFirstExchange ? 10000 : 45000,
        context: isFirstExchange ? 'welcome message' : 'conversation',
        onRetry: (attempt) => {
          if (attempt === 1) setVoiceState('processing');
          if (__DEV__) console.log(`[conversation] rate limit retry attempt ${attempt}`);
        },
        onUnrecoverable: () => {
          setIsWaiting(false);
          setVoiceState('idle');
        },
      });
    } catch (err) {
      setIsWaiting(false);
      setVoiceState('idle');
      const errObj = err as Error & { status?: number; retriesExhausted?: boolean; unrecoverable?: boolean };
      const status = errObj.status;
      const type = classifyError(err);
      // NEVER show "trouble connecting" for 429 until ALL retries are exhausted
      if (status === 429 && !errObj.retriesExhausted) return;
      if (type === 'retryable' && !errObj.retriesExhausted) return;
      if (
        shouldSuppressRecoverableConversationChatError(err, {
          turnEpochAtStart,
          turnEpochNow: interviewUserTurnEpochRef.current,
        })
      ) {
        void remoteLog('[conversation] suppressed_recoverable_chat_error', {
          interviewSessionId: interviewSessionIdRef.current,
          message: err instanceof Error ? err.message.slice(0, 160) : String(err).slice(0, 160),
        });
        return;
      }
      const errorMessage = getErrorMessage(err, errObj.retriesExhausted);
      showChatError(errorMessage);
      const completed = Array.from(scoredScenariosRef.current);
      const scenarioScoresPayload: Record<
        number,
        { pillarScores: Record<string, number | null>; pillarConfidence: Record<string, string>; keyEvidence: Record<string, string>; scenarioName?: string }
      > = {};
      [1, 2, 3].forEach((n) => {
        const s = scenarioScoresRef.current[n];
        if (s) scenarioScoresPayload[n] = { pillarScores: s.pillarScores, pillarConfidence: s.pillarConfidence, keyEvidence: s.keyEvidence, scenarioName: s.scenarioName };
      });
      saveInterviewProgress(userId, {
        messages: messagesToUse.filter((m) => !(m as { isWaiting?: boolean }).isWaiting),
        scenariosCompleted: completed,
        scenarioScores: scenarioScoresPayload,
        currentScenario: getCurrentScenario(scoredScenariosRef.current),
        resumeActiveScenario: resumeActiveScenarioRef.current,
      });
      return;
    }

    const postClaudeTurnParams = {
      data,
      messagesToUse,
      textToParallelStream,
      participantFirstNameForSpoken,
      trimmed,
      elongatingSuppressedForUserTurn,
      isPersonalOpening,
      replyingToScenarioAQ1,
      replyingToScenarioBQ1,
      replyingToScenarioCQ1,
      shouldForceScenarioAContemptProbe,
      shouldForceScenarioBFullAppreciationProbe,
      shouldForceScenarioBJamesRepairProbe,
      shouldForceScenarioCRepairProbe,
      shouldForceScenarioCSophiePerspectiveProbe,
      shouldForceMoment4ThresholdProbe,
      specificEmmaLineAlreadyAddressed,
      suppressForcedConstructProbesForMetaFrustration,
      scenarioAContemptGateUserText,
      sidedEntirelyWithJames,
      scenarioBQ1Engaged,
      moment5CombinedUserText,
      moment4ThresholdHintInAnswer,
      userScenarioTag,
      muteParallelTtsForScenarioAContemptProbeStream,
      muteParallelTtsForS3ToM4HandoffStream,
      allowScenarioARepairAfterContemptAnswer,
    };
    try {
      await runPostClaudeAssistantTurn(postClaudeTurnDepsRef.current, postClaudeTurnParams);
      messagesToUse = postClaudeTurnParams.messagesToUse;
    } finally {
      setIsWaiting(false);
    }
}
