import { isStandalonePersonalDisclosureAcknowledgment } from './personalDisclosureAckPatterns';
export { isStandalonePersonalDisclosureAcknowledgment } from './personalDisclosureAckPatterns';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from './scenarioAContemptProbeTtsStrip';
import {
  isActiveScenarioAConstructProbeTurn,
  scenarioFollowUpAlreadyInTranscript,
  transcriptContainsScenarioAContemptProbe,
  transcriptHasUserResponseAfterScenarioAContemptProbe,
  type ScenarioFollowUpTranscriptMessage,
} from './scenarioFollowUpTranscriptGuard';

export function isPersonalMomentInterviewTurn(interviewMoment: number): boolean {
  return interviewMoment === 4 || interviewMoment === 5;
}

/**
 * Personal disclosure acknowledgments belong in Moments 4–5 only.
 * Returns empty string when the whole turn is a standalone personal ack outside personal moments.
 */
export function stripStandalonePersonalDisclosureAckOutsidePersonalMoments(
  text: string,
  interviewMoment: number,
): string {
  if (isPersonalMomentInterviewTurn(interviewMoment)) return text;
  if (!isStandalonePersonalDisclosureAcknowledgment(text)) return text;
  return '';
}

export type ScenarioFollowUpAfterSuppressedResponseOpts = {
  interviewMoment: number;
  currentScenario?: number | null;
  shouldForceScenarioAContemptProbe: boolean;
  assistantIssuedScenarioAContemptProbe: boolean;
  shouldInjectScenarioARepairAfterContemptAnswer: boolean;
  shouldForceScenarioBFullAppreciationProbe: boolean;
  assistantIssuedScenarioBFullProbe: boolean;
  needsScenarioBJamesDifferentlyInsert: boolean;
  scenarioAContemptProbeAsked: boolean;
  scenarioARepairQuestionAsked: boolean;
  /** Prior transcript — duplicate follow-ups are blocked when already present. */
  transcriptMessages?: readonly ScenarioFollowUpTranscriptMessage[];
  /** Live ref may be ahead of transcript when streaming TTS already delivered a probe. */
  contemptProbeDeliveredThisTurn?: boolean;
};

/**
 * Next scripted scenario follow-up when elongating/personal-ack output was suppressed.
 * Follow-ups fire unconditionally — answer quality must not skip the sequence.
 */
export function resolveScenarioFollowUpAfterSuppressedResponse(
  opts: ScenarioFollowUpAfterSuppressedResponseOpts,
): string | null {
  if (opts.interviewMoment > 3) return null;

  const transcript = opts.transcriptMessages ?? [];
  const contemptAlreadyDelivered =
    opts.contemptProbeDeliveredThisTurn === true ||
    opts.scenarioAContemptProbeAsked ||
    transcriptContainsScenarioAContemptProbe(transcript);

  if (
    opts.shouldForceScenarioAContemptProbe &&
    !opts.assistantIssuedScenarioAContemptProbe &&
    !contemptAlreadyDelivered
  ) {
    const candidate = SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
    if (!scenarioFollowUpAlreadyInTranscript(transcript, candidate)) {
      return candidate;
    }
  }

  if (
    (opts.shouldInjectScenarioARepairAfterContemptAnswer ||
      (isActiveScenarioAConstructProbeTurn(opts.currentScenario, opts.interviewMoment) &&
        opts.scenarioAContemptProbeAsked &&
        !opts.scenarioARepairQuestionAsked)) &&
    !opts.shouldForceScenarioAContemptProbe &&
    (transcriptHasUserResponseAfterScenarioAContemptProbe(transcript) ||
      (opts.scenarioAContemptProbeAsked && !transcriptContainsScenarioAContemptProbe(transcript)))
  ) {
    const candidate = SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
    if (!scenarioFollowUpAlreadyInTranscript(transcript, candidate)) {
      return candidate;
    }
  }

  if (opts.shouldForceScenarioBFullAppreciationProbe && !opts.assistantIssuedScenarioBFullProbe) {
    const candidate =
      "What do you think James could've done differently so Sarah feels better?";
    if (!scenarioFollowUpAlreadyInTranscript(transcript, candidate)) {
      return candidate;
    }
  }

  if (opts.needsScenarioBJamesDifferentlyInsert) {
    const candidate =
      'Before things blew up, what do you think James could have done differently that might have helped Sarah feel appreciated?';
    if (!scenarioFollowUpAlreadyInTranscript(transcript, candidate)) {
      return candidate;
    }
  }

  return null;
}
