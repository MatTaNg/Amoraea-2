import {
  MARKER_IDS,
  PILLAR_ROWS,
  SLICE_CONTEMPT_EXTRA_KEYS,
} from '@features/admin/interviewDashboard/adminInterviewDashboardConstants';
import type { AttemptRow, AttemptSummary } from '@features/admin/interviewDashboard/adminInterviewDashboardTypes';

export function getString(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

export function coerceScoreNumber(v: unknown): number | undefined {
  if (v == null || v === '') return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function formatScoreCell(v: unknown): string {
  const n = coerceScoreNumber(v);
  return n === undefined ? '—' : n.toFixed(1);
}

/**
 * interview_attempts.pillar_scores and scenario_*_scores jsonb may arrive as:
 * - parsed object, JSON string, nested { pillarScores } / { pillar_scores }, or numeric strings.
 */
export function normalizePillarScoresMap(raw: unknown): Record<string, number> | null {
  if (raw == null) return null;
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return null;
  const o = obj as Record<string, unknown>;
  const nested = o.pillarScores ?? o.pillar_scores;
  const source =
    nested != null && typeof nested === 'object' && !Array.isArray(nested)
      ? (nested as Record<string, unknown>)
      : o;
  const out: Record<string, number> = {};
  for (const id of MARKER_IDS) {
    const n = coerceScoreNumber(source[id]);
    if (n !== undefined) out[id] = n;
  }
  for (const id of SLICE_CONTEMPT_EXTRA_KEYS) {
    const n = coerceScoreNumber(source[id]);
    if (n !== undefined) out[id] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function pillarScoresFromAIReasoning(ai: unknown): Record<string, number> | null {
  if (ai == null || typeof ai !== 'object') return null;
  const breakdown = (ai as Record<string, unknown>).construct_breakdown;
  if (breakdown == null || typeof breakdown !== 'object' || Array.isArray(breakdown)) return null;
  const b = breakdown as Record<string, { score?: unknown }>;
  const out: Record<string, number> = {};
  for (const id of MARKER_IDS) {
    const n = coerceScoreNumber(b[id]?.score);
    if (n !== undefined) out[id] = n;
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Merge DB pillar_scores with construct_breakdown scores when column is empty or partial. */
export function getResolvedPillarScores(a: AttemptRow | null | undefined): Record<string, number> {
  if (!a) return {};
  const fromDb = normalizePillarScoresMap(a.pillar_scores);
  const fromAi = pillarScoresFromAIReasoning(a.ai_reasoning);
  return { ...(fromAi ?? {}), ...(fromDb ?? {}) };
}

export function getScenarioPillarScoresMap(raw: unknown): Record<string, number> | null {
  if (raw == null) return null;
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try {
      obj = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const o = obj as Record<string, unknown>;
  const innerRaw = o.pillarScores ?? o.pillar_scores;
  if (innerRaw != null && typeof innerRaw === 'object' && !Array.isArray(innerRaw)) {
    return normalizePillarScoresMap(innerRaw);
  }
  if (typeof innerRaw === 'string') {
    return normalizePillarScoresMap(innerRaw);
  }
  return normalizePillarScoresMap(o);
}

export function parseObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'object' && parsed != null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/** Preview contempt for a single slice (sub-keys or legacy `contempt`), aligned with 70/30 pillar weighting when both strands exist. */
export function sliceContemptDisplayValue(scores: Record<string, number> | null | undefined): number | undefined {
  if (!scores) return undefined;
  const exp = coerceScoreNumber(scores.contempt_expression);
  const recOnly = coerceScoreNumber(scores.contempt_recognition);
  const legacy = coerceScoreNumber(scores.contempt);
  const e = exp ?? legacy;
  const r = recOnly ?? (legacy != null && exp == null && recOnly == null ? legacy : undefined);
  if (e != null && r != null) return Math.round((0.6 * e + 0.4 * r) * 10) / 10;
  return e ?? r;
}

export function formatConstruct(key: string): string {
  const row = PILLAR_ROWS.find((r) => r.id === key || r.constructKey === key);
  return row?.label ?? key?.replace(/_/g, ' ') ?? '—';
}

/** Pillar map for gate recompute: list rows use DB only; drill-down merges AI reasoning like the app. */
export function pillarScoresForGate(a: AttemptSummary | AttemptRow | null): Record<string, number> {
  if (!a) return {};
  if ('ai_reasoning' in a && (a as AttemptRow).ai_reasoning !== undefined) {
    return getResolvedPillarScores(a as AttemptRow);
  }
  return normalizePillarScoresMap((a as AttemptSummary).pillar_scores) ?? {};
}
