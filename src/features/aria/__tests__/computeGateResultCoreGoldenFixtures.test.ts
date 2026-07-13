import { computeGateResultCore } from '../computeGateResultCore';
import { INTERVIEW_MARKER_IDS } from '../interviewMarkers';

/**
 * Golden fixtures for gate scoring.
 * Canonical implementation: supabase/functions/_shared/computeGateResultCore.ts
 * (re-exported via @features/aria/computeGateResultCore). Update expected outputs when gate logic changes.
 */
const GATE_SCORING_GOLDEN_FIXTURES = [
  {
    name: 'all zeros fails no_assessed_markers',
    scores: Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, 0])),
    skepticism: null,
    expected: { pass: false, reason: 'no_assessed_markers', weightedScore: null },
  },
  {
    name: 'uniform sevens pass',
    scores: Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, 7])),
    skepticism: null,
    expected: { pass: true, reason: 'pass', weightedScoreMin: 6.5 },
  },
  {
    name: 'repair floor breach',
    scores: {
      ...Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, 7])),
      repair: 4,
    },
    skepticism: null,
    expected: { pass: false, reason: 'floor_breach', failReasonIncludes: 'repair' },
  },
] as const;

describe('computeGateResultCore golden fixtures', () => {
  for (const fixture of GATE_SCORING_GOLDEN_FIXTURES) {
    it(fixture.name, () => {
      const result = computeGateResultCore(
        fixture.scores as Record<string, number>,
        fixture.skepticism,
      );

      expect(result.pass).toBe(fixture.expected.pass);
      expect(result.reason).toBe(fixture.expected.reason);

      if ('weightedScore' in fixture.expected) {
        expect(result.weightedScore).toBe(fixture.expected.weightedScore);
      }
      if ('weightedScoreMin' in fixture.expected && fixture.expected.weightedScoreMin != null) {
        expect(result.weightedScore).toBeGreaterThanOrEqual(fixture.expected.weightedScoreMin);
      }
      if ('failReasonIncludes' in fixture.expected && fixture.expected.failReasonIncludes) {
        expect(result.failReason).toContain(fixture.expected.failReasonIncludes);
      }
    });
  }
});
