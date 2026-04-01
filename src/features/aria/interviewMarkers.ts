/**
 * Relationship markers — sole scored constructs for the Amoraea interview.
 * JSON keys for pillarScores / markerScores payloads must match these ids.
 */

export const INTERVIEW_MARKER_IDS = [
  'mentalizing',
  'accountability',
  'contempt',
  'repair',
  'regulation',
  'attunement',
  'appreciation',
  'commitment_threshold',
] as const;

export type InterviewMarkerId = (typeof INTERVIEW_MARKER_IDS)[number];

export const INTERVIEW_MARKER_LABELS: Record<InterviewMarkerId, string> = {
  mentalizing: 'Mentalizing',
  accountability: 'Accountability / Defensiveness',
  contempt: 'Contempt / Criticism',
  repair: 'Repair',
  regulation: 'Emotional Regulation',
  attunement: 'Attunement',
  appreciation: 'Appreciation & Positive Regard',
  commitment_threshold: 'Commitment Threshold',
};

/** Used for gate minimums (maps old Conflict/Repair + Accountability floors). */
export const GATE_MIN_REPAIR_MARKER: InterviewMarkerId = 'repair';
export const GATE_MIN_ACCOUNTABILITY_MARKER: InterviewMarkerId = 'accountability';
