import { assistantTextLooksLikeMoment4HandoffLead } from './interviewTransitionBundles';
import {
  textContainsScenarioBVignetteBody,
  textContainsScenarioCVignetteBody,
} from './scenarioVignetteBodyDetection';

export { textContainsScenarioBVignetteBody, textContainsScenarioCVignetteBody } from './scenarioVignetteBodyDetection';

/**
 * Models sometimes emit `[SCENARIO_COMPLETE:2]` when finishing Situation 1 (body introduces Sarah/James).
 * That would show the Scenario 2 emotion item at the start of Situation 2 instead of after it completes.
 */
export function reconcileCompletedScenarioForEmotionModal(params: {
  declaredComplete: 1 | 2 | 3;
  transitionText: string;
  priorScenario?: 1 | 2 | 3 | null;
}): 1 | 2 | 3 {
  const { declaredComplete, transitionText, priorScenario = null } = params;
  const hasS2 = textContainsScenarioBVignetteBody(transitionText);
  const hasS3 = textContainsScenarioCVignetteBody(transitionText);
  const hasM4 = assistantTextLooksLikeMoment4HandoffLead(transitionText);

  if (declaredComplete === 2 && hasS2 && !hasS3 && !hasM4) {
    return 1;
  }
  if (declaredComplete === 3 && hasS3 && !hasM4 && !hasS2) {
    return 2;
  }
  if (declaredComplete === 2 && hasM4 && !hasS3) {
    return 3;
  }

  if (priorScenario === 1 && hasS2 && !hasS3) return 1;
  if (priorScenario === 2 && hasS3 && !hasM4) return 2;
  if (priorScenario === 3 && hasM4) return 3;

  return declaredComplete;
}

/**
 * Transition copy usually introduces the *next* segment (S2/S3 vignette or M4 handoff).
 * The emotion modal is for the segment that just ended — infer from body before token/reconcile.
 */
type TranscriptScenarioMessage = {
  role: string;
  scenarioNumber?: number;
};

/** `currentScenarioRef` can lag transcript tags after deferred handoffs — infer from user turns. */
export function resolveEffectiveActiveScenarioFromTranscript(
  currentScenario: number | null | undefined,
  interviewMoment: number,
  messages: ReadonlyArray<TranscriptScenarioMessage>,
): 1 | 2 | 3 {
  const refScenario =
    currentScenario === 1 || currentScenario === 2 || currentScenario === 3
      ? currentScenario
      : interviewMoment >= 1 && interviewMoment <= 3
        ? (interviewMoment as 1 | 2 | 3)
        : 1;
  let maxScenario: 1 | 2 | 3 = refScenario;
  for (const m of messages) {
    const sn = m.scenarioNumber;
    if (sn === 1 || sn === 2 || sn === 3) {
      maxScenario = Math.max(maxScenario, sn) as 1 | 2 | 3;
    }
  }
  return maxScenario;
}

/** Prior scenario for emotion modal / scoring when refs lag behind bundled S2→S3 handoffs. */
export function resolveHandoffPriorScenario(
  currentScenario: number | null | undefined,
  interviewMoment: number,
  messages: ReadonlyArray<TranscriptScenarioMessage>,
  transitionText: string,
): 1 | 2 | 3 {
  const active = resolveEffectiveActiveScenarioFromTranscript(
    currentScenario,
    interviewMoment,
    messages,
  );
  if (textContainsScenarioCVignetteBody(transitionText)) {
    return Math.max(active, 2) as 1 | 2 | 3;
  }
  if (textContainsScenarioBVignetteBody(transitionText)) {
    return Math.max(active, 1) as 1 | 2 | 3;
  }
  return active;
}

export function completedScenarioForEmotionModalFromTransition(params: {
  declaredComplete: 1 | 2 | 3;
  transitionText: string;
  priorScenario?: 1 | 2 | 3 | null;
}): 1 | 2 | 3 {
  const { transitionText } = params;
  const hasS2 = textContainsScenarioBVignetteBody(transitionText);
  const hasS3 = textContainsScenarioCVignetteBody(transitionText);
  const hasM4 = assistantTextLooksLikeMoment4HandoffLead(transitionText);

  if (hasM4) return 3;
  if (hasS3) return 2;
  if (hasS2) return 1;

  return reconcileCompletedScenarioForEmotionModal(params);
}
