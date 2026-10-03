/**
 * Single source of truth for verbatim interview probes the app may deliver.
 * Scenario vignette opens stay client-owned via showScenarioCard — not listed here.
 */
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';
import {
  MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT,
  MOMENT_4_GRUDGE_QUESTION_TEXT,
  MOMENT_SUPPORT_CONDITIONAL_PROBE_TEXT,
  MOMENT_SUPPORT_QUESTION_TEXT,
} from '@features/aria/moment4ProbeLogic';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/moment5ProbeCopy';
import {
  GO_BACK_REQUEST_DECLINE_LINE,
  SCORE_REQUEST_DECLINE_LINE,
} from '@features/aria/interviewPromptInstructions';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from '@features/aria/scenarioAContemptProbeCopy';
import {
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import { SCENARIO_C_REPAIR_QUESTION_CANONICAL } from '@features/aria/scenarioCPromptDetection';

export type InterviewCanonicalProbeId =
  | 's1_contempt'
  | 's1_repair'
  | 's2_james_differently'
  | 's2_james_repair'
  | 's3_sophie_perspective'
  | 's3_repair'
  | 'm4_grudge'
  | 'm4_commitment_threshold'
  | 'm4_commitment_orientation'
  | 'm_support'
  | 'm_support_need_recognition'
  | 'm5_conflict';

export type InterviewFixedLineId = 'score_decline' | 'go_back_decline';

export type InterviewCanonicalProbeEntry = {
  id: InterviewCanonicalProbeId;
  scenarioNumber: 1 | 2 | 3 | null;
  momentNumber: 1 | 2 | 3 | 4 | 5;
  construct: string;
  verbatimText: string;
  retired?: boolean;
};

export const INTERVIEW_CANONICAL_PROBES: Record<
  InterviewCanonicalProbeId,
  InterviewCanonicalProbeEntry
> = {
  s1_contempt: {
    id: 's1_contempt',
    scenarioNumber: 1,
    momentNumber: 1,
    construct: 'contempt_read_of_emma_closing_line',
    verbatimText: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  },
  s1_repair: {
    id: 's1_repair',
    scenarioNumber: 1,
    momentNumber: 1,
    construct: 'repair_as_ryan',
    verbatimText: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
  },
  s2_james_differently: {
    id: 's2_james_differently',
    scenarioNumber: 2,
    momentNumber: 2,
    construct: 'james_could_do_differently',
    verbatimText: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  },
  s2_james_repair: {
    id: 's2_james_repair',
    scenarioNumber: 2,
    momentNumber: 2,
    construct: 'repair_as_james',
    verbatimText: SCENARIO_B_JAMES_REPAIR_CANONICAL,
    retired: true,
  },
  s3_sophie_perspective: {
    id: 's3_sophie_perspective',
    scenarioNumber: 3,
    momentNumber: 3,
    construct: 'sophie_perspective',
    verbatimText: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
  },
  s3_repair: {
    id: 's3_repair',
    scenarioNumber: 3,
    momentNumber: 3,
    construct: 'repair_as_daniel',
    verbatimText: SCENARIO_C_REPAIR_QUESTION_CANONICAL,
    retired: true,
  },
  m4_grudge: {
    id: 'm4_grudge',
    scenarioNumber: null,
    momentNumber: 4,
    construct: 'grudge_dislike_personal',
    verbatimText: MOMENT_4_GRUDGE_QUESTION_TEXT,
  },
  m4_commitment_threshold: {
    id: 'm4_commitment_threshold',
    scenarioNumber: null,
    momentNumber: 4,
    construct: 'persistence_exit_judgment',
    verbatimText: MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT,
  },
  m4_commitment_orientation: {
    id: 'm4_commitment_orientation',
    scenarioNumber: null,
    momentNumber: 4,
    construct: 'commitment_orientation',
    verbatimText: MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
  },
  m_support: {
    id: 'm_support',
    scenarioNumber: null,
    momentNumber: 4,
    construct: 'responsiveness_support',
    verbatimText: MOMENT_SUPPORT_QUESTION_TEXT,
  },
  m_support_need_recognition: {
    id: 'm_support_need_recognition',
    scenarioNumber: null,
    momentNumber: 4,
    construct: 'need_recognition',
    verbatimText: MOMENT_SUPPORT_CONDITIONAL_PROBE_TEXT,
  },
  m5_conflict: {
    id: 'm5_conflict',
    scenarioNumber: null,
    momentNumber: 5,
    construct: 'conflict_resolution_personal',
    verbatimText: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
  },
};

export const INTERVIEW_FIXED_LINES: Record<InterviewFixedLineId, string> = {
  score_decline: SCORE_REQUEST_DECLINE_LINE,
  go_back_decline: GO_BACK_REQUEST_DECLINE_LINE,
};

export function getCanonicalProbeText(id: InterviewCanonicalProbeId): string {
  return INTERVIEW_CANONICAL_PROBES[id].verbatimText;
}

export function isInterviewCanonicalProbeRetired(id: InterviewCanonicalProbeId): boolean {
  return INTERVIEW_CANONICAL_PROBES[id].retired === true;
}
