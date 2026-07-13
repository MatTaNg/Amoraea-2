import { sanitizeAssistantInterviewerCharacterNames } from '@/constants/interviewCharacterNames';
import { buildClientScenarioBoundaryHandoffBundle } from '@features/aria/interviewTransitionBundles';
import { MOMENT_4_PERSONAL_CARD } from '@features/aria/interviewMomentScenarioConfig';
import { buildPostClaudeProgressRefsPayload } from '@features/aria/buildPostClaudeProgressRefsPayload';
import { persistInterviewHandoffCheckpoint } from '@features/aria/interviewActivePersistenceTypes';
import { filterPersistableInterviewTranscriptMessages } from '@features/aria/interviewTranscriptPersistenceHelpers';
import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import {
  completedScenarioForEmotionModalFromTransition,
  shouldDeferEmotionModalForTransitionText,
  splitScenarioTransitionForEmotionModal,
} from '@features/aria/emotionRecognitionInterview';
import {
  dedupeAdjacentBoundaryValidationsBeforeParticipantName,
  ensureSpokenTextIncludesParticipantFirstName,
} from '@features/aria/interviewerFrameworkPrompt';
import { resolveScenarioUserTextForBoundaryReflection } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import {
  resolveScenarioANextRequiredFollowUpPrompt,
  scenarioAMinimumEngagementForHandoff,
} from '@features/aria/scenarioFollowUpTranscriptGuard';
import { scenarioBMinimumEngagementForHandoff } from '@features/aria/scenarioBProbeLogic';
import { scenarioCRepairConstructStillPending } from '@features/aria/scenarioCPromptDetection';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';
import { remoteLog } from '@utilities/remoteLog';

function parseScenarioCompleteNumber(text: string): 1 | 2 | 3 | null {
  const scenarioCompleteMatch =
    text.match(/\[SCENARIO_COMPLETE:\s*(\d+)\]/i) ??
    text.match(/\[SCENARIO_COMPLETE:\s*(\d+)\b/i);
  const scenarioCompleteParsed =
    scenarioCompleteMatch != null ? parseInt(scenarioCompleteMatch[1] ?? '', 10) : NaN;
  if (scenarioCompleteParsed >= 1 && scenarioCompleteParsed <= 3) {
    return scenarioCompleteParsed as 1 | 2 | 3;
  }
  return null;
}

/** `[SCENARIO_COMPLETE:N]` token: transition display, emotion modal, scoring, and scenario advance. */
export async function runPostClaudeScenarioCompleteTokenGate(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  text: string,
  speakAssistantTurn: PostClaudeSpeakAssistantTurn,
  parallelStreamingPlaybackUsed = false,
): Promise<{ handled: boolean }> {
  const scenarioNumber = parseScenarioCompleteNumber(text);
  if (scenarioNumber == null) {
    return { handled: false };
  }

  if (scenarioNumber === 3 && scenarioCRepairConstructStillPending(params.messagesToUse)) {
    void remoteLog('[S3_SCENARIO_COMPLETE_DEFERRED_REPAIR_Q2_PENDING]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      preview: text.slice(0, 220),
    });
    return { handled: false };
  }

  if (scenarioNumber === 1 && !scenarioAMinimumEngagementForHandoff(params.messagesToUse)) {
    void remoteLog('[S1_PREMATURE_SCENARIO_COMPLETE_BLOCKED]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      userTurns: params.messagesToUse.filter((m) => m.role === 'user').length,
      preview: text.slice(0, 220),
      nextFollowUpPreview: resolveScenarioANextRequiredFollowUpPrompt(params.messagesToUse).slice(0, 200),
    });
    return { handled: false };
  }

  if (scenarioNumber === 2 && !scenarioBMinimumEngagementForHandoff(params.messagesToUse)) {
    void remoteLog('[S2_PREMATURE_SCENARIO_COMPLETE_BLOCKED]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      userTurns: params.messagesToUse.filter((m) => m.role === 'user').length,
      preview: text.slice(0, 220),
    });
    return { handled: false };
  }

  deps.lastAnsweredClosingScenarioRef.current = null;
  const priorScenarioForEmotionModal =
    deps.currentScenarioRef.current === 1 ||
    deps.currentScenarioRef.current === 2 ||
    deps.currentScenarioRef.current === 3
      ? deps.currentScenarioRef.current
      : null;
  let displayText = buildClientScenarioBoundaryHandoffBundle(
    scenarioNumber,
    params.participantFirstNameForSpoken,
    {
      scenario1: resolveScenarioUserTextForBoundaryReflection(params.messagesToUse, 1),
      scenario2: resolveScenarioUserTextForBoundaryReflection(params.messagesToUse, 2),
      scenario3: resolveScenarioUserTextForBoundaryReflection(params.messagesToUse, 3),
    },
    MOMENT_4_PERSONAL_CARD,
  );
  displayText = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
    sanitizeAssistantInterviewerCharacterNames(displayText),
    params.participantFirstNameForSpoken,
  );
  displayText = ensureSpokenTextIncludesParticipantFirstName(displayText, params.participantFirstNameForSpoken, {
    allowAppendWhenMissing: true,
  });
  const reconciledScenarioNumber = completedScenarioForEmotionModalFromTransition({
    declaredComplete: scenarioNumber,
    transitionText: displayText,
    priorScenario: priorScenarioForEmotionModal,
  });
  if (reconciledScenarioNumber !== scenarioNumber) {
    void remoteLog('[SCENARIO_COMPLETE] reconciled_token_scenario', {
      declared: scenarioNumber,
      reconciled: reconciledScenarioNumber,
      priorScenario: priorScenarioForEmotionModal,
    });
  }
  const scenarioCompleteSplit = splitScenarioTransitionForEmotionModal(displayText);
  const deferScenarioCompleteEmotionModal = shouldDeferEmotionModalForTransitionText(displayText);
  const tokenPathBundledHandoff =
    deferScenarioCompleteEmotionModal && scenarioCompleteSplit.afterModal.trim().length > 0;
  if (!tokenPathBundledHandoff) {
    if (reconciledScenarioNumber === 1) {
      deps.interviewMomentsCompleteRef.current[1] = true;
      deps.currentInterviewMomentRef.current = 2;
    } else if (reconciledScenarioNumber === 2) {
      deps.interviewMomentsCompleteRef.current[2] = true;
      deps.currentInterviewMomentRef.current = 3;
      deps.resetScenarioCClientGatesOnly();
    } else if (reconciledScenarioNumber === 3) {
      deps.interviewMomentsCompleteRef.current[3] = true;
    }
  }
  deps.applyInterviewProgressFromAssistantText(
    tokenPathBundledHandoff ? scenarioCompleteSplit.beforeModal : displayText,
    buildPostClaudeProgressRefsPayload(deps),
  );
  const nextScenarioNum =
    reconciledScenarioNumber < 3 ? ((reconciledScenarioNumber + 1) as 2 | 3) : 3;
  const transitionMsg: PostClaudeInterviewMessage = {
    role: 'assistant',
    content: tokenPathBundledHandoff ? scenarioCompleteSplit.beforeModal : displayText,
    scenarioNumber: tokenPathBundledHandoff
      ? ((priorScenarioForEmotionModal ?? reconciledScenarioNumber) as 1 | 2 | 3)
      : nextScenarioNum,
  };
  if (!tokenPathBundledHandoff) {
    deps.currentScenarioRef.current = nextScenarioNum;
    deps.resumeActiveScenarioRef.current = nextScenarioNum;
  } else {
    /** Persist resume target before emotion modal so refresh mid-transition still lands on the next scenario. */
    deps.resumeActiveScenarioRef.current = nextScenarioNum;
    if (priorScenarioForEmotionModal != null) {
      deps.currentScenarioRef.current = priorScenarioForEmotionModal;
    }
  }
  const updatedMessages = [...params.messagesToUse, transitionMsg];
  deps.setMessages(updatedMessages);
  if (deps.userId && !deps.isAdmin) {
    persistInterviewHandoffCheckpoint(
      {
        userId: deps.userId,
        isAdmin: deps.isAdmin,
        interviewSessionAttemptIdRef: deps.interviewSessionAttemptIdRef,
        scoredScenariosRef: deps.scoredScenariosRef,
        scenarioScoresRef: deps.scenarioScoresRef,
        resumeActiveScenarioRef: deps.resumeActiveScenarioRef,
        saveInterviewProgress: deps.saveInterviewProgress,
        messages: filterPersistableInterviewTranscriptMessages(updatedMessages),
      },
      nextScenarioNum,
    );
  }
  if (!tokenPathBundledHandoff) {
    deps.setHighestScenarioReached((prev) => Math.max(prev, reconciledScenarioNumber));
  }
  const scenarioCompleteSpeakOpts = {
    ...ASSISTANT_INTERVIEW_SPEECH,
    ...(parallelStreamingPlaybackUsed ? { forceSpeakDespiteParallelStream: true } : {}),
  };
  if (parallelStreamingPlaybackUsed) {
  }
  if (tokenPathBundledHandoff) {
    deps.pendingEmotionModalTransitionRef.current = {
      completedScenario: reconciledScenarioNumber,
      afterModal: scenarioCompleteSplit.afterModal,
      transitionText: displayText,
      priorScenario: priorScenarioForEmotionModal,
    };
    await speakAssistantTurn(scenarioCompleteSplit.beforeModal, scenarioCompleteSpeakOpts);
  } else if (deferScenarioCompleteEmotionModal) {
    await speakAssistantTurn(displayText, scenarioCompleteSpeakOpts);
  } else {
    if (!deps.scoredScenariosRef.current.has(reconciledScenarioNumber)) {
      deps.scoredScenariosRef.current.add(reconciledScenarioNumber);
      deps.scoreScenario(reconciledScenarioNumber, updatedMessages);
    }
    await deps.notifyScenarioStarted(nextScenarioNum, updatedMessages);
    await speakAssistantTurn(scenarioCompleteSplit.beforeModal, scenarioCompleteSpeakOpts);
    await deps.runEmotionModalAfterScenarioTransition(reconciledScenarioNumber, {
      transitionText: displayText,
      priorScenario: priorScenarioForEmotionModal,
      afterBeforeModalPlayback: true,
    });
    if (scenarioCompleteSplit.afterModal.trim()) {
      await speakAssistantTurn(scenarioCompleteSplit.afterModal, scenarioCompleteSpeakOpts);
    } else if (__DEV__) {
      console.warn('[Amoraea] emotion modal transition: missing afterModal split');
    }
  }
  if (__DEV__) {
    deps.closingQuestionAskedRef.current[reconciledScenarioNumber] = false;
    deps.closingQuestionAnsweredRef.current[reconciledScenarioNumber] = false;
  }
  deps.setVoiceState('idle');
  return { handled: true };
}
