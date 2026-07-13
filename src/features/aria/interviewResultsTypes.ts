import type { GateResult } from '@features/aria/computeGateResult';

export interface CommunicationQuality {
  ownershipLanguage: number;
  blameJudgementLanguage: number;
  empathyInLanguage: number;
  owningExperience: number;
  communicationSummary?: string;
}

export interface InterviewResults {
  pillarScores: Record<string, number>;
  keyEvidence?: Record<string, string>;
  pillarConfidence?: Record<string, string>;
  communicationQuality?: CommunicationQuality;
  narrativeCoherence?: string;
  behavioralSpecificity?: string;
  notableInconsistencies?: string[];
  interviewSummary?: string;
  gateResult?: GateResult;
  skepticismModifier?: { pillarId: number | string | null; adjustment: number; reason?: string };
  /** Holistic transcript meta-score (1–5); not a pillar and not in weighted average. */
  ego_development_level?: number | null;
  /** Alpha / diagnostics: scenario skips and summed numeric penalties (third skip has null entry, no extra sum). */
  skipBreakdown?: {
    skips_taken: number;
    skip_penalties: (number | null)[];
    skip_penalty_total: number;
  };
}
