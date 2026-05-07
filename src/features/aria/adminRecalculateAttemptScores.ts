import type { MarkerScoreSlice } from './aggregateMarkerScoresFromSlices';
import { aggregatePillarScoresWithCommitmentMergeDetailed } from './aggregateMarkerScoresFromSlices';
import { enrichScenarioSliceWithContemptHeuristic } from './contemptExpressionScenarioHeuristic';
import type { ComputeGateResultOptions, GateResult } from './computeGateResultCore';
import { computeGateResultCore } from './computeGateResultCore';
import type { CompletionGateFailure } from './interviewCompletionGate';
import {
  buildIncompleteInterviewGateResult,
  evaluateInterviewCompletionGate,
} from './interviewCompletionGate';
import { INTERVIEW_MARKER_IDS } from './interviewMarkers';
import {
  sanitizeMoment5PersonalScoresForAggregate,
  sanitizePersonalMomentScoresForAggregate,
} from './personalMomentSliceSanitize';
import { fullScenarioReconciliation, type ReconcilableScenarioSlice } from './reconcileScenarioScoresTranscript';
import { scenarioCompositesToStorageJson } from './scenarioCompositeFloor';
import { computeSkipPenaltyGateComputation } from './interviewSkipPenalties';

function parseObject(raw: unknown): Record<string, unknown> | null {
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

type TranscriptMsg = { role?: string; content?: string; scenarioNumber?: number };

function userTextForScenario(transcript: unknown, scenarioNum: 1 | 2 | 3): string {
  if (!Array.isArray(transcript)) return '';
  return (transcript as TranscriptMsg[])
    .filter((m) => m.role === 'user' && m.scenarioNumber === scenarioNum && typeof m.content === 'string')
    .map((m) => String(m.content).trim())
    .filter(Boolean)
    .join(' ');
}

function extractSlice(raw: unknown): {
  pillarScores?: Record<string, number | null>;
  keyEvidence?: Record<string, string>;
  pillarConfidence?: Record<string, string>;
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
  };
}

function toReconcilableSlice(
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

export type AdminRecalculateAttemptInput = {
  transcript: unknown;
  scenario_1_scores: unknown;
  scenario_2_scores: unknown;
  scenario_3_scores: unknown;
  scenario_specific_patterns: unknown;
};

export type AdminRecalculateSuccess = {
  kind: 'success';
  pillar_scores: Record<string, number>;
  gate: GateResult;
  notes: string[];
  scenarioCompositesJson: Record<string, unknown> | null;
};

export type AdminRecalculateIncomplete = {
  kind: 'incomplete';
  gate: GateResult;
  notes: string[];
  completionFailure: CompletionGateFailure;
};

export type AdminRecalculateResult = AdminRecalculateSuccess | AdminRecalculateIncomplete;

function buildGateNotes(gate: GateResult): string[] {
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
  if (d?.scenario_floor?.breaches?.length) {
    notes.push(
      `scenario composite floor: ${d.scenario_floor.breaches.map((b) => `S${b.scenario}=${b.composite.toFixed(2)}`).join('; ')}`
    );
  }
  return notes;
}

/**
 * Re-run pillar aggregation + weighted gate from stored scenario/moment JSON and transcript (reconciliation + heuristics only — no LLM/TTS/audio).
 */
export function recalculateAttemptScoresFromStoredSlices(input: AdminRecalculateAttemptInput): AdminRecalculateResult {
  const patterns = parseObject(input.scenario_specific_patterns);
  const m4Raw = parseObject(patterns?.moment_4_scores);
  const m5Raw = parseObject(patterns?.moment_5_scores);
  const tx = input.transcript;
  const txArr = (Array.isArray(tx) ? tx : []) as TranscriptMsg[];

  const completionGate = evaluateInterviewCompletionGate({
    scenario1: input.scenario_1_scores,
    scenario2: input.scenario_2_scores,
    scenario3: input.scenario_3_scores,
    moment4: m4Raw,
  });

  if (!completionGate.ok) {
    const gate = buildIncompleteInterviewGateResult(completionGate);
    const notes: string[] = [
      `completion gate: ${completionGate.detail}`,
      `weighted score withheld — incomplete data`,
    ];
    return { kind: 'incomplete', gate, notes, completionFailure: completionGate };
  }

  const raw1 = toReconcilableSlice(input.scenario_1_scores, 1);
  const raw2 = toReconcilableSlice(input.scenario_2_scores, 2);
  const raw3 = toReconcilableSlice(input.scenario_3_scores, 3);
  if (!raw1 || !raw2 || !raw3) {
    const failure: CompletionGateFailure = {
      ok: false,
      incomplete_reason: 'missing_scenario_bundle',
      missingScenarioNumbers: [!raw1 ? 1 : !raw2 ? 2 : 3],
      missingMoment4: false,
      detail: 'scenario slice could not be parsed for reconciliation',
    };
    return {
      kind: 'incomplete',
      gate: buildIncompleteInterviewGateResult(failure),
      notes: ['completion gate: scenario bundle unparsed — weighted score withheld'],
      completionFailure: failure,
    };
  }

  const reco1 = fullScenarioReconciliation(raw1, txArr);
  const reco2 = fullScenarioReconciliation(raw2, txArr);
  const reco3 = fullScenarioReconciliation(raw3, txArr);

  const s1 = enrichScenarioSliceWithContemptHeuristic(
    { pillarScores: reco1.pillarScores, keyEvidence: reco1.keyEvidence },
    userTextForScenario(tx, 1)
  );
  const s2 = enrichScenarioSliceWithContemptHeuristic(
    { pillarScores: reco2.pillarScores, keyEvidence: reco2.keyEvidence },
    userTextForScenario(tx, 2)
  );
  const s3 = enrichScenarioSliceWithContemptHeuristic(
    { pillarScores: reco3.pillarScores, keyEvidence: reco3.keyEvidence },
    userTextForScenario(tx, 3)
  );

  const m4Input =
    m4Raw != null
      ? {
          momentNumber: 4 as const,
          pillarScores: (m4Raw.pillarScores as Record<string, number | null>) ?? {},
          keyEvidence:
            typeof m4Raw.keyEvidence === 'object' && m4Raw.keyEvidence != null && !Array.isArray(m4Raw.keyEvidence)
              ? (m4Raw.keyEvidence as Record<string, string>)
              : undefined,
        }
      : null;
  const m5Input =
    m5Raw != null
      ? {
          momentNumber: 5 as const,
          pillarScores: (m5Raw.pillarScores as Record<string, number | null>) ?? {},
          keyEvidence:
            typeof m5Raw.keyEvidence === 'object' && m5Raw.keyEvidence != null && !Array.isArray(m5Raw.keyEvidence)
              ? (m5Raw.keyEvidence as Record<string, string>)
              : undefined,
        }
      : null;

  const m4San = m4Input ? sanitizePersonalMomentScoresForAggregate(m4Input) : null;
  const m5San = m5Input ? sanitizeMoment5PersonalScoresForAggregate(m5Input) : null;

  const slices: MarkerScoreSlice[] = [
    s1,
    s2,
    s3,
    m4San ? { pillarScores: m4San.pillarScores, keyEvidence: m4San.keyEvidence } : null,
    m5San ? { pillarScores: m5San.pillarScores, keyEvidence: m5San.keyEvidence } : null,
  ];
  const { scores: pillar_scores } = aggregatePillarScoresWithCommitmentMergeDetailed(slices);

  const scenarioPillarScoresByScenario: NonNullable<ComputeGateResultOptions['scenarioPillarScoresByScenario']> = {
    1: s1?.pillarScores,
    2: s2?.pillarScores,
    3: s3?.pillarScores,
  };

  const skipCountRaw = input.skip_count;
  const skipCount =
    typeof skipCountRaw === 'number' && Number.isFinite(skipCountRaw)
      ? skipCountRaw
      : typeof skipCountRaw === 'string' && skipCountRaw.trim() !== ''
        ? Number.parseInt(skipCountRaw, 10)
        : 0;
  const skipGate = computeSkipPenaltyGateComputation(Number.isFinite(skipCount) ? skipCount : 0);

  const gate = computeGateResultCore(pillar_scores, null, {
    scenarioPillarScoresByScenario,
    skipPenaltyTotal: skipGate.skipPenaltyTotal,
    skipAutoFail: skipGate.skipAutoFail,
  });

  const notes: string[] = [...buildGateNotes(gate)];
  if (notes.length === 0) notes.push('gate: pass — all current rubric checks satisfied');

  return {
    kind: 'success',
    pillar_scores,
    gate,
    notes,
    scenarioCompositesJson: scenarioCompositesToStorageJson(gate.scenarioComposites),
  };
}

/** Per-pillar deltas (new minus old), only where both exist; omit zeros to keep payload small. */
export function computePillarScoreDelta(
  oldMap: Record<string, number | null | undefined>,
  newMap: Record<string, number | null | undefined>
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of INTERVIEW_MARKER_IDS) {
    const o = oldMap[id];
    const n = newMap[id];
    if (typeof o === 'number' && Number.isFinite(o) && typeof n === 'number' && Number.isFinite(n)) {
      const d = Math.round((n - o) * 10) / 10;
      if (d !== 0) out[id] = d;
    }
  }
  return out;
}

export function snapshotAttemptScoresForAudit(row: {
  pillar_scores?: unknown;
  weighted_score?: unknown;
  passed?: unknown;
  gate_fail_reason?: unknown;
  gate_fail_reasons?: unknown;
  gate_fail_detail?: unknown;
  scenario_composites?: unknown;
  incomplete_reason?: unknown;
}): Record<string, unknown> {
  return {
    pillar_scores: row.pillar_scores ?? null,
    weighted_score: row.weighted_score ?? null,
    passed: row.passed ?? null,
    gate_fail_reason: row.gate_fail_reason ?? null,
    gate_fail_reasons: row.gate_fail_reasons ?? null,
    gate_fail_detail: row.gate_fail_detail ?? null,
    scenario_composites: row.scenario_composites ?? null,
    incomplete_reason: row.incomplete_reason ?? null,
    captured_at: new Date().toISOString(),
  };
}
