import { isPersonalMomentTranscriptTurn } from './defensePatternsDetection';
import { enrichScenarioSliceWithContemptHeuristic } from './contemptExpressionScenarioHeuristic';
import type { GateResult } from './computeGateResultCore';
import { fullScenarioReconciliation, type ReconcilableScenarioSlice } from './reconcileScenarioScoresTranscript';
import { sanitizeScenarioKeyEvidenceRecord } from './sanitizeScenarioKeyEvidenceForPersist';

export type TranscriptMsg = { role?: string; content?: string; scenarioNumber?: number; interviewMoment?: number };

export function parseObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return typeof p === 'object' && p != null && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

export function userTextForScenario(transcript: unknown, scenarioNum: 1 | 2 | 3): string {
  if (!Array.isArray(transcript)) return '';
  return (transcript as TranscriptMsg[])
    .filter(
      (m) =>
        m.role === 'user' &&
        m.scenarioNumber === scenarioNum &&
        typeof m.content === 'string' &&
        !isPersonalMomentTranscriptTurn(m),
    )
    .map((m) => String(m.content).trim())
    .filter(Boolean)
    .join(' ');
}

export function extractSlice(raw: unknown): {
  pillarScores?: Record<string, number | null>;
  keyEvidence?: Record<string, string>;
  pillarConfidence?: Record<string, string>;
  mentalizing_overcertainty?: boolean;
} | null {
  const obj = parseObject(raw);
  if (!obj) return null;
  const ps = obj.pillarScores ?? obj.pillar_scores;
  const ke = obj.keyEvidence ?? obj.key_evidence;
  const pc = obj.pillarConfidence ?? obj.pillar_confidence;
  if (ps == null && ke == null) return null;
  return {
    pillarScores:
      typeof ps === 'object' && ps != null && !Array.isArray(ps) ? (ps as Record<string, number | null>) : undefined,
    keyEvidence:
      typeof ke === 'object' && ke != null && !Array.isArray(ke) ? (ke as Record<string, string>) : undefined,
    pillarConfidence:
      typeof pc === 'object' && pc != null && !Array.isArray(pc) ? (pc as Record<string, string>) : undefined,
    mentalizing_overcertainty: obj.mentalizing_overcertainty === true,
  };
}

export function toReconcilableSlice(
  raw: unknown,
  scenarioNumber: 1 | 2 | 3
): ReconcilableScenarioSlice | null {
  const ex = extractSlice(raw);
  if (!ex?.pillarScores && !ex?.keyEvidence) return null;
  return {
    scenarioNumber,
    pillarScores: ex.pillarScores ?? {},
    pillarConfidence: ex.pillarConfidence ?? {},
    keyEvidence: ex.keyEvidence ?? {},
  };
}

export function buildGateNotes(gate: GateResult): string[] {
  const notes: string[] = [];
  if (gate.failReason) notes.push(`gate: ${gate.failReason}`);
  const d = gate.failReasonDetail;
  if (d?.mentalizing_floor?.lowScenarios?.length) {
    notes.push(
      `mentalizing floor: scenarios ${d.mentalizing_floor.lowScenarios.map((x) => x.scenario).join(', ')}`
    );
  }
  if (d?.repair_floor?.lowScenarios?.length) {
    notes.push(`repair floor: scenarios ${d.repair_floor.lowScenarios.map((x) => x.scenario).join(', ')}`);
  }
  if (d?.ego_development_floor) {
    const e = d.ego_development_floor;
    notes.push(`ego development floor: level ${e.level}, weighted ${e.weightedScore.toFixed(1)}`);
  }
  if (d?.scenario_floor?.breaches?.length) {
    notes.push(
      `scenario composite floor: ${d.scenario_floor.breaches.map((b) => `S${b.scenario}=${b.composite.toFixed(2)}`).join('; ')}`
    );
  }
  return notes;
}

export function scenarioSliceFromStored(
  raw: ReconcilableScenarioSlice,
  txArr: TranscriptMsg[],
  scenarioNumber: 1 | 2 | 3,
  skipMutations: boolean,
): { pillarScores?: Record<string, number | null>; keyEvidence?: Record<string, string> } | null {
  if (skipMutations) {
    return {
      pillarScores: raw.pillarScores as Record<string, number | null>,
      keyEvidence: sanitizeScenarioKeyEvidenceRecord(raw.keyEvidence),
    };
  }
  const reco = fullScenarioReconciliation(raw, txArr);
  return enrichScenarioSliceWithContemptHeuristic(
    { pillarScores: reco.pillarScores, keyEvidence: reco.keyEvidence },
    userTextForScenario(txArr, scenarioNumber),
  );
}
