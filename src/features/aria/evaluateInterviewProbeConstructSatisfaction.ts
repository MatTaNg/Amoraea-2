/**
 * Unified construct-satisfaction checks for canonical interview probes.
 * Consolidates scattered regex / transcript guards used by pre-Claude gates.
 */
import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import {
  getCanonicalProbeText,
  INTERVIEW_CANONICAL_PROBES,
} from '@features/aria/interviewCanonicalProbeRegistry';
import {
  aggregateScenario1Moment1UserTextForContemptGate,
  hasScenarioAQ1ContemptProbeCoverage,
} from '@features/aria/scenarioAContemptProbeCoverage';
import {
  scenarioARepairAnswerAlreadySatisfiedInTranscript,
  userAnswerSatisfiesScenarioARepairPrompt,
  userAnswerSatisfiesScenarioBJamesRepairPrompt,
} from '@features/aria/interviewRepairRefusalDetection';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import {
  scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent,
  userAnswerLooksLikeAheadOfScheduleScenarioBJamesDifferentlyOnQ1,
} from '@features/aria/scenarioBProbeLogic';
import {
  scenarioCRepairConstructStillPending,
  scenarioCUserAnswerHasSubstantiveRepairContent,
  userAnswerSatisfiesScenarioCSophiePerspectiveProbe,
} from '@features/aria/scenarioCPromptDetection';
import { scenarioFollowUpAlreadyInTranscript } from '@features/aria/scenarioFollowUpTranscriptGuard';
import {
  looksLikeAssessableMoment4ThresholdAnswer,
  looksLikeAssessableOrientationAnswer,
  looksLikeAssessableSupportAnswer,
  looksLikeMoment4GrudgePrompt,
  looksLikeMoment4OrientationQuestion,
  looksLikeMomentSupportConditionalProbe,
  looksLikeMomentSupportQuestion,
  looksLikeMisplacedNonGrudgeMoment4Answer,
  looksLikeNeedRecognitionInSupportAnswer,
  transcriptIncludesAssistantMatch,
  transcriptIncludesMoment4ThresholdAssistant,
} from '@features/aria/moment4ProbeLogic';
import {
  moment5TranscriptHasConcreteAnchor,
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
} from '@features/aria/probeAndScoringUtils';

export type ProbeConstructSatisfactionResult = {
  satisfied: boolean;
  source: 'transcript_delivered' | 'legacy_flag' | 'user_transcript' | 'llm_live' | 'none';
  reason: string;
};

function probeDeliveredInTranscript(
  messages: readonly MessageWithScenario[],
  probeId: InterviewCanonicalProbeId,
): boolean {
  return scenarioFollowUpAlreadyInTranscript(messages, getCanonicalProbeText(probeId));
}

function aggregateScenarioUserText(
  messages: readonly MessageWithScenario[],
  scenarioNumber: 1 | 2 | 3,
  momentNumber?: number,
): string {
  const parts: string[] = [];
  for (const m of messages) {
    if (m.role !== 'user') continue;
    if ((m.scenarioNumber ?? 0) !== scenarioNumber) continue;
    if (momentNumber != null && m.interviewMoment !== undefined && m.interviewMoment !== momentNumber) {
      continue;
    }
    const c = String(m.content ?? '').trim();
    if (c) parts.push(c);
  }
  return parts.join('\n').trim();
}

function evaluateS1ContemptSatisfaction(args: {
  messages: readonly MessageWithScenario[];
  userText: string;
  constructFlags: PreClaudeScenarioConstructProbeFlags;
}): ProbeConstructSatisfactionResult {
  if (args.constructFlags.specificEmmaLineAlreadyAddressed) {
    return {
      satisfied: true,
      source: 'legacy_flag',
      reason: 'specificEmmaLineAlreadyAddressed',
    };
  }
  const agg =
    aggregateScenario1Moment1UserTextForContemptGate(args.messages) || args.userText.trim();
  if (agg.length >= 8 && hasScenarioAQ1ContemptProbeCoverage(agg)) {
    return {
      satisfied: true,
      source: 'user_transcript',
      reason: 'scenario_a_q1_contempt_coverage',
    };
  }
  return { satisfied: false, source: 'none', reason: 'contempt_construct_not_met' };
}

function evaluateS1RepairSatisfaction(args: {
  messages: readonly MessageWithScenario[];
  userText: string;
}): ProbeConstructSatisfactionResult {
  if (scenarioARepairAnswerAlreadySatisfiedInTranscript(args.messages)) {
    return {
      satisfied: true,
      source: 'user_transcript',
      reason: 'scenario_a_repair_content_in_transcript',
    };
  }
  return { satisfied: false, source: 'none', reason: 'repair_construct_not_met' };
}

function evaluateS2JamesDifferentlySatisfaction(args: {
  messages: readonly MessageWithScenario[];
  userText: string;
}): ProbeConstructSatisfactionResult {
  const s2User = aggregateScenarioUserText(args.messages, 2, 2);
  const corpus = [s2User, args.userText.trim()].filter(Boolean).join('\n');
  for (const line of corpus.split('\n')) {
    if (userAnswerLooksLikeAheadOfScheduleScenarioBJamesDifferentlyOnQ1(line)) {
      return {
        satisfied: true,
        source: 'user_transcript',
        reason: 'james_differently_ahead_of_schedule_on_q1',
      };
    }
  }
  return { satisfied: false, source: 'none', reason: 'james_differently_construct_not_met' };
}

function evaluateS2JamesRepairSatisfaction(args: {
  messages: readonly MessageWithScenario[];
  userText: string;
}): ProbeConstructSatisfactionResult {
  const s2User = aggregateScenarioUserText(args.messages, 2, 2);
  const lines = [...s2User.split('\n'), args.userText.trim()].filter(Boolean);
  for (const line of lines) {
    if (scenarioBJamesDifferenceOrAppreciationAnswerHasRepairContent(line)) {
      return {
        satisfied: true,
        source: 'user_transcript',
        reason: 'james_repair_in_differently_or_appreciation_answer',
      };
    }
    if (userAnswerSatisfiesScenarioBJamesRepairPrompt(line)) {
      return {
        satisfied: true,
        source: 'user_transcript',
        reason: 'james_repair_prompt_satisfied',
      };
    }
  }
  return { satisfied: false, source: 'none', reason: 'james_repair_construct_not_met' };
}

function evaluateS3SophiePerspectiveSatisfaction(args: {
  messages: readonly MessageWithScenario[];
  userText: string;
}): ProbeConstructSatisfactionResult {
  const s3User = aggregateScenarioUserText(args.messages, 3, 3);
  const lines = [...s3User.split('\n'), args.userText.trim()].filter(Boolean);
  for (const line of lines) {
    if (userAnswerSatisfiesScenarioCSophiePerspectiveProbe(line)) {
      return {
        satisfied: true,
        source: 'user_transcript',
        reason: 'sophie_perspective_in_transcript',
      };
    }
  }
  return { satisfied: false, source: 'none', reason: 'sophie_perspective_construct_not_met' };
}

function evaluateS3RepairSatisfaction(args: {
  messages: readonly MessageWithScenario[];
  userText: string;
}): ProbeConstructSatisfactionResult {
  if (!scenarioCRepairConstructStillPending(args.messages)) {
    return {
      satisfied: true,
      source: 'user_transcript',
      reason: 'scenario_c_repair_construct_met',
    };
  }
  if (scenarioCUserAnswerHasSubstantiveRepairContent(args.userText.trim())) {
    return {
      satisfied: true,
      source: 'user_transcript',
      reason: 'scenario_c_repair_content_current_turn',
    };
  }
  return { satisfied: false, source: 'none', reason: 'scenario_c_repair_construct_not_met' };
}

function aggregateMomentUserText(
  messages: readonly MessageWithScenario[],
  momentNumber: 4 | 5,
): string {
  const parts: string[] = [];
  for (const m of messages) {
    if (m.role !== 'user') continue;
    if (m.interviewMoment !== undefined && m.interviewMoment !== momentNumber) continue;
    const c = String(m.content ?? '').trim();
    if (c) parts.push(c);
  }
  return parts.join('\n').trim();
}

function evaluateM4GrudgeSatisfaction(args: {
  messages: readonly MessageWithScenario[];
  userText: string;
}): ProbeConstructSatisfactionResult {
  let lastGrudgeIdx = -1;
  for (let i = 0; i < args.messages.length; i++) {
    const m = args.messages[i];
    if (m.role === 'assistant' && looksLikeMoment4GrudgePrompt(m.content ?? '')) {
      lastGrudgeIdx = i;
    }
  }
  const corpus = [aggregateMomentUserText(args.messages, 4), args.userText.trim()]
    .filter(Boolean)
    .join('\n');
  if (lastGrudgeIdx < 0) {
    return { satisfied: false, source: 'none', reason: 'grudge_prompt_not_delivered' };
  }
  const afterGrudge = args.messages.slice(lastGrudgeIdx + 1);
  const hasSubstantiveGrudgeAnswer = afterGrudge.some((m) => {
    if (m.role !== 'user') return false;
    const text = String(m.content ?? '').trim();
    if (text.split(/\s+/).filter(Boolean).length < 5) return false;
    return !looksLikeMisplacedNonGrudgeMoment4Answer(text);
  });
  if (hasSubstantiveGrudgeAnswer || (!looksLikeMisplacedNonGrudgeMoment4Answer(corpus) && corpus.length >= 20)) {
    return {
      satisfied: true,
      source: 'user_transcript',
      reason: 'm4_grudge_story_in_transcript',
    };
  }
  return { satisfied: false, source: 'none', reason: 'm4_grudge_construct_not_met' };
}

function evaluateM4ThresholdSatisfaction(args: {
  messages: readonly MessageWithScenario[];
  userText: string;
}): ProbeConstructSatisfactionResult {
  if (!transcriptIncludesMoment4ThresholdAssistant(args.messages)) {
    return { satisfied: false, source: 'none', reason: 'm4_threshold_not_asked' };
  }
  const corpus = [aggregateMomentUserText(args.messages, 4), args.userText.trim()]
    .filter(Boolean)
    .join('\n');
  for (const line of corpus.split('\n')) {
    if (looksLikeAssessableMoment4ThresholdAnswer(line)) {
      return {
        satisfied: true,
        source: 'user_transcript',
        reason: 'm4_threshold_fork_addressed',
      };
    }
  }
  return { satisfied: false, source: 'none', reason: 'm4_threshold_construct_not_met' };
}

function evaluateM4OrientationSatisfaction(args: {
  messages: readonly MessageWithScenario[];
  userText: string;
}): ProbeConstructSatisfactionResult {
  if (!transcriptIncludesAssistantMatch(args.messages, looksLikeMoment4OrientationQuestion)) {
    return { satisfied: false, source: 'none', reason: 'm4_orientation_not_asked' };
  }
  const corpus = [aggregateMomentUserText(args.messages, 4), args.userText.trim()]
    .filter(Boolean)
    .join('\n');
  if (looksLikeAssessableOrientationAnswer(corpus) || looksLikeAssessableOrientationAnswer(args.userText)) {
    return {
      satisfied: true,
      source: 'user_transcript',
      reason: 'm4_orientation_investing_answer',
    };
  }
  return { satisfied: false, source: 'none', reason: 'm4_orientation_construct_not_met' };
}

function evaluateSupportSatisfaction(args: {
  messages: readonly MessageWithScenario[];
  userText: string;
}): ProbeConstructSatisfactionResult {
  if (!transcriptIncludesAssistantMatch(args.messages, looksLikeMomentSupportQuestion)) {
    return { satisfied: false, source: 'none', reason: 'm_support_not_asked' };
  }
  if (looksLikeAssessableSupportAnswer(args.userText) || looksLikeNeedRecognitionInSupportAnswer(args.userText)) {
    return {
      satisfied: true,
      source: 'user_transcript',
      reason: 'm_support_story_in_transcript',
    };
  }
  return { satisfied: false, source: 'none', reason: 'm_support_construct_not_met' };
}

function evaluateSupportNeedRecognitionSatisfaction(args: {
  messages: readonly MessageWithScenario[];
  userText: string;
}): ProbeConstructSatisfactionResult {
  const asked = transcriptIncludesAssistantMatch(args.messages, looksLikeMomentSupportConditionalProbe);
  if (!asked && looksLikeNeedRecognitionInSupportAnswer(args.userText)) {
    return {
      satisfied: true,
      source: 'user_transcript',
      reason: 'need_recognition_already_in_support_answer',
    };
  }
  if (!asked) {
    return { satisfied: false, source: 'none', reason: 'm_support_need_recognition_not_asked' };
  }
  if (looksLikeNeedRecognitionInSupportAnswer(args.userText) || looksLikeAssessableSupportAnswer(args.userText)) {
    return {
      satisfied: true,
      source: 'user_transcript',
      reason: 'm_support_need_recognition_answered',
    };
  }
  return { satisfied: false, source: 'none', reason: 'm_support_need_recognition_construct_not_met' };
}

function evaluateM5ConflictSatisfaction(args: {
  messages: readonly MessageWithScenario[];
  userText: string;
}): ProbeConstructSatisfactionResult {
  const m5Delivered = args.messages.some(
    (m) =>
      m.role === 'assistant' &&
      transcriptAssistantContainsMoment5PrimaryConflictQuestion(m.content ?? ''),
  );
  if (!m5Delivered) {
    return { satisfied: false, source: 'none', reason: 'm5_conflict_not_asked' };
  }
  if (moment5TranscriptHasConcreteAnchor(args.messages) || args.userText.trim().length >= 12) {
    return {
      satisfied: true,
      source: 'user_transcript',
      reason: 'm5_conflict_narrative_in_transcript',
    };
  }
  return { satisfied: false, source: 'none', reason: 'm5_conflict_construct_not_met' };
}

/**
 * Returns whether the probe's construct is already substantively addressed in the transcript
 * (prior user turns and/or the current turn), independent of whether the verbatim probe was spoken.
 */
export function evaluateInterviewProbeConstructSatisfaction(args: {
  probeId: InterviewCanonicalProbeId;
  messages: readonly MessageWithScenario[];
  userText: string;
  constructFlags: PreClaudeScenarioConstructProbeFlags;
  /** When true, ignore "probe was spoken" — require substantive user content for the construct. */
  requireSubstantiveUserAnswer?: boolean;
}): ProbeConstructSatisfactionResult {
  const { probeId, messages, requireSubstantiveUserAnswer } = args;
  if (!requireSubstantiveUserAnswer && probeDeliveredInTranscript(messages, probeId)) {
    return {
      satisfied: true,
      source: 'transcript_delivered',
      reason: 'verbatim_probe_already_in_transcript',
    };
  }

  switch (probeId) {
    case 's1_contempt':
      return evaluateS1ContemptSatisfaction(args);
    case 's1_repair':
      return evaluateS1RepairSatisfaction(args);
    case 's2_james_differently':
      return evaluateS2JamesDifferentlySatisfaction(args);
    case 's2_james_repair':
      return evaluateS2JamesRepairSatisfaction(args);
    case 's3_sophie_perspective':
      return evaluateS3SophiePerspectiveSatisfaction(args);
    case 's3_repair':
      return evaluateS3RepairSatisfaction(args);
    case 'm4_grudge':
      return evaluateM4GrudgeSatisfaction(args);
    case 'm4_commitment_threshold':
      return evaluateM4ThresholdSatisfaction(args);
    case 'm4_commitment_orientation':
      return evaluateM4OrientationSatisfaction(args);
    case 'm_support':
      return evaluateSupportSatisfaction(args);
    case 'm_support_need_recognition':
      return evaluateSupportNeedRecognitionSatisfaction(args);
    case 'm5_conflict':
      return evaluateM5ConflictSatisfaction(args);
    default: {
      const _exhaustive: never = probeId;
      return _exhaustive;
    }
  }
}

/** Human-readable construct label for LLM shadow prompts. */
export function describeProbeConstructForLlm(probeId: InterviewCanonicalProbeId): string {
  return INTERVIEW_CANONICAL_PROBES[probeId].construct;
}
