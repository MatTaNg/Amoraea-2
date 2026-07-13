import {
  CLIENT_MENTALIZING_SURFACE_PROBE,
  CLIENT_REPAIR_REFUSAL_PROBE,
  SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
} from './interviewDisengagementProbeCopy';
import {
  isInterviewHardStopUserTurn,
  looksLikeMentalizingThinInterviewQuestion,
  looksLikeSurfaceOnlyEmotionalLabelAnswer,
  userAnswerAddressesDanielStateForScenarioCQ1,
  userAnswerHasSophiePerspectiveLanguage,
} from './interviewMentalizingAndAnswerSignals';
import {
  evaluateRepairRefusalDetection,
  type RepairRefusalDetectionDetail,
} from './interviewRepairRefusalDetection';
import { looksLikeRepairInterviewQuestion } from './interviewRepairQuestionDetection';
import { isMisplacedScenarioCQ1Answer, isScenarioCQ1Prompt } from './probeAndScoringUtils';

export type ClientDisengagementProbePick =
  | {
      kind: 'repair_refusal';
      probe: typeof CLIENT_REPAIR_REFUSAL_PROBE;
      repairRefusal: RepairRefusalDetectionDetail;
    }
  | { kind: 'mentalizing_surface'; probe: typeof CLIENT_MENTALIZING_SURFACE_PROBE }
  | {
      kind: 'scenario_c_sophie_perspective';
      probe: typeof SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE;
    };

export function pickClientDisengagementProbe(input: {
  userAnswer: string;
  lastAssistantContent: string;
  wordCount: number;
  /** Already answering any client or approved elongating probe — do not chain. */
  answeringAfterProbe: boolean;
  /** Name / ready / re-entry / etc. */
  exemptMetaTurn: boolean;
  /** Opening name capture turn */
  isGreetingNameTurn: boolean;
  /** Infra / ratio recovery assistant lines */
  isAssistantRecoveryOrMetaLine: boolean;
  /**
   * True iff this user message is the first user turn in the current scenario vignette (not a follow-up).
   * Required for the mentalizing surface-label probe — never fires on 2nd+ scenario replies.
   */
  isFirstUserTurnInScenario: boolean;
  /** Scenario C Sophie-perspective probe already fired this interview — at most once. */
  scenarioCSophiePerspectiveProbeAlreadyFired?: boolean;
  /** Generic mentalizing surface probe already delivered earlier in the interview. */
  mentalizingSurfaceProbeAlreadyFired?: boolean;
}): ClientDisengagementProbePick | null {
  const {
    userAnswer,
    lastAssistantContent,
    wordCount,
    answeringAfterProbe,
    exemptMetaTurn,
    isGreetingNameTurn,
    isAssistantRecoveryOrMetaLine,
    isFirstUserTurnInScenario,
    scenarioCSophiePerspectiveProbeAlreadyFired,
    mentalizingSurfaceProbeAlreadyFired,
  } = input;

  if (!lastAssistantContent.trim()) return null;
  if (answeringAfterProbe || exemptMetaTurn || isGreetingNameTurn || isAssistantRecoveryOrMetaLine) {
    return null;
  }

  const repairQ = looksLikeRepairInterviewQuestion(lastAssistantContent);
  if (repairQ) {
    if (isInterviewHardStopUserTurn(userAnswer)) return null;
    const repairRefusal = evaluateRepairRefusalDetection(userAnswer, wordCount, lastAssistantContent);
    if (repairRefusal.repair_refusal_detected) {
      return { kind: 'repair_refusal', probe: CLIENT_REPAIR_REFUSAL_PROBE, repairRefusal };
    }
  }

  if (
    !scenarioCSophiePerspectiveProbeAlreadyFired &&
    !mentalizingSurfaceProbeAlreadyFired &&
    isScenarioCQ1Prompt(lastAssistantContent) &&
    !isMisplacedScenarioCQ1Answer(userAnswer) &&
    userAnswerAddressesDanielStateForScenarioCQ1(userAnswer) &&
    !userAnswerHasSophiePerspectiveLanguage(userAnswer) &&
    wordCount >= 15 &&
    wordCount <= 60
  ) {
    return { kind: 'scenario_c_sophie_perspective', probe: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE };
  }

  if (
    isFirstUserTurnInScenario &&
    looksLikeMentalizingThinInterviewQuestion(lastAssistantContent) &&
    wordCount < 15 &&
    looksLikeSurfaceOnlyEmotionalLabelAnswer(userAnswer)
  ) {
    return { kind: 'mentalizing_surface', probe: CLIENT_MENTALIZING_SURFACE_PROBE };
  }

  return null;
}
