import { sanitizeAssistantInterviewerCharacterNames } from '@/constants/interviewCharacterNames';
import { shouldSaveToStorage } from '@features/aria/interviewLocalPersistence';
import {
  dedupeAdjacentBoundaryValidationsBeforeParticipantName,
  ensureSpokenTextIncludesParticipantFirstName,
} from '@features/aria/interviewerFrameworkPrompt';
import { isExplicitPassForMoment4CommitmentFollowUp } from '@features/aria/interviewControlTokens';
import {
  looksLikeMoment4GrudgePrompt,
  shouldAdvanceToMoment5AfterSupportAnswer,
  transcriptIncludesMoment4ThresholdAssistant,
} from '@features/aria/moment4ProbeLogic';
import {
  looksLikeMoment4SpecificityFollowUpEcho,
  resolveMoment4GrudgeAnswerForThresholdReflection,
} from '@features/aria/moment4SpecificityFollowUp';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { buildMoment4ThresholdAnswerToMoment5Bundle } from '@features/aria/interviewTransitionBundles';
import {
  extractLeadingReflectionFromMoment5HandoffBundle,
  registerDeliveredReflection,
} from '@features/aria/deliveredReflectionRegistry';
import { resolveLastUserAnswerForInterviewMoment } from '@features/aria/narrativeTurnIndexing';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
} from '@features/aria/probeAndScoringUtils';
import {
  isResumeWelcomeFlowBlockingTurnProcessing,
  isStaleInterviewUserTurn,
} from '@features/aria/resumeWelcomeTurnProcessingGate';
import { commitDedupedAssistantTranscriptTurn } from '@features/aria/interviewTranscriptDedup';
import { triggerLiveMoment4ScoringOnM5Entry } from '@features/aria/liveMoment4ScoringOnM5Entry';
import { remoteLog } from '@utilities/remoteLog';
import {
  getCurrentScenario,
  loadInterviewFromStorage,
  mergeInterviewStoragePayload,
  saveInterviewToStorage,
} from '@utilities/storage/InterviewStorage';

export type DeliverMoment5ConflictProbeResult = {
  delivered: boolean;
  source?: 'after_m4_threshold' | 'after_m4_grudge_explicit_pass' | 'after_support';
};

/** Shared M5 primary conflict delivery — used by inject gate and orchestrator executor. */
export async function deliverMoment5ConflictProbe(args: {
  deps: PreClaudeTurnGateDeps;
  messagesToUse: MessageWithScenario[];
  participantFirstNameForSpoken: string;
  logTag?: string;
}): Promise<DeliverMoment5ConflictProbeResult> {
  const { deps, messagesToUse, participantFirstNameForSpoken } = args;
  const turnEpochAtInjectStart = deps.interviewUserTurnEpochRef.current;
  if (isResumeWelcomeFlowBlockingTurnProcessing(deps)) {
    return { delivered: false };
  }

  const priorTranscriptBeforeThisUserTurn = messagesToUse.slice(0, -1);
  const moment4ThresholdDeliveredInTranscript =
    deps.moment4ThresholdProbeAskedRef.current ||
    transcriptIncludesMoment4ThresholdAssistant(priorTranscriptBeforeThisUserTurn);
  const priorTranscriptAlreadyHasM5Primary = priorTranscriptBeforeThisUserTurn.some(
    (m) =>
      m.role === 'assistant' &&
      transcriptAssistantContainsMoment5PrimaryConflictQuestion((m as { content?: string }).content ?? ''),
  );
  // Support sits between threshold and M5 — never jump from the threshold answer straight to M5.
  const lastAssistantBeforeUser = [...priorTranscriptBeforeThisUserTurn]
    .reverse()
    .find((m) => m.role === 'assistant');
  const lastAssistantContent = (lastAssistantBeforeUser?.content ?? '').trim();
  const currentUserAnswer = (messagesToUse[messagesToUse.length - 1]?.content ?? '').trim();
  const m5HandoffAfterGrudgeExplicitPass =
    !moment4ThresholdDeliveredInTranscript &&
    isExplicitPassForMoment4CommitmentFollowUp(currentUserAnswer) &&
    (looksLikeMoment4GrudgePrompt(lastAssistantContent) ||
      looksLikeMoment4SpecificityFollowUpEcho(lastAssistantContent));
  const m5HandoffAfterSupportAnswer = shouldAdvanceToMoment5AfterSupportAnswer({
    lastAssistantContent,
    userAnswerText: currentUserAnswer,
  });
  const m5HandoffEligible = m5HandoffAfterGrudgeExplicitPass || m5HandoffAfterSupportAnswer;

  if (
    deps.currentInterviewMomentRef.current < 4 &&
    m5HandoffEligible &&
    !priorTranscriptAlreadyHasM5Primary
  ) {
    deps.currentInterviewMomentRef.current = 4;
    deps.interviewMomentsCompleteRef.current[3] = true;
    deps.personalHandoffInjectedRef.current = true;
    void remoteLog('[M5_INJECT_MOMENT_HEALED_FROM_THRESHOLD_CONTEXT]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
    });
  }

  if (
    !deps.isInterviewAppRoute ||
    deps.isAdmin ||
    deps.status !== 'active' ||
    deps.closingQuestionPending ||
    deps.waitingForClosingAdditionRef.current !== null ||
    deps.currentInterviewMomentRef.current !== 4 ||
    !m5HandoffEligible ||
    deps.moment5QuestionDeliveredRef.current ||
    deps.moment5QuestionDeliveryInFlightRef.current ||
    priorTranscriptAlreadyHasM5Primary ||
    deps.moment4ExpectingPostSpecificityUserTurnRef.current
  ) {
    return { delivered: false };
  }

  void remoteLog(args.logTag ?? '[M5_QUESTION_INJECT]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
  });
  if (isStaleInterviewUserTurn(turnEpochAtInjectStart, deps.interviewUserTurnEpochRef)) {
    return { delivered: false };
  }

  deps.moment5QuestionDeliveryInFlightRef.current = true;
  const lastUserAnswer = m5HandoffAfterGrudgeExplicitPass
    ? resolveMoment4GrudgeAnswerForThresholdReflection(messagesToUse, currentUserAnswer)
    : resolveLastUserAnswerForInterviewMoment(messagesToUse, 4);
  const m5BundleRaw = buildMoment4ThresholdAnswerToMoment5Bundle(
    participantFirstNameForSpoken,
    MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
    lastUserAnswer || null,
    {
      deliveredRegistry: deps.deliveredReflectionRegistryRef.current,
      moment4Transcript: messagesToUse,
    },
  );
  const m5BundleDisplay = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
    sanitizeAssistantInterviewerCharacterNames(m5BundleRaw),
    participantFirstNameForSpoken,
  );
  const m5BundleSpoken = ensureSpokenTextIncludesParticipantFirstName(
    m5BundleDisplay,
    participantFirstNameForSpoken,
    { allowAppendWhenMissing: true },
  );

  if (
    isStaleInterviewUserTurn(turnEpochAtInjectStart, deps.interviewUserTurnEpochRef) ||
    isResumeWelcomeFlowBlockingTurnProcessing(deps)
  ) {
    deps.moment5QuestionDeliveryInFlightRef.current = false;
    return { delivered: false };
  }

  deps.moment4ThresholdProbeAskedRef.current =
    deps.moment4ThresholdProbeAskedRef.current || moment4ThresholdDeliveredInTranscript;
  deps.currentInterviewMomentRef.current = 5;
  deps.moment5QuestionDeliveredRef.current = true;
  deps.moment5PrimaryAnchorDeliveredSessionRef.current = true;
  const scenarioNumber = ((deps.currentScenarioRef.current as 1 | 2 | 3 | undefined) ?? 3) as 1 | 2 | 3;
  const liveTranscript = (deps.currentMessagesRef.current.length > 0
    ? deps.currentMessagesRef.current
    : messagesToUse) as MessageWithScenario[];
  const injectedMessages = commitDedupedAssistantTranscriptTurn(
    liveTranscript,
    messagesToUse,
    m5BundleSpoken,
    { scenarioNumber, interviewMoment: 5 },
    (next) => deps.setMessages(next),
  );

  if (deps.userId && !deps.isAdmin && deps.status === 'active') {
    const persistedMsgs = injectedMessages.filter(
      (m) => !(m as { isScoreCard?: boolean }).isScoreCard && !(m as { isWelcomeBack?: boolean }).isWelcomeBack,
    );
    const completed = Array.from(deps.scoredScenariosRef.current);
    const scenarioScoresPayload: Record<
      number,
      {
        pillarScores: Record<string, number | null>;
        pillarConfidence: Record<string, string>;
        keyEvidence: Record<string, string>;
        scenarioName?: string;
      }
    > = {};
    [1, 2, 3].forEach((n) => {
      const s = deps.scenarioScoresRef.current[n] as
        | {
            pillarScores: Record<string, number | null>;
            pillarConfidence: Record<string, string>;
            keyEvidence: Record<string, string>;
            scenarioName?: string;
          }
        | undefined;
      if (s) {
        scenarioScoresPayload[n] = {
          pillarScores: s.pillarScores,
          pillarConfidence: s.pillarConfidence,
          keyEvidence: s.keyEvidence,
          scenarioName: s.scenarioName,
        };
      }
    });
    const priorLocal = await loadInterviewFromStorage(deps.userId);
    const merged = mergeInterviewStoragePayload(priorLocal, {
      messages: persistedMsgs,
      scenariosCompleted: completed,
      scenarioScores: { ...(priorLocal?.scenarioScores ?? {}), ...scenarioScoresPayload },
      currentScenario: getCurrentScenario(deps.scoredScenariosRef.current),
      resumeActiveScenario: deps.resumeActiveScenarioRef.current,
      pendingCompletion:
        (priorLocal?.pendingCompletion ?? false) || deps.interviewStatusRef.current === 'preparing_results',
      sessionAttemptId: deps.interviewSessionAttemptIdRef.current ?? priorLocal?.sessionAttemptId,
      attemptNumber: priorLocal?.attemptNumber ?? 1,
      moment_5_clarification_fired: deps.moment5ConflictValidityClarificationIssuedRef.current,
    });
    if (shouldSaveToStorage(merged.messages, merged.scenariosCompleted, merged.currentScenario)) {
      await saveInterviewToStorage(deps.userId, merged);
    }
  }

  const source = m5HandoffAfterGrudgeExplicitPass
    ? ('after_m4_grudge_explicit_pass' as const)
    : m5HandoffAfterSupportAnswer
      ? ('after_support' as const)
      : ('after_m4_threshold' as const);

  try {
    if (
      isStaleInterviewUserTurn(turnEpochAtInjectStart, deps.interviewUserTurnEpochRef) ||
      isResumeWelcomeFlowBlockingTurnProcessing(deps)
    ) {
      deps.moment5QuestionDeliveredRef.current = false;
      deps.moment5PrimaryAnchorDeliveredSessionRef.current = false;
      deps.currentInterviewMomentRef.current = 4;
      deps.setMessages(messagesToUse);
      return { delivered: false };
    }
    await deps.speakTextSafe(m5BundleSpoken, ASSISTANT_INTERVIEW_SPEECH);
    deps.lastQuestionTextRef.current = MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT;
    const deliveredReflection = extractLeadingReflectionFromMoment5HandoffBundle(m5BundleSpoken);
    if (deliveredReflection) {
      registerDeliveredReflection(
        deps.deliveredReflectionRegistryRef,
        'm4_threshold_to_m5',
        deliveredReflection,
        {
          interviewSessionId: deps.interviewSessionIdRef.current,
          source: args.logTag ?? 'deliver_m5_conflict_probe',
        },
      );
    }
  } catch {
    deps.moment5QuestionDeliveredRef.current = false;
    deps.moment5PrimaryAnchorDeliveredSessionRef.current = false;
    deps.currentInterviewMomentRef.current = 4;
    deps.setMessages(messagesToUse);
    return { delivered: false };
  } finally {
    deps.moment5QuestionDeliveryInFlightRef.current = false;
  }

  void remoteLog('[M5_DELIVERED]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    source,
    contentLen: m5BundleSpoken.length,
    preview: m5BundleSpoken.slice(0, 160),
  });
  triggerLiveMoment4ScoringOnM5Entry({
    trigger:
      source === 'after_m4_grudge_explicit_pass'
        ? 'm5_client_inject_after_m4_grudge_explicit_pass'
        : 'm5_client_inject_after_m4_threshold',
    userId: deps.userId,
    isAdmin: deps.isAdmin,
    attemptId: deps.interviewSessionAttemptIdRef.current,
    messages: injectedMessages as MessageWithScenario[],
    deferredMoment4NarrativeRef: deps.deferredMoment4NarrativeRef,
    moment4SpecificityScoringRef: deps.moment4SpecificityScoringRef,
  });
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
  return { delivered: true, source };
}
