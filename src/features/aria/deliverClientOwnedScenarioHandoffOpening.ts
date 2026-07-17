import { sanitizeAssistantInterviewerCharacterNames } from '@/constants/interviewCharacterNames';
import type { ActiveScenario } from '@app/screens/UserInterviewLayout';
import {
  shouldAdvanceScenarioAAfterSatisfiedRepair,
  shouldAdvanceScenarioBAfterSatisfiedRepair,
} from '@features/aria/interviewRepairRefusalDetection';
import { resolveScenarioUserTextForBoundaryReflection } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  SCENARIO_2_OPENING,
  SCENARIO_2_TEXT,
  SCENARIO_3_OPENING,
  SCENARIO_3_TEXT,
} from '@features/aria/interviewScenarioVignetteCopy';
import { splitScenarioTransitionForEmotionModal } from '@features/aria/emotionRecognitionInterview';
import {
  SHOW_SCENARIO_2_VIGNETTE_EXACT,
  SHOW_SCENARIO_3_VIGNETTE_EXACT,
} from '@features/aria/interviewShowScenarioExactCopy';
import { advanceInterviewScenarioRefsAfterCanonicalShowScenarioCard } from '@features/aria/interviewScenarioRefSync';
import {
  buildScenario1To2BundleForInterview,
  buildScenario2To3BundleForInterview,
} from '@features/aria/interviewTransitionBundles';
import { SHOW_SCENARIO_CARD_CANONICAL_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { scenarioBMinimumEngagementForHandoff } from '@features/aria/scenarioBProbeLogic';
import { scenarioAMinimumEngagementForHandoff } from '@features/aria/scenarioFollowUpTranscriptGuard';
import {
  textContainsScenarioBVignetteBody,
  textContainsScenarioCVignetteBody,
} from '@features/aria/scenarioVignetteBodyDetection';
import { remoteLog } from '@utilities/remoteLog';
import { markQuestionDelivered } from '@utilities/sessionLogging';

export type ClientOwnedScenarioHandoffDeps = Pick<
  PreClaudeTurnGateDeps,
  | 'isInterviewAppRoute'
  | 'isAdmin'
  | 'status'
  | 'currentInterviewMomentRef'
  | 'currentScenarioRef'
  | 'resumeActiveScenarioRef'
  | 'interviewMomentsCompleteRef'
  | 'interviewSessionIdRef'
  | 'interviewNameRef'
  | 'lastQuestionTextRef'
  | 'parallelStreamingTtsRef'
  | 'ttsLineInFlightRef'
  | 'ttsUtteranceInFlightRef'
  | 'showScenarioCardCanonicalPlaybackConfirmedKindsRef'
  | 'commitInterviewMessages'
  | 'speakTextSafe'
  | 'setVoiceState'
  | 'setIsWaiting'
  | 'setReferenceCardPrompt'
  | 'setReferenceCardScenario'
  | 'setInterviewUiPhase'
  | 'committedScenarioRef'
  | 'ensureCompletedScenarioScored'
  | 'runEmotionModalAfterScenarioTransition'
  | 'notifyScenarioStarted'
>;

export function transcriptHasCanonicalScenario2Opening(
  messages: ReadonlyArray<{ role: string; content?: string | null }>,
): boolean {
  return messages.some(
    (m) => m.role === 'assistant' && textContainsScenarioBVignetteBody(m.content ?? ''),
  );
}

export function transcriptHasCanonicalScenario3Opening(
  messages: ReadonlyArray<{ role: string; content?: string | null }>,
): boolean {
  return messages.some(
    (m) =>
      m.role === 'assistant' &&
      (textContainsScenarioCVignetteBody(m.content ?? '') ||
        /sophie and daniel have had the same argument/i.test(m.content ?? '')),
  );
}

export function shouldDeliverClientOwnedScenario2Opening(
  deps: Pick<
    ClientOwnedScenarioHandoffDeps,
    | 'isInterviewAppRoute'
    | 'isAdmin'
    | 'status'
    | 'currentScenarioRef'
    | 'currentInterviewMomentRef'
    | 'showScenarioCardCanonicalPlaybackConfirmedKindsRef'
  >,
  messages: MessageWithScenario[],
): boolean {
  if (!deps.isInterviewAppRoute || deps.isAdmin || deps.status !== 'active') return false;
  if ((deps.currentScenarioRef.current ?? 1) !== 1) return false;
  if (deps.currentInterviewMomentRef.current !== 1) return false;
  if (deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current?.situation_2) return false;
  if (transcriptHasCanonicalScenario2Opening(messages)) return false;
  if (!scenarioAMinimumEngagementForHandoff(messages)) return false;
  return shouldAdvanceScenarioAAfterSatisfiedRepair(messages, '', 1);
}

export function shouldDeliverClientOwnedScenario3Opening(
  deps: Pick<
    ClientOwnedScenarioHandoffDeps,
    | 'isInterviewAppRoute'
    | 'isAdmin'
    | 'status'
    | 'currentScenarioRef'
    | 'currentInterviewMomentRef'
    | 'showScenarioCardCanonicalPlaybackConfirmedKindsRef'
  >,
  messages: MessageWithScenario[],
): boolean {
  if (!deps.isInterviewAppRoute || deps.isAdmin || deps.status !== 'active') return false;
  if ((deps.currentScenarioRef.current ?? 1) !== 2) return false;
  if (deps.currentInterviewMomentRef.current !== 2) return false;
  if (deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current?.situation_3) return false;
  if (transcriptHasCanonicalScenario3Opening(messages)) return false;
  if (!scenarioBMinimumEngagementForHandoff(messages)) return false;
  return shouldAdvanceScenarioBAfterSatisfiedRepair(messages, '', 2);
}

/**
 * Speak wrap → emotion modal → next vignette (same order as Claude / hard-stop handoffs).
 * Speaking the full bundle first left the modal interrupting Situation 2/3 mid-vignette.
 */
async function speakClientOwnedHandoffBundleWithEmotionModal(
  deps: ClientOwnedScenarioHandoffDeps,
  displayText: string,
  openingQuestion: string,
  kind: 'situation_2' | 'situation_3',
  completedScenario: 1 | 2,
): Promise<boolean> {
  const { beforeModal, afterModal } = splitScenarioTransitionForEmotionModal(displayText);
  const wrapText = beforeModal.trim() || displayText;
  const vignetteText = afterModal.trim();

  if (deps.ttsUtteranceInFlightRef) {
    deps.ttsUtteranceInFlightRef.current = wrapText;
  }
  if (deps.ttsLineInFlightRef) {
    deps.ttsLineInFlightRef.current = true;
  }
  deps.parallelStreamingTtsRef.current.accumulatedFullText = displayText;

  try {
    await deps.speakTextSafe(wrapText, SHOW_SCENARIO_CARD_CANONICAL_SPEECH);
  } catch {
    /* still open modal + continue */
  }

  await deps.runEmotionModalAfterScenarioTransition(completedScenario, {
    transitionText: displayText,
    priorScenario: completedScenario,
    afterBeforeModalPlayback: true,
  });

  const tail = vignetteText || (!beforeModal.trim() ? displayText : '');
  if (tail) {
    if (deps.ttsUtteranceInFlightRef) {
      deps.ttsUtteranceInFlightRef.current = tail;
    }
    deps.lastQuestionTextRef.current = openingQuestion;
    try {
      await deps.speakTextSafe(tail, SHOW_SCENARIO_CARD_CANONICAL_SPEECH);
    } catch {
      /* refs still advance below */
    }
  } else {
    deps.lastQuestionTextRef.current = openingQuestion;
  }

  if (deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef) {
    deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current = {
      ...deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef.current,
      [kind]: true,
    };
  }

  if (deps.ttsUtteranceInFlightRef) {
    deps.ttsUtteranceInFlightRef.current = null;
  }
  if (deps.ttsLineInFlightRef) {
    deps.ttsLineInFlightRef.current = false;
  }
  deps.parallelStreamingTtsRef.current.spokenCompleteText = displayText;
  return true;
}

/**
 * Client-owned Situation 2 open after S1 repair is satisfied — skips Claude for the vignette turn.
 */
export async function deliverClientOwnedScenario2OpeningAfterS1Repair(
  deps: ClientOwnedScenarioHandoffDeps,
  messagesToUse: MessageWithScenario[],
  participantFirstNameForSpoken: string,
): Promise<boolean> {
  if (!shouldDeliverClientOwnedScenario2Opening(deps, messagesToUse)) return false;

  const firstName =
    (deps.interviewNameRef.current ?? '').trim() || participantFirstNameForSpoken.trim() || '';
  const userCorpus = resolveScenarioUserTextForBoundaryReflection(messagesToUse, 1);
  const displayText = sanitizeAssistantInterviewerCharacterNames(
    buildScenario1To2BundleForInterview(firstName, SCENARIO_2_TEXT, userCorpus),
  );

  const aiMsg: MessageWithScenario = {
    role: 'assistant',
    content: displayText,
    scenarioNumber: 2,
    interviewMoment: 2,
  };
  const updatedMessages = [...messagesToUse, aiMsg];
  deps.commitInterviewMessages(updatedMessages);

  void remoteLog('[CLIENT_OWNED_SCENARIO_2_OPEN]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    preview: displayText.slice(0, 220),
  });

  await speakClientOwnedHandoffBundleWithEmotionModal(
    deps,
    displayText,
    SCENARIO_2_OPENING,
    'situation_2',
    1,
  );

  advanceInterviewScenarioRefsAfterCanonicalShowScenarioCard(
    {
      currentScenarioRef: deps.currentScenarioRef,
      currentInterviewMomentRef: deps.currentInterviewMomentRef,
      interviewMomentsCompleteRef: deps.interviewMomentsCompleteRef,
      resumeActiveScenarioRef: deps.resumeActiveScenarioRef,
      interviewSessionIdRef: deps.interviewSessionIdRef,
    },
    'situation_2',
  );

  deps.ensureCompletedScenarioScored(1, updatedMessages, 'client_owned_scenario_2_open');

  const s2Scenario: ActiveScenario = {
    label: 'Situation 2',
    text: SHOW_SCENARIO_2_VIGNETTE_EXACT,
  };
  deps.setReferenceCardScenario?.(s2Scenario);
  if (deps.committedScenarioRef) {
    deps.committedScenarioRef.current = s2Scenario;
  }
  deps.setReferenceCardPrompt?.(SCENARIO_2_OPENING);
  deps.setInterviewUiPhase?.('scenario_active');
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
  markQuestionDelivered(new Date().toISOString());

  await deps.notifyScenarioStarted?.(2, updatedMessages);
  return true;
}

/**
 * Client-owned Situation 3 open after S2 repair is satisfied — skips Claude for the vignette turn.
 */
export async function deliverClientOwnedScenario3OpeningAfterS2Repair(
  deps: ClientOwnedScenarioHandoffDeps,
  messagesToUse: MessageWithScenario[],
  participantFirstNameForSpoken: string,
): Promise<boolean> {
  if (!shouldDeliverClientOwnedScenario3Opening(deps, messagesToUse)) return false;

  const firstName =
    (deps.interviewNameRef.current ?? '').trim() || participantFirstNameForSpoken.trim() || '';
  const userCorpus = resolveScenarioUserTextForBoundaryReflection(messagesToUse, 2);
  const displayText = sanitizeAssistantInterviewerCharacterNames(
    buildScenario2To3BundleForInterview(firstName, SCENARIO_3_TEXT, userCorpus),
  );

  const aiMsg: MessageWithScenario = {
    role: 'assistant',
    content: displayText,
    scenarioNumber: 3,
    interviewMoment: 3,
  };
  const updatedMessages = [...messagesToUse, aiMsg];
  deps.commitInterviewMessages(updatedMessages);

  void remoteLog('[CLIENT_OWNED_SCENARIO_3_OPEN]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    preview: displayText.slice(0, 220),
  });

  await speakClientOwnedHandoffBundleWithEmotionModal(
    deps,
    displayText,
    SCENARIO_3_OPENING,
    'situation_3',
    2,
  );

  advanceInterviewScenarioRefsAfterCanonicalShowScenarioCard(
    {
      currentScenarioRef: deps.currentScenarioRef,
      currentInterviewMomentRef: deps.currentInterviewMomentRef,
      interviewMomentsCompleteRef: deps.interviewMomentsCompleteRef,
      resumeActiveScenarioRef: deps.resumeActiveScenarioRef,
      interviewSessionIdRef: deps.interviewSessionIdRef,
    },
    'situation_3',
  );

  deps.ensureCompletedScenarioScored(2, updatedMessages, 'client_owned_scenario_3_open');

  const s3Scenario: ActiveScenario = {
    label: 'Situation 3',
    text: SHOW_SCENARIO_3_VIGNETTE_EXACT,
  };
  deps.setReferenceCardScenario?.(s3Scenario);
  if (deps.committedScenarioRef) {
    deps.committedScenarioRef.current = s3Scenario;
  }
  deps.setReferenceCardPrompt?.(SCENARIO_3_OPENING);
  deps.setInterviewUiPhase?.('scenario_active');
  deps.setVoiceState('idle');
  deps.setIsWaiting(false);
  markQuestionDelivered(new Date().toISOString());

  await deps.notifyScenarioStarted?.(3, updatedMessages);
  return true;
}
