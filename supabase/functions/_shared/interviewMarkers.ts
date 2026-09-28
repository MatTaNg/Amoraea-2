/**
 * Relationship markers — sole scored constructs for the Amoraea interview.
 * JSON keys for pillarScores / markerScores payloads must match these ids.
 * Historical keys (contempt, attunement, commitment_threshold) are aliased on read.
 */

export const INTERVIEW_MARKER_IDS = [
  'mentalizing',
  'accountability',
  'destructive_conflict',
  'repair',
  'regulation',
  'responsiveness_support',
  'appreciation',
  'commitment_persistence',
] as const;

export type InterviewMarkerId = (typeof INTERVIEW_MARKER_IDS)[number];

export const INTERVIEW_MARKER_LABELS: Record<InterviewMarkerId, string> = {
  mentalizing: 'Mentalizing',
  accountability: 'Accountability / Defensiveness',
  destructive_conflict: 'Destructive Conflict',
  repair: 'Repair',
  regulation: 'Emotional Regulation',
  responsiveness_support: 'Responsiveness & Support',
  appreciation: 'Appreciation & Positive Regard',
  commitment_persistence: 'Commitment Persistence',
};

/** Slice-level JSON keys (not final pillars); shown on scenario scorecards only. */
export const SLICE_ONLY_MARKER_LABELS: Record<string, string> = {
  contempt_recognition: "Destructive conflict — recognition (others' dynamics)",
  contempt_expression: 'Destructive conflict — expression (participant framing)',
  need_recognition: 'Need recognition',
  attunement: 'Attunement (slice)',
  support_response: 'Support response',
  adaptability: 'Adaptability',
  commitment_orientation: 'Commitment orientation',
  persistence_exit_judgment: 'Persistence / exit judgment',
};

/** Used for gate minimums (maps old Conflict/Repair + Accountability floors). */
export const GATE_MIN_REPAIR_MARKER: InterviewMarkerId = 'repair';
export const GATE_MIN_ACCOUNTABILITY_MARKER: InterviewMarkerId = 'accountability';
