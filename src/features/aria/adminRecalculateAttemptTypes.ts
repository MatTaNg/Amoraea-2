import type { DefensePatternsJson } from './aggregateMarkerScoresFromSlices';
import type { GateResult } from './computeGateResultCore';
import type { CompletionGateFailure } from './interviewCompletionGate';

export type AdminRecalculateOptions = {
  /**
   * Stored scenario_*_scores were persisted after contempt heuristic + transcript reconciliation
   * at interview completion; re-applying those steps double-processes slices.
   * @default true
   */
  skipScenarioTranscriptMutations?: boolean;
  /** Use persisted gate aux fields (defense, disclosure, skip penalties) for baseline parity. */
  usePersistedGateContext?: boolean;
};

export type AdminRecalculateAttemptInput = {
  transcript: unknown;
  scenario_1_scores: unknown;
  scenario_2_scores: unknown;
  scenario_3_scores: unknown;
  scenario_specific_patterns: unknown;
  skip_count?: number | string | null;
  ego_development_level?: unknown;
  /** Stored `interview_attempts.language_markers` — optional `emotional_vocab_density` for divergence vs personal moments. */
  language_markers?: unknown;
  /** Persisted gate context (used when `usePersistedGateContext`). */
  defense_patterns?: unknown;
  disclosure_calibration?: unknown;
  mentalizing_overcertainty_count?: number | null;
  skip_penalty_total?: number | null;
  auto_failed?: boolean | null;
  moment_4_concreteness?: unknown;
  moment_5_concreteness?: unknown;
  personal_moment_emotional_vocab_density?: number | null;
  personal_moment_emotional_vocab_low?: boolean | null;
  emotion_recognition_raw_score?: number | null;
  emotion_recognition_responses?: unknown;
  closing_integration?: string | null;
  /** When `usePersistedGateContext`, use as gate `precomputedWeightedScore` for baseline parity. */
  persisted_weighted_score?: number | null;
};

export type AdminRecalculateSuccess = {
  kind: 'success';
  pillar_scores: Record<string, number>;
  gate: GateResult;
  notes: string[];
  scenarioCompositesJson: Record<string, unknown> | null;
  mentalizingOvercertaintyCount: number;
  defense_patterns: DefensePatternsJson;
  disclosure_calibration: string;
  personal_moment_emotional_vocab_density: number | null;
  personal_moment_emotional_vocab_low: boolean;
  moment_4_concreteness: string | null;
  moment_5_concreteness: string | null;
  ego_development_level: number | null;
};

export type AdminRecalculateIncomplete = {
  kind: 'incomplete';
  gate: GateResult;
  notes: string[];
  completionFailure: CompletionGateFailure;
};

export type AdminRecalculateResult = AdminRecalculateSuccess | AdminRecalculateIncomplete;
