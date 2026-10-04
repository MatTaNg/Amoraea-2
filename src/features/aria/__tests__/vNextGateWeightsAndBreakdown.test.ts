import { describe, expect, it } from '@jest/globals';
import { GATE_MARKER_BASE_WEIGHTS } from '@config/scoring/interviewGateThresholds';
import { INTERVIEW_MARKER_IDS } from '@features/aria/interviewMarkers';
import { withLegacyInterviewPillarAliases } from '@config/scoring/interviewMarkerAliases';
import { computeGateResultCore } from '../computeGateResultCore';

const allMarkers = (score: number) =>
  Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, score])) as Record<string, number>;

describe('vNext gate weights and alias non-double-count', () => {
  it('uses the eight canonical weights totaling 1.00', () => {
    expect(GATE_MARKER_BASE_WEIGHTS).toEqual({
      destructive_conflict: 0.18,
      accountability: 0.18,
      repair: 0.17,
      regulation: 0.14,
      responsiveness_support: 0.09,
      mentalizing: 0.07,
      commitment_persistence: 0.07,
      appreciation: 0.1,
    });
    const sum = Object.values(GATE_MARKER_BASE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 10);
  });

  it('does not add extra weight for legacy aliases', () => {
    expect(Object.keys(GATE_MARKER_BASE_WEIGHTS).sort()).toEqual([...INTERVIEW_MARKER_IDS].sort());
    expect('contempt' in GATE_MARKER_BASE_WEIGHTS).toBe(false);
    expect('attunement' in GATE_MARKER_BASE_WEIGHTS).toBe(false);
    expect('commitment_threshold' in GATE_MARKER_BASE_WEIGHTS).toBe(false);
  });

  it('prefers canonical scores when both legacy and new keys are present', () => {
    const canonical = allMarkers(8);
    const dual = withLegacyInterviewPillarAliases({
      ...canonical,
      contempt: 1,
      attunement: 1,
      commitment_threshold: 1,
    });
    const withConflict = computeGateResultCore({ ...dual, destructive_conflict: 8, contempt: 1 });
    const withoutLegacy = computeGateResultCore(canonical);
    expect(withConflict.weightedScore).toBe(withoutLegacy.weightedScore);
    expect(withConflict.weightedScoreBreakdown?.pillars.destructive_conflict.score).toBe(8);
    expect(withConflict.weightedScoreBreakdown?.pillars.responsiveness_support.score).toBe(8);
    expect(withConflict.weightedScoreBreakdown?.pillars.commitment_persistence.score).toBe(8);
  });

  it('sums pillar contributions to the raw weighted score', () => {
    const r = computeGateResultCore(allMarkers(7));
    const bd = r.weightedScoreBreakdown;
    expect(bd).toBeTruthy();
    const contribSum = Object.values(bd!.pillars).reduce((s, p) => s + p.contribution, 0);
    expect(contribSum).toBeCloseTo(bd!.rawWeightedScore ?? 0, 5);
    expect(bd!.rawWeightedScore).toBe(7);
    expect(bd!.depthModifier).toBe(0);
    expect(bd!.psychometricModifier).toBeNull();
    expect(bd!.finalModifiedScore).toBe(7);
    expect(bd!.pillars.destructive_conflict).toEqual({
      score: 7,
      weight: 0.18,
      contribution: 1.26,
    });
    expect(bd!.pillars.accountability.contribution).toBeCloseTo(1.26, 5);
    expect(bd!.pillars.repair.contribution).toBeCloseTo(1.19, 5);
  });
});
