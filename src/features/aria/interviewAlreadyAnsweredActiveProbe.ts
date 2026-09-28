import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import { INTERVIEW_CANONICAL_PROBES } from '@features/aria/interviewCanonicalProbeRegistry';
import {
  evaluateInterviewProbeConstructSatisfaction,
  type ProbeConstructSatisfactionResult,
} from '@features/aria/evaluateInterviewProbeConstructSatisfaction';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';

/** Exactly one canonical step forward after the active probe — no multi-hop skipping. */
const ALREADY_ANSWERED_SINGLE_HOP_ADVANCE: Partial<
  Record<InterviewCanonicalProbeId, InterviewCanonicalProbeId>
> = {
  s1_contempt: 's2_james_differently',
  s1_repair: 's2_james_differently',
  s2_james_differently: 's3_sophie_perspective',
  s2_james_repair: 's3_sophie_perspective',
  s3_sophie_perspective: 's3_repair',
  s3_repair: 'm4_grudge',
  m4_grudge: 'm4_commitment_orientation',
  m4_commitment_orientation: 'm4_commitment_threshold',
  m4_commitment_threshold: 'm_support',
  m_support: 'm_support_need_recognition',
  m_support_need_recognition: 'm5_conflict',
};

/** True when the user substantively addressed the probe — not merely that it was spoken. */
export function evaluateActiveProbeSubstantivelyAnswered(args: {
  probeId: InterviewCanonicalProbeId;
  messages: readonly MessageWithScenario[];
  userText: string;
  constructFlags: PreClaudeScenarioConstructProbeFlags;
}): ProbeConstructSatisfactionResult {
  return evaluateInterviewProbeConstructSatisfaction({
    ...args,
    requireSubstantiveUserAnswer: true,
  });
}

export function isAllowedAlreadyAnsweredAdvanceProbe(
  activeProbeId: InterviewCanonicalProbeId,
  candidate: InterviewCanonicalProbeId,
): boolean {
  return ALREADY_ANSWERED_SINGLE_HOP_ADVANCE[activeProbeId] === candidate;
}

/** Advance one probe when — and only when — the active construct is substantively satisfied. */
export function resolveAlreadyAnsweredSingleHopAdvanceProbeId(args: {
  activeProbeId: InterviewCanonicalProbeId;
  messages: readonly MessageWithScenario[];
  userText: string;
  constructFlags: PreClaudeScenarioConstructProbeFlags;
}): InterviewCanonicalProbeId | null {
  const activeAnswered = evaluateActiveProbeSubstantivelyAnswered({
    probeId: args.activeProbeId,
    messages: args.messages,
    userText: args.userText,
    constructFlags: args.constructFlags,
  });
  if (!activeAnswered.satisfied) {
    return null;
  }

  const advance = ALREADY_ANSWERED_SINGLE_HOP_ADVANCE[args.activeProbeId];
  if (!advance) return null;
  return advance;
}

export function scenarioNumberForCanonicalProbe(
  probeId: InterviewCanonicalProbeId,
): 1 | 2 | 3 | null {
  return INTERVIEW_CANONICAL_PROBES[probeId].scenarioNumber;
}
