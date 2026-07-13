import { describe, expect, it } from '@jest/globals';

import type { GateResult } from '@features/aria/computeGateResultCore';
import { GATE_PASS_WEIGHTED_MIN } from '@features/aria/computeGateResultCore';
import { GATE_MARKER_FLOORS } from '@config/scoring/interviewGateThresholds';
import {
  ADMIN_ALMOST_FLOOR_MARGIN,
  ADMIN_ALMOST_WEIGHTED_MARGIN,
} from '@config/scoring/adminDisplayMargins';
import {
  classifyAdminGateOutcome,
  formatGateFailureLines,
  isAlmostPassingGate,
  summarizeGateForAdmin,
} from '../adminGateDisplay';

function gate(partial: Partial<GateResult> & Pick<GateResult, 'pass' | 'reason'>): GateResult {
  return {
    weightedScore: null,
    failingConstruct: null,
    failingScore: null,
    assessedMarkerCount: 0,
    excludedMarkers: [],
    failReason: null,
    reviewFlags: [],
    ...partial,
  };
}

describe('adminGateDisplay', () => {
  it('returns empty failure lines for pass and no_assessed_markers', () => {
    const scores = { repair: 7, regulation: 7 };
    expect(formatGateFailureLines(gate({ pass: true, reason: 'pass', weightedScore: 7 }), scores)).toEqual([]);
    expect(
      formatGateFailureLines(gate({ pass: false, reason: 'no_assessed_markers' }), scores),
    ).toEqual([]);
  });

  it('lists floor breaches with marker labels', () => {
    const scores = { repair: 4.2, regulation: 7, accountability: 7, contempt: 7 };
    const lines = formatGateFailureLines(
      gate({ pass: false, reason: 'floor_breach', weightedScore: 6.8 }),
      scores,
    );
    expect(lines.some((l) => l.includes('Repair') && l.includes('4.2'))).toBe(true);
    expect(lines.some((l) => l.includes(String(GATE_MARKER_FLOORS.repair)))).toBe(true);
  });

  it('formats structured weighted_score fail detail', () => {
    const lines = formatGateFailureLines(
      gate({
        pass: false,
        reason: 'weighted_below_threshold',
        weightedScore: 6.1,
        failReasonCodes: ['weighted_score'],
        failReasonDetail: { weighted_score: { score: 6.1, requiredMin: GATE_PASS_WEIGHTED_MIN } },
      }),
      {},
    );
    expect(lines).toEqual([`Weighted average: 6.1 (min ${GATE_PASS_WEIGHTED_MIN.toFixed(1)})`]);
  });

  it('classifies almost-pass when weighted score is within admin margin', () => {
    const almostMin = GATE_PASS_WEIGHTED_MIN - ADMIN_ALMOST_WEIGHTED_MARGIN;
    const scores = { repair: 7, regulation: 7 };
    const gateResult = gate({
      pass: false,
      reason: 'weighted_below_threshold',
      weightedScore: almostMin,
    });
    expect(isAlmostPassingGate(gateResult, scores)).toBe(true);
    expect(classifyAdminGateOutcome(scores, gateResult).label).toBe('almost');
  });

  it('classifies almost-pass when a floored marker is within admin floor margin', () => {
    const repairFloor = GATE_MARKER_FLOORS.repair!;
    const scores = { repair: repairFloor - ADMIN_ALMOST_FLOOR_MARGIN + 0.01, regulation: 7 };
    const gateResult = gate({
      pass: false,
      reason: 'floor_breach',
      weightedScore: 6.2,
    });
    expect(isAlmostPassingGate(gateResult, scores)).toBe(true);
    expect(classifyAdminGateOutcome(scores, gateResult).label).toBe('almost');
  });

  it('classifies hard fail when well below thresholds', () => {
    const scores = { repair: 3, regulation: 3 };
    const gateResult = gate({
      pass: false,
      reason: 'floor_breach',
      weightedScore: 4.5,
    });
    expect(classifyAdminGateOutcome(scores, gateResult).label).toBe('fail');
  });

  it('summarizeGateForAdmin joins detail lines for floor breach', () => {
    const scores = { repair: 4, regulation: 7 };
    const summary = summarizeGateForAdmin(
      scores,
      gate({ pass: false, reason: 'floor_breach', weightedScore: 6 }),
    );
    expect(summary).toMatch(/Repair/);
    expect(summary).toMatch(/floor 5\.0/);
  });

  it('summarizeGateForAdmin uses weighted detail line when below threshold', () => {
    const summary = summarizeGateForAdmin(
      { repair: 7 },
      gate({
        pass: false,
        reason: 'weighted_below_threshold',
        weightedScore: 6.1,
      }),
    );
    expect(summary).toBe(`Weighted average: 6.1 (min ${GATE_PASS_WEIGHTED_MIN.toFixed(1)})`);
  });
});
