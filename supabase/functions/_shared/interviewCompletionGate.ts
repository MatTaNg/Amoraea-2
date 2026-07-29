/**
 * Canonical interview completion gate (app + edge).
 * @see src/features/aria/interviewCompletionGate.ts
 */
import type { GateResult } from './computeGateResultCore.ts';

export type CompletionGateFailure = {
  ok: false;
  incomplete_reason: string;
  missingScenarioNumbers: (1 | 2 | 3)[];
  missingMoment4: boolean;
  missingMoment5: boolean;
  detail: string;
};

export type CompletionGateSuccess = { ok: true };

export type InterviewCompletionGateResult = CompletionGateSuccess | CompletionGateFailure;

/** At least one finite numeric pillar score (interview slice is assessable). */
export function pillarScoresHaveNumericAssessment(ps: unknown): boolean {
  if (ps == null || typeof ps !== 'object' || Array.isArray(ps)) return false;
  return Object.values(ps as Record<string, unknown>).some(
    (v) => typeof v === 'number' && Number.isFinite(v),
  );
}

function scenarioBundleAssessable(bundle: unknown): boolean {
  if (bundle == null || typeof bundle !== 'object') return false;
  const ps =
    (bundle as { pillarScores?: unknown }).pillarScores ??
    (bundle as { pillar_scores?: unknown }).pillar_scores;
  return pillarScoresHaveNumericAssessment(ps);
}

export function keyEvidenceHasNonEmptyAssessedText(keyEvidence: unknown): boolean {
  if (keyEvidence == null || typeof keyEvidence !== 'object' || Array.isArray(keyEvidence)) return false;
  return Object.values(keyEvidence as Record<string, unknown>).some(
    (v) => typeof v === 'string' && v.trim().length > 0
  );
}

/** Exported for persistence: drop stored shells that would fail {@link evaluateInterviewCompletionGate}. */
export function personalMomentBundleWasScored(bundle: unknown): boolean {
  if (bundle == null || typeof bundle !== 'object') return false;
  const ps =
    (bundle as { pillarScores?: unknown }).pillarScores ??
    (bundle as { pillar_scores?: unknown }).pillar_scores;
  if (pillarScoresHaveNumericAssessment(ps)) return true;
  if (ps == null || typeof ps !== 'object' || Array.isArray(ps)) return false;
  const keyEvidence = (bundle as { keyEvidence?: unknown }).keyEvidence;
  // No finite numerics: treat as scored only when keyEvidence documents the assessment (deflection /
  // no-signal paths). Do not accept an empty keyEvidence object — that was letting `{}` pass after sanitize.
  return keyEvidenceHasNonEmptyAssessedText(keyEvidence);
}

/** Align with app {@link MIN_FIRST_SUBSTANTIVE_RESPONSE_WORDS} / Moment 5 scoring guard. */
const MIN_MOMENT5_ROLLUP_USER_WORDS = 10;
const MIN_MOMENT5_ROLLUP_USER_CHARS = 5;

function countInterviewWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

/** True when a user turn is long enough to trigger Moment 5 scoring (not skip/meta-only). */
export function moment5UserTurnAssessableForRollup(content: string | null | undefined): boolean {
  const trimmed = (content ?? '').trim();
  if (trimmed.length < MIN_MOMENT5_ROLLUP_USER_CHARS) return false;
  return countInterviewWords(trimmed) >= MIN_MOMENT5_ROLLUP_USER_WORDS;
}

/**
 * Lightweight M5 eligibility: true when the transcript shows Moment 5 was reached with an
 * assessable user answer (tagged user turn or primary conflict question + substantive reply).
 * Thin/meta turns (e.g. "Can we skip this one?") do not require moment_5_scores for rollup.
 */
export function transcriptReachedMoment5ForRollup(transcript: unknown): boolean {
  if (!Array.isArray(transcript)) return false;
  let sawPrimaryConflictQuestion = false;
  for (const turn of transcript) {
    if (turn == null || typeof turn !== 'object') continue;
    const t = turn as { role?: string; content?: string; interviewMoment?: number };
    if (
      t.interviewMoment === 5 &&
      t.role === 'user' &&
      typeof t.content === 'string' &&
      moment5UserTurnAssessableForRollup(t.content)
    ) {
      return true;
    }
    if (
      t.role === 'assistant' &&
      typeof t.content === 'string' &&
      /conflict with someone important/i.test(t.content)
    ) {
      sawPrimaryConflictQuestion = true;
    }
    if (
      sawPrimaryConflictQuestion &&
      t.role === 'user' &&
      typeof t.content === 'string' &&
      moment5UserTurnAssessableForRollup(t.content)
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Full interview completion: all three scenario slices present with ≥1 numeric pillar each,
 * Moment 4 present with scored evidence, and Moment 5 when the transcript reached an assessable M5 turn.
 */
export function evaluateInterviewCompletionGate(input: {
  scenario1: unknown;
  scenario2: unknown;
  scenario3: unknown;
  moment4: unknown;
  moment5?: unknown;
  transcript?: unknown;
}): InterviewCompletionGateResult {
  const missingScenario: (1 | 2 | 3)[] = [];
  const reasons: string[] = [];

  const bundles: Array<{ n: 1 | 2 | 3; raw: unknown }> = [
    { n: 1, raw: input.scenario1 },
    { n: 2, raw: input.scenario2 },
    { n: 3, raw: input.scenario3 },
  ];

  for (const { n, raw } of bundles) {
    if (raw == null) {
      missingScenario.push(n);
      reasons.push(`scenario_${n}_scores null`);
      continue;
    }
    if (!scenarioBundleAssessable(raw)) {
      missingScenario.push(n);
      reasons.push(`scenario_${n}_scores missing numeric pillar scores`);
    }
  }

  let missingMoment4 = false;
  if (input.moment4 == null) {
    missingMoment4 = true;
    reasons.push('moment_4_scores null');
  } else {
    if (!personalMomentBundleWasScored(input.moment4)) {
      missingMoment4 = true;
      reasons.push('moment_4_scores missing scored pillar evidence');
    }
  }

  let missingMoment5 = false;
  if (
    !missingMoment4 &&
    missingScenario.length === 0 &&
    transcriptReachedMoment5ForRollup(input.transcript)
  ) {
    if (!personalMomentBundleWasScored(input.moment5)) {
      missingMoment5 = true;
      reasons.push('moment_5_scores missing scored pillar evidence');
    }
  }

  if (missingScenario.length === 0 && !missingMoment4 && !missingMoment5) {
    return { ok: true };
  }

  let incomplete_reason: string;
  if (missingScenario.length > 0) {
    incomplete_reason = `missing_scenario_${missingScenario[0]}`;
  } else if (missingMoment4) {
    incomplete_reason = 'missing_moment_4';
  } else {
    incomplete_reason = 'missing_moment_5';
  }

  return {
    ok: false,
    incomplete_reason,
    missingScenarioNumbers: missingScenario,
    missingMoment4,
    missingMoment5,
    detail: reasons.join('; '),
  };
}

export function buildIncompleteInterviewGateResult(failure: CompletionGateFailure): GateResult {
  return {
    pass: false,
    reason: 'incomplete_interview',
    weightedScore: null,
    failingConstruct: null,
    failingScore: null,
    assessedMarkerCount: 0,
    excludedMarkers: [],
    failReason: `incomplete_interview: ${failure.detail}`,
    failReasonCodes: [],
    failReasonDetail: null,
    scenarioComposites: null,
    reviewFlags: [],
    modifiedWeightedScore: null,
    scoreModifier: 0,
  };
}
