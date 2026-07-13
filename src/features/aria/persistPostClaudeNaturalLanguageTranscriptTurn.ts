import { detectConstructs } from '@features/aria/interviewConstructAndScoreDisplay';
import { buildPostClaudeProgressRefsPayload } from '@features/aria/buildPostClaudeProgressRefsPayload';
import { persistInterviewHandoffCheckpoint } from '@features/aria/interviewActivePersistenceTypes';
import { filterPersistableInterviewTranscriptMessages } from '@features/aria/interviewTranscriptPersistenceHelpers';
import {
  isNaturalLanguageScenarioHandoffTransition,
  isScenarioThreeToMoment4EmotionModalHandoff,
  hasScenarioBoundaryWrapPhrase,
  resolveNaturalLanguageEmotionModalGate,
  shouldDeferEmotionModalForTransitionText,
  splitScenarioTransitionForEmotionModal,
} from '@features/aria/emotionRecognitionInterview';
import { isClosingQuestion } from '@features/aria/interviewControlTokens';
import { isInterviewPreambleBriefingMoment } from '@features/aria/interviewLanguageGate';
import {
  combinedScenarioCToMoment4Handoff,
  grudgeIntroSignalsMoment4Entry,
} from '@features/aria/interviewProgressSync';
import {
  resolveStagedAssistantPersistContent,
  shouldSkipRedundantAssistantPersist,
  upsertAssistantTranscriptTurn,
  compactInterviewTranscriptTurns,
} from '@features/aria/interviewTranscriptDedup';
import { reconcileMoment5DeliveryFromAssistantText } from '@features/aria/moment5DeliveryReconcile';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';
import { resolveHandoffPriorScenario } from '@features/aria/emotionScenarioTransitionInference';
import { detectScenarioFromResponse } from '@features/aria/scenarioNumberDetection';
import { remoteLog } from '@utilities/remoteLog';
export type PostClaudeNaturalLanguageTranscriptPersistResult = {
  priorScenarioNum: 1 | 2 | 3;
  pendingBundledHandoff: boolean;
  assistantContentToPersist: string;
  scenarioNum: number;
  aiMsg: PostClaudeInterviewMessage;
  s3ToM4HandoffSignals: boolean;
  skipDuplicatePreambleAppend: boolean;
  updatedMessages: PostClaudeInterviewMessage[];
  detectedScenario: number | null;
  emotionSplit: ReturnType<typeof splitScenarioTransitionForEmotionModal>;
  deferEmotionModal: boolean;
  scenarioHandoffTransition: boolean;
  emotionCompletedScenario: 1 | 2 | 3 | null;
  emotionNaturalForward: boolean;
  emotionNaturalS3ToM4: boolean;
  deferBlocked: boolean;
};


/** Keep moment index aligned with active scenario when natural-language handoffs skip `[SCENARIO_COMPLETE]`. */
function syncInterviewMomentFromScenarioContext(
  deps: PostClaudeAssistantTurnDeps,
  priorScenario: 1 | 2 | 3,
  activeScenario: 1 | 2 | 3,
): void {
  if (activeScenario > priorScenario) {
    for (let n = priorScenario; n < activeScenario; n++) {
      if (n === 1 || n === 2 || n === 3) {
        deps.interviewMomentsCompleteRef.current[n] = true;
      }
    }
  }
  if (activeScenario >= 2 && deps.currentInterviewMomentRef.current < activeScenario) {
    deps.currentInterviewMomentRef.current = activeScenario;
  }
}

/** Scenario refs, closing-question state, progress sync, transcript append, and emotion scoring checkpoints. */
export function persistPostClaudeNaturalLanguageTranscriptTurn(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  displayText: string,
  nextText: string,
): PostClaudeNaturalLanguageTranscriptPersistResult {
  const priorScenarioNum = resolveHandoffPriorScenario(
    deps.currentScenarioRef.current,
    deps.currentInterviewMomentRef.current,
    params.messagesToUse,
    displayText,
  );
  const emotionSplitEarly = splitScenarioTransitionForEmotionModal(displayText);
  const deferEmotionModalEarly = shouldDeferEmotionModalForTransitionText(displayText);
  const pendingBundledHandoff =
    deferEmotionModalEarly && emotionSplitEarly.afterModal.trim().length > 0;
  const handoffWithImmediateEmotionModal =
    emotionSplitEarly.afterModal.trim().length > 0 &&
    !deferEmotionModalEarly &&
    (isNaturalLanguageScenarioHandoffTransition(displayText) ||
      isScenarioThreeToMoment4EmotionModalHandoff(displayText));
  const deferScenarioRefAdvanceForEmotionModal =
    pendingBundledHandoff || handoffWithImmediateEmotionModal;
  const detectedScenario = detectScenarioFromResponse(displayText);
  if (!deferScenarioRefAdvanceForEmotionModal && detectedScenario !== null) {
    syncInterviewMomentFromScenarioContext(deps, priorScenarioNum, detectedScenario);
    deps.currentScenarioRef.current = detectedScenario;
    deps.resumeActiveScenarioRef.current = detectedScenario;
  } else if (deferScenarioRefAdvanceForEmotionModal && detectedScenario !== null) {
    deps.resumeActiveScenarioRef.current = detectedScenario;
    if (detectedScenario > priorScenarioNum) {
      const completedScenario = (detectedScenario - 1) as 1 | 2 | 3;
      if (completedScenario === 1 || completedScenario === 2) {
        deps.interviewMomentsCompleteRef.current[completedScenario] = true;
      }
      if (deps.currentInterviewMomentRef.current < detectedScenario) {
        deps.currentInterviewMomentRef.current = detectedScenario;
      }
    }
  } else if (
    !deferScenarioRefAdvanceForEmotionModal &&
    (priorScenarioNum === 1 || priorScenarioNum === 2 || priorScenarioNum === 3)
  ) {
    deps.resumeActiveScenarioRef.current = priorScenarioNum;
  }
  const scenarioNum = deferScenarioRefAdvanceForEmotionModal
    ? priorScenarioNum
    : deps.resolveAssistantScenarioNumber(displayText, params.messagesToUse);
  if (!deferScenarioRefAdvanceForEmotionModal && scenarioNum >= 2 && scenarioNum <= 3) {
    syncInterviewMomentFromScenarioContext(deps, priorScenarioNum, scenarioNum as 1 | 2 | 3);
  }
  const assistantContentToPersist = pendingBundledHandoff
    ? emotionSplitEarly.beforeModal
    : displayText;

  if (isClosingQuestion(displayText)) {
    deps.setClosingQuestionPending(true);
    const scenarioForClosing = (scenarioNum === 1 || scenarioNum === 2 || scenarioNum === 3
      ? scenarioNum
      : 1) as 1 | 2 | 3;
    deps.setClosingQuestionScenario(scenarioForClosing);
    deps.lastClosingQuestionScenarioRef.current = scenarioForClosing;
    deps.closingQuestionAskedRef.current[scenarioForClosing] = true;
    deps.setClosingQuestionState((prev) => ({ ...prev, [scenarioForClosing]: 'asked' }));
  }

  const aiMsg: PostClaudeInterviewMessage = {
    role: 'assistant',
    content: displayText,
    scenarioNumber: scenarioNum,
  };
  deps.lastAnsweredClosingScenarioRef.current = null;

  const s3ToM4HandoffSignals =
    isScenarioThreeToMoment4EmotionModalHandoff(displayText) ||
    combinedScenarioCToMoment4Handoff(displayText) ||
    (deps.currentInterviewMomentRef.current <= 3 && grudgeIntroSignalsMoment4Entry(displayText));
  if (s3ToM4HandoffSignals) {
    deps.ensureCompletedScenarioScored(3, params.messagesToUse, 's3_to_m4_natural_handoff');
    deps.interviewMomentsCompleteRef.current[3] = true;
    deps.currentInterviewMomentRef.current = 4;
  }

  deps.applyInterviewProgressFromAssistantText(displayText, buildPostClaudeProgressRefsPayload(deps));
  reconcileMoment5DeliveryFromAssistantText(deps, displayText);
  const liveTranscriptForAppend = deps.currentMessagesRef.current as PostClaudeInterviewMessage[];
  const skipDuplicatePreambleAppend =
    isInterviewPreambleBriefingMoment(displayText) &&
    liveTranscriptForAppend.some(
      (m) => m.role === 'assistant' && isInterviewPreambleBriefingMoment(m.content ?? ''),
    );
  const transcriptContentToPersist = pendingBundledHandoff
    ? assistantContentToPersist
    : resolveStagedAssistantPersistContent(liveTranscriptForAppend, params.messagesToUse, displayText);
  const skipRedundantAssistantPersist =
    !skipDuplicatePreambleAppend &&
    shouldSkipRedundantAssistantPersist(liveTranscriptForAppend, transcriptContentToPersist);
  const assistantUpsert = skipDuplicatePreambleAppend
    ? { transcript: liveTranscriptForAppend, action: 'skip' as const }
    : upsertAssistantTranscriptTurn(
        liveTranscriptForAppend,
        params.messagesToUse,
        transcriptContentToPersist,
        {
          scenarioNumber: scenarioNum,
          interviewMoment: deps.currentInterviewMomentRef.current,
        },
      );
  const updatedMessages: PostClaudeInterviewMessage[] = compactInterviewTranscriptTurns(
    assistantUpsert.transcript,
  );
  if (skipRedundantAssistantPersist && assistantUpsert.action === 'skip') {
    void remoteLog('[TRANSCRIPT_ASSISTANT_PERSIST_SKIPPED_DEDUP]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      preview: transcriptContentToPersist.slice(0, 200),
    });
  } else if (assistantUpsert.action === 'replace') {
    void remoteLog('[TRANSCRIPT_ASSISTANT_PERSIST_REPLACED_PARAPHRASE]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      preview: transcriptContentToPersist.slice(0, 200),
    });
  }
  deps.commitInterviewMessages(updatedMessages);
  if (detectedScenario !== null && !deferScenarioRefAdvanceForEmotionModal) {
    void deps.notifyScenarioStarted(detectedScenario, updatedMessages);
  }

  const aiDetected = detectConstructs(nextText);
  deps.setTouchedConstructs((prev) => [...new Set([...prev, ...aiDetected])]);

  const emotionSplit = splitScenarioTransitionForEmotionModal(displayText);
  const deferEmotionModal = shouldDeferEmotionModalForTransitionText(displayText);
  const scenarioHandoffTransition = isNaturalLanguageScenarioHandoffTransition(displayText);
  const emotionGate = resolveNaturalLanguageEmotionModalGate({
    displayText,
    priorScenario: priorScenarioNum,
    detectedScenario,
    messages: updatedMessages,
  });
  const emotionCompletedScenario = emotionGate.completedScenario;
  const emotionNaturalForward =
    deps.status === 'active' &&
    deps.isInterviewAppRoute &&
    !deps.isAdmin &&
    emotionGate.emotionNaturalForward &&
    !isClosingQuestion(displayText) &&
    !emotionGate.deferBlocked;
  const emotionNaturalS3ToM4 =
    deps.status === 'active' &&
    deps.isInterviewAppRoute &&
    !deps.isAdmin &&
    s3ToM4HandoffSignals &&
    !deferEmotionModal &&
    !emotionGate.deferBlocked;

  const handoffCheckpointDeps = {
    userId: deps.userId,
    isAdmin: deps.isAdmin,
    interviewSessionAttemptIdRef: deps.interviewSessionAttemptIdRef,
    scoredScenariosRef: deps.scoredScenariosRef,
    scenarioScoresRef: deps.scenarioScoresRef,
    resumeActiveScenarioRef: deps.resumeActiveScenarioRef,
    saveInterviewProgress: deps.saveInterviewProgress,
    messages: filterPersistableInterviewTranscriptMessages(updatedMessages),
  };

  if (
    pendingBundledHandoff &&
    emotionCompletedScenario != null &&
    deps.userId &&
    !deps.isAdmin
  ) {
    const nextScenario =
      emotionCompletedScenario < 3 ? ((emotionCompletedScenario + 1) as 2 | 3) : 3;
    deps.resumeActiveScenarioRef.current = nextScenario;
    persistInterviewHandoffCheckpoint(handoffCheckpointDeps, nextScenario);
    deps.ensureCompletedScenarioScored(
      emotionCompletedScenario,
      updatedMessages,
      'pending_bundled_handoff_checkpoint',
    );
  } else if (
    !deferEmotionModal &&
    emotionNaturalForward &&
    emotionCompletedScenario != null &&
    deps.userId &&
    !deps.isAdmin
  ) {
    deps.ensureCompletedScenarioScored(emotionCompletedScenario, updatedMessages, 'natural_language_handoff');
    const nextScenario =
      emotionCompletedScenario < 3 ? ((emotionCompletedScenario + 1) as 2 | 3) : 3;
    deps.resumeActiveScenarioRef.current = nextScenario;
    persistInterviewHandoffCheckpoint(handoffCheckpointDeps, nextScenario);
  } else if (!pendingBundledHandoff && !deferEmotionModal && emotionNaturalS3ToM4) {
    deps.ensureCompletedScenarioScored(3, updatedMessages, 'natural_language_s3_to_m4');
  }

  return {
    priorScenarioNum,
    pendingBundledHandoff,
    assistantContentToPersist,
    scenarioNum,
    aiMsg,
    s3ToM4HandoffSignals,
    skipDuplicatePreambleAppend,
    updatedMessages,
    detectedScenario,
    emotionSplit,
    deferEmotionModal,
    scenarioHandoffTransition,
    emotionCompletedScenario,
    emotionNaturalForward,
    emotionNaturalS3ToM4,
    deferBlocked: emotionGate.deferBlocked,
  };
}
