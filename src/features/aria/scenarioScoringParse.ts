import { collectJsonObjectsFromModelText } from '@utilities/parseHolisticModelJson';
import { remoteLog } from '@utilities/remoteLog';
import { MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE } from './moment4ScoringParse';
import {
  isQuoteOnlyKeyEvidence,
  isScenarioSliceHomogenizedBackfill,
  stripHomogenizedScenarioSliceBackfill,
} from './scenarioConstructEvidenceExtraction';
import {
  coerceScoreToFiniteNumber,
  isIntentionallyRecoveredScoreEvidence,
  isNoEvidenceText,
  isPillarConfidenceOnlyEvidence,
  migratePillarConfidenceLeakedIntoKeyEvidence,
} from './probeEvidenceUtils';

const SCENARIO_SCORE_WRAPPER_KEYS = ['scorecard', 'scores', 'result', 'data', 'output', 'response'] as const;

/** Lift pillarScores/keyEvidence from common model wrapper keys the prompt forbids but models still emit. */
export function unwrapScenarioScorePayloadRoot(parsed: Record<string, unknown>): Record<string, unknown> {
  for (const key of SCENARIO_SCORE_WRAPPER_KEYS) {
    const inner = parsed[key];
    if (inner == null || typeof inner !== 'object' || Array.isArray(inner)) continue;
    const innerObj = inner as Record<string, unknown>;
    const hasScores =
      innerObj.pillarScores != null ||
      innerObj.pillar_scores != null ||
      innerObj.keyEvidence != null ||
      innerObj.key_evidence != null;
    if (!hasScores) continue;
    return { ...parsed, ...innerObj };
  }
  return parsed;
}

function rankScenarioScoreCoercedRecord(coerced: {
  pillarScores: Record<string, unknown>;
  keyEvidence: Record<string, string>;
}): number {
  const psCount = Object.values(coerced.pillarScores).filter(
    (v) => coerceScoreToFiniteNumber(v) !== undefined,
  ).length;
  const keSubstantive = Object.values(coerced.keyEvidence).filter((v) => {
    const t = v.trim();
    return (
      t.length > 0 &&
      !isPillarConfidenceOnlyEvidence(t) &&
      !isQuoteOnlyKeyEvidence(t) &&
      !isIntentionallyRecoveredScoreEvidence(t)
    );
  }).length;
  return psCount * 20 + keSubstantive * 5 + Object.keys(coerced.keyEvidence).length;
}

/**
 * Parse scenario scoring model output: try every JSON object in the response and keep the
 * candidate with the richest pillarScores + substantive keyEvidence (not merely the first `{`).
 */
export function parseScenarioScoreJsonFromModelText(raw: string): Record<string, unknown> {
  const candidates = collectJsonObjectsFromModelText(raw);
  if (candidates.length === 0) {
    throw new SyntaxError('no JSON object found in scenario scoring model output (expected { … })');
  }

  let best: { record: Record<string, unknown>; rank: number } | null = null;
  for (const candidate of candidates) {
    const unwrapped = unwrapScenarioScorePayloadRoot(candidate as Record<string, unknown>);
    const coerced = coerceScenarioScoreParsedModelRecord(unwrapped);
    const rank = rankScenarioScoreCoercedRecord(coerced);
    const record: Record<string, unknown> = {
      ...unwrapped,
      pillarScores: coerced.pillarScores,
      keyEvidence: coerced.keyEvidence,
      ...(Object.keys(coerced.pillarConfidence).length > 0
        ? { pillarConfidence: coerced.pillarConfidence }
        : {}),
    };
    if (!best || rank > best.rank) {
      best = { record, rank };
    }
  }
  return best!.record;
}

export type ScenarioScoreRecoveryStats = {
  scoredMarkerCount: number;
  recoveredMarkerCount: number;
  usedRecoveryPath: boolean;
};

/** True when a majority of scored markers carry the programmatic recovery placeholder. */
export function scenarioScoreRecoveryStats(
  result: {
    pillarScores?: Record<string, number | null | undefined> | null;
    keyEvidence?: Record<string, string> | null;
  },
  markerIds: readonly string[],
): ScenarioScoreRecoveryStats {
  let scoredMarkerCount = 0;
  let recoveredMarkerCount = 0;
  const ps = result.pillarScores ?? {};
  const ke = result.keyEvidence ?? {};
  for (const id of markerIds) {
    if (coerceScoreToFiniteNumber(ps[id]) === undefined) continue;
    scoredMarkerCount++;
    if (isIntentionallyRecoveredScoreEvidence(ke[id])) recoveredMarkerCount++;
  }
  const usedRecoveryPath =
    scoredMarkerCount > 0 && recoveredMarkerCount >= Math.ceil(scoredMarkerCount * 0.5);
  return { scoredMarkerCount, recoveredMarkerCount, usedRecoveryPath };
}

const SCENARIO_SCORE_RAW_LOG_MAX = 4000;

/** Log raw model output and parse failure when salvage / recovery runs. */
export function logScenarioScoreParseRecovery(params: {
  scenarioNumber: 1 | 2 | 3;
  attemptId?: string | null;
  reason: string;
  parseError?: string | null;
  rawModelText: string;
}): void {
  const excerpt =
    params.rawModelText.length > SCENARIO_SCORE_RAW_LOG_MAX
      ? `${params.rawModelText.slice(0, SCENARIO_SCORE_RAW_LOG_MAX)}…`
      : params.rawModelText;
  console.error('[ScoringPipeline] Scenario score parse/recovery', {
    scenarioNumber: params.scenarioNumber,
    attemptId: params.attemptId ?? null,
    reason: params.reason,
    parseError: params.parseError ?? null,
    rawExcerpt: excerpt,
  });
  void remoteLog('[SCENARIO_SCORE_PARSE_RECOVERY]', {
    scenarioNumber: params.scenarioNumber,
    attemptId: params.attemptId ?? null,
    reason: params.reason,
    parseError: params.parseError ?? null,
    rawLength: params.rawModelText.length,
    rawExcerpt: excerpt,
  });
}

export function logScenarioScoreAllScenariosRecoveryCritical(params: {
  attemptId?: string | null;
  userId?: string | null;
  perScenario: Record<1 | 2 | 3, ScenarioScoreRecoveryStats>;
}): void {
  console.error('[ScoringPipeline] CRITICAL: all three scenario scores used recovery path in one run', {
    attemptId: params.attemptId ?? null,
    userId: params.userId ?? null,
    perScenario: params.perScenario,
  });
  void remoteLog('[SCENARIO_SCORE_CRITICAL_ALL_RECOVERY]', {
    attemptId: params.attemptId ?? null,
    userId: params.userId ?? null,
    perScenario: params.perScenario,
  });
}

function migrateKeyEvidenceFromScoringMetadata(
  keyEvidence: Record<string, string>,
  scoringMetadata: unknown,
  markerIds: readonly string[],
): void {
  if (scoringMetadata == null || typeof scoringMetadata !== 'object' || Array.isArray(scoringMetadata)) {
    return;
  }
  const sm = scoringMetadata as Record<string, unknown>;

  const nestedKe = sm.keyEvidence ?? sm.key_evidence;
  if (nestedKe != null && typeof nestedKe === 'object' && !Array.isArray(nestedKe)) {
    for (const [k, v] of Object.entries(nestedKe as Record<string, unknown>)) {
      if (!markerIds.includes(k)) continue;
      if (!keyEvidenceNeedsBackfill(keyEvidence[k])) continue;
      const text = typeof v === 'string' ? v : v == null ? '' : String(v);
      if (text.trim() && !isPillarConfidenceOnlyEvidence(text) && !isQuoteOnlyKeyEvidence(text)) {
        keyEvidence[k] = text.trim();
      }
    }
  }

  const basis = sm.evidence_level_basis;
  if (basis != null && typeof basis === 'object' && !Array.isArray(basis)) {
    for (const id of markerIds) {
      if (!keyEvidenceNeedsBackfill(keyEvidence[id])) continue;
      const note = (basis as Record<string, unknown>)[id];
      if (typeof note === 'string' && note.trim()) {
        keyEvidence[id] = note.trim();
      }
    }
  }
}

/** Coerce per-scenario model JSON (`pillar_scores`, `key_evidence`, etc.) before evidence normalization. */
export function coerceScenarioScoreParsedModelRecord(parsed: unknown): {
  pillarScores: Record<string, unknown>;
  keyEvidence: Record<string, string>;
  pillarConfidence: Record<string, unknown>;
} {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { pillarScores: {}, keyEvidence: {}, pillarConfidence: {} };
  }
  const o = unwrapScenarioScorePayloadRoot(parsed as Record<string, unknown>);
  const psRaw = o.pillarScores ?? o.pillar_scores;
  const pillarScores =
    psRaw != null && typeof psRaw === 'object' && !Array.isArray(psRaw)
      ? { ...(psRaw as Record<string, unknown>) }
      : {};
  const keRaw = o.keyEvidence ?? o.key_evidence;
  const keyEvidence: Record<string, string> = {};
  if (keRaw != null && typeof keRaw === 'object' && !Array.isArray(keRaw)) {
    for (const [k, v] of Object.entries(keRaw as Record<string, unknown>)) {
      keyEvidence[k] = typeof v === 'string' ? v : v == null ? '' : String(v);
    }
  }
  const pcRaw = o.pillarConfidence ?? o.pillar_confidence;
  const pillarConfidence =
    pcRaw != null && typeof pcRaw === 'object' && !Array.isArray(pcRaw)
      ? { ...(pcRaw as Record<string, unknown>) }
      : {};
  return { pillarScores, keyEvidence, pillarConfidence };
}

/** Lift numeric pillar scores from truncated scenario JSON when the parsed object omitted them. */
export function mergeSalvagedScenarioPillarScoresIntoParsed(
  rawModelText: string,
  markerIds: readonly string[],
  pillarScores: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    ...(typeof pillarScores === 'object' && pillarScores && !Array.isArray(pillarScores) ? pillarScores : {}),
  };
  for (const id of markerIds) {
    if (coerceScoreToFiniteNumber(out[id]) !== undefined) continue;
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`["']?${escaped}["']?\\s*[:=]\\s*(-?\\d+(?:\\.\\d+)?)`, 'i');
    const m = rawModelText.match(re);
    if (m?.[1]) {
      const n = Number(m[1]);
      if (Number.isFinite(n)) out[id] = n;
    }
  }
  return out;
}

/** Regex salvage for keyEvidence strings omitted when JSON truncates after pillarScores. */
export function mergeSalvagedScenarioKeyEvidenceFromRaw(
  rawModelText: string,
  markerIds: readonly string[],
  keyEvidence: Record<string, string>,
): Record<string, string> {
  const out = { ...keyEvidence };
  for (const id of markerIds) {
    const existing = out[id]?.trim();
    if (
      existing &&
      !isPillarConfidenceOnlyEvidence(existing) &&
      !isScenarioSliceHomogenizedBackfill(existing) &&
      !isQuoteOnlyKeyEvidence(existing)
    ) {
      continue;
    }
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`["']?${escaped}["']?\\s*:\\s*"([^"\\\\]*(?:\\\\.[^"\\\\]*)*)"`, 'i');
    const m = rawModelText.match(re);
    if (m?.[1]) {
      const unescaped = m[1].replace(/\\"/g, '"').trim();
      if (unescaped && !isQuoteOnlyKeyEvidence(unescaped) && !isPillarConfidenceOnlyEvidence(unescaped)) {
        out[id] = unescaped;
      }
    }
  }
  return out;
}

/**
 * Before {@link normalizeScoresByEvidence}: salvage per-marker keyEvidence from raw model JSON,
 * then backfill any marker that still has confidence-only or missing evidence.
 */
export function prepareScenarioKeyEvidenceFromModelOutput(
  markerIds: readonly string[],
  result: {
    pillarScores?: Record<string, number | null | undefined> | null;
    keyEvidence?: Record<string, string> | null;
    pillarConfidence?: Record<string, string> | null;
    scoringMetadata?: Record<string, unknown> | null;
  },
  scenarioUserText: string,
  rawModelText?: string,
): void {
  const next: Record<string, string> = { ...(result.keyEvidence ?? {}) };
  const pillarConfidence =
    result.pillarConfidence != null && typeof result.pillarConfidence === 'object'
      ? { ...(result.pillarConfidence as Record<string, string>) }
      : undefined;
  migrateKeyEvidenceFromScoringMetadata(next, result.scoringMetadata, markerIds);
  migratePillarConfidenceLeakedIntoKeyEvidence(next, pillarConfidence);
  if (pillarConfidence) {
    result.pillarConfidence = pillarConfidence;
  }
  if (rawModelText) {
    Object.assign(
      next,
      mergeSalvagedScenarioKeyEvidenceFromRaw(rawModelText, markerIds, next),
    );
  }
  stripHomogenizedScenarioSliceBackfill(next, markerIds);
  stripQuoteOnlyKeyEvidenceEntries(next, markerIds);
  result.keyEvidence = next;
}

function stripQuoteOnlyKeyEvidenceEntries(
  keyEvidence: Record<string, string>,
  markerIds: readonly string[],
): void {
  for (const id of markerIds) {
    if (isQuoteOnlyKeyEvidence(keyEvidence[id])) {
      delete keyEvidence[id];
    }
  }
}

/**
 * After elaboration / depth heuristics: backfill per-marker evidence only where still
 * missing or non-analytical. Must not run before heuristics — programmatic recovered lines
 * mask confidence-only model output and incorrectly trigger Level 1 score caps.
 */
export function finalizeScenarioKeyEvidenceAfterHeuristics(
  markerIds: readonly string[],
  result: {
    pillarScores?: Record<string, number | null | undefined> | null;
    keyEvidence?: Record<string, string> | null;
  },
  scenarioUserText: string,
): void {
  fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote(markerIds, result, scenarioUserText);
}

function keyEvidenceNeedsBackfill(ev: string | undefined): boolean {
  const trimmed = ev?.trim() ?? '';
  if (!trimmed) return true;
  if (isNoEvidenceText(trimmed)) return true;
  if (isPillarConfidenceOnlyEvidence(trimmed)) return true;
  if (isScenarioSliceHomogenizedBackfill(trimmed)) return true;
  if (isQuoteOnlyKeyEvidence(trimmed)) return true;
  return false;
}

/**
 * Before {@link normalizeScoresByEvidence}: ensure each numeric marker has assessable evidence.
 * Prefer model per-marker analytical narratives (salvaged above); otherwise use recovered line —
 * never raw quote-only backfill.
 */
export function fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote(
  markerIds: readonly string[],
  result: {
    pillarScores?: Record<string, number | null | undefined> | null;
    keyEvidence?: Record<string, string> | null;
  },
  _scenarioUserText: string,
): void {
  const ps = result.pillarScores;
  if (!ps || typeof ps !== 'object' || Array.isArray(ps)) return;
  const next: Record<string, string> = { ...(result.keyEvidence ?? {}) };
  for (const id of markerIds) {
    if (coerceScoreToFiniteNumber(ps[id]) === undefined) continue;
    const ev = next[id]?.trim();
    if (!keyEvidenceNeedsBackfill(ev)) continue;
    next[id] = MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE;
  }
  result.keyEvidence = next;
}