import type { GateResult } from './computeGateResultCore';

export type CompletionGateFailure = {
  ok: false;
  incomplete_reason: string;
  missingScenarioNumbers: (1 | 2 | 3)[];
  missingMoment4: boolean;
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
  const ps = (bundle as { pillarScores?: unknown }).pillarScores;
  return pillarScoresHaveNumericAssessment(ps);
}

/**
 * Full interview completion: all three scenario slices present with ≥1 numeric pillar each,
 * and Moment 4 present with ≥1 numeric pillar (required for commitment / mentalizing aggregation).
 */
export function evaluateInterviewCompletionGate(input: {
  scenario1: unknown;
  scenario2: unknown;
  scenario3: unknown;
  moment4: unknown;
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
    const ps = (input.moment4 as { pillarScores?: unknown }).pillarScores;
    if (!pillarScoresHaveNumericAssessment(ps)) {
      missingMoment4 = true;
      reasons.push('moment_4_scores missing numeric pillar scores');
    }
  }

  if (missingScenario.length === 0 && !missingMoment4) {
    return { ok: true };
  }

  let incomplete_reason: string;
  if (missingScenario.length > 0) {
    incomplete_reason = `missing_scenario_${missingScenario[0]}`;
  } else {
    incomplete_reason = 'missing_moment_4';
  }

  return {
    ok: false,
    incomplete_reason,
    missingScenarioNumbers: missingScenario,
    missingMoment4,
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
  };
}
