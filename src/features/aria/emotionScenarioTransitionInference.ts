import { assistantTextLooksLikeMoment4HandoffLead } from './interviewTransitionBundles';
import { looksLikeMoment4GrudgePrompt } from './moment4ProbeLogic';
import {
  textContainsScenarioBVignetteBody,
  textContainsScenarioCVignetteBody,
} from './scenarioVignetteBodyDetection';

export {
  textContainsScenarioBVignetteBody,
  textContainsScenarioCVignetteBody,
  looksLikeNonCanonicalScenarioCVignetteFiction,
} from './scenarioVignetteBodyDetection';

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
  /**
   * Handoff text is authoritative for which scenario was just completed. Prefer vignette body
   * over live refs — refs may already have advanced from canonical show-scenario playback.
   * Vignette bodies win over M4 teaser phrases in the wrap (e.g. S2→S3 "we'll get personal").
   */
  if (textContainsScenarioCVignetteBody(transitionText)) {
    return 2;
  }
  if (textContainsScenarioBVignetteBody(transitionText)) {
    return 1;
  }
  if (assistantTextLooksLikeMoment4HandoffLead(transitionText)) {
    return 3;
  }
  return active;
}

/** Stream canonical cards may advance refs before post-Claude emotion orchestration runs. */
export function resolveScenarioJustCompletedForPostClaudeEmotionTransition(args: {
  displayText: string;
  priorScenarioNum: 1 | 2 | 3;
  emotionCompletedScenario: 1 | 2 | 3 | null;
  situation3PlaybackConfirmed: boolean;
  situation2PlaybackConfirmed: boolean;
  scenarioCRepairStillPending: boolean;
}): 1 | 2 | 3 {
  const fromText = completedScenarioForEmotionModalFromTransition({
    declaredComplete: args.priorScenarioNum,
    transitionText: args.displayText,
    priorScenario: args.priorScenarioNum,
  });
  if (
    assistantTextLooksLikeMoment4HandoffLead(args.displayText) ||
    looksLikeMoment4GrudgePrompt(args.displayText)
  ) {
    return 3;
  }
  /**
   * Stream-end / canonical S2→S3 handoff may play Situation 3 before post-Claude emotion
   * orchestration while refs or displayText already look like S3 / M4 — emotion item is
   * still for Situation 2 until S3 repair construct is satisfied.
   */
  if (args.situation3PlaybackConfirmed && args.scenarioCRepairStillPending) {
    return 2;
  }
  if (args.emotionCompletedScenario != null) {
    return args.emotionCompletedScenario;
  }
  if (args.situation2PlaybackConfirmed && fromText === 2 && args.priorScenarioNum === 2) {
    return 2;
  }
  return fromText;
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
