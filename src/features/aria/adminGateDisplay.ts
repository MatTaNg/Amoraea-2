import {
  GATE_MARKER_FLOORS,
  GATE_PASS_WEIGHTED_MIN,
  type GateResult,
} from '@features/aria/computeGateResultCore';
import {
  INTERVIEW_MARKER_IDS,
  INTERVIEW_MARKER_LABELS,
  type InterviewMarkerId,
} from '@features/aria/interviewMarkers';

/** Weighted average within this many points of the pass minimum → "almost" (human review). */
export const ADMIN_ALMOST_WEIGHTED_MARGIN = 0.4;

/** Floor miss within this many points of the floor → "almost" on that construct. */
export const ADMIN_ALMOST_FLOOR_MARGIN = 0.35;

export type AdminGateOutcomeLabel = 'pass' | 'fail' | 'almost' | 'none';

export function formatGateFailureLines(gate: GateResult, scores: Record<string, number>): string[] {
  if (gate.pass || gate.reason === 'no_assessed_markers') {
    return [];
  }
  const lines: string[] = [];
  if (gate.reason === 'floor_breach') {
    const breaches: Array<{ id: InterviewMarkerId; score: number; floor: number }> = [];
    for (const id of INTERVIEW_MARKER_IDS) {
      const floor = GATE_MARKER_FLOORS[id];
      const s = scores[id];
      if (floor === undefined || typeof s !== 'number' || !Number.isFinite(s)) continue;
      if (s < floor) {
        breaches.push({ id, score: s, floor });
      }
    }
    breaches.sort((a, b) => a.id.localeCompare(b.id));
    for (const b of breaches) {
      const label = INTERVIEW_MARKER_LABELS[b.id] ?? b.id;
      lines.push(`${label}: ${b.score.toFixed(1)} (floor ${b.floor.toFixed(1)})`);
    }
  }
  if (gate.reason === 'weighted_below_threshold' && gate.weightedScore != null) {
    lines.push(`Weighted average: ${gate.weightedScore.toFixed(1)} (min ${GATE_PASS_WEIGHTED_MIN.toFixed(1)})`);
  }
  return lines;
}

/**
 * Whether this failed gate is close enough on overall or any floored construct to flag for human review.
 */
export function isAlmostPassingGate(gate: GateResult, scores: Record<string, number>): boolean {
  if (gate.pass || gate.reason === 'no_assessed_markers') return false;

  if (gate.weightedScore != null && gate.weightedScore >= GATE_PASS_WEIGHTED_MIN - ADMIN_ALMOST_WEIGHTED_MARGIN) {
    return true;
  }

  for (const id of INTERVIEW_MARKER_IDS) {
    const floor = GATE_MARKER_FLOORS[id];
    const s = scores[id];
    if (floor === undefined || typeof s !== 'number' || !Number.isFinite(s)) continue;
    if (s < floor && s >= floor - ADMIN_ALMOST_FLOOR_MARGIN) {
      return true;
    }
  }

  return false;
}

export function classifyAdminGateOutcome(
  scores: Record<string, number>,
  gate: GateResult,
): { label: AdminGateOutcomeLabel; detailLines: string[] } {
  if (Object.keys(scores).length === 0 || gate.reason === 'no_assessed_markers') {
    return { label: 'none', detailLines: [] };
  }
  if (gate.pass) {
    return { label: 'pass', detailLines: [] };
  }
  const detailLines = formatGateFailureLines(gate, scores);
  if (isAlmostPassingGate(gate, scores)) {
    return { label: 'almost', detailLines };
  }
  return { label: 'fail', detailLines };
}

/** Single-line summary for compact UI (e.g. user card). */
export function summarizeGateForAdmin(scores: Record<string, number>, gate: GateResult): string | null {
  const { detailLines } = classifyAdminGateOutcome(scores, gate);
  if (detailLines.length === 0) {
    if (!gate.pass && gate.reason === 'weighted_below_threshold' && gate.weightedScore != null) {
      return `Weighted ${gate.weightedScore.toFixed(1)} < ${GATE_PASS_WEIGHTED_MIN.toFixed(1)}`;
    }
    return null;
  }
  return detailLines.join(' · ');
}
