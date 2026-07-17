/**
 * Anthropic sometimes returns prose before JSON ("Looking at…") or multiple `{` regions.
 * Same strategy as supabase/functions/_shared/completeStandardInterviewCore.ts.
 */
function extractBalancedJsonObjectFrom(s: string, start: number): string | null {
  if (s[start] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/** Same 1–5 coercion as gate/holistic extraction (local copy so this module stays free of `features/` imports). */
function coerceHolisticEgoLevelToIntLocal(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && String(raw).trim() !== ''
        ? Number(String(raw).trim())
        : NaN;
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < 1 || r > 5) return null;
  return r;
}

function egoLevelFromHolisticRecord(parsed: Record<string, unknown>): number | null {
  const candidates: unknown[] = [parsed.ego_development_level, parsed.egoDevelopmentLevel];
  const pillarScores = parsed.pillarScores ?? parsed.pillar_scores;
  if (pillarScores != null && typeof pillarScores === 'object' && !Array.isArray(pillarScores)) {
    const ps = pillarScores as Record<string, unknown>;
    candidates.push(ps.ego_development_level, ps.egoDevelopmentLevel);
  }
  for (const c of candidates) {
    const n = coerceHolisticEgoLevelToIntLocal(c);
    if (n != null) return n;
  }
  return null;
}

function rankHolisticCoercedCandidate(coerced: Record<string, unknown>): number {
  const ego = egoLevelFromHolisticRecord(coerced);
  const ps = coerced.pillarScores ?? coerced.pillar_scores;
  const nPillars =
    ps != null && typeof ps === 'object' && !Array.isArray(ps) ? Object.keys(ps as Record<string, unknown>).length : 0;
  return (ego != null ? 1000 : 0) + nPillars;
}

/** When structured parse drops ego, recover ego from raw model text; last accepted match wins. */
function tryExtractEgoLevelFromHolisticRawText(raw: string): number | null {
  const patterns: RegExp[] = [
    /"ego_development_level"\s*:\s*([1-5](?:\.\d+)?)\b/g,
    /"egoDevelopmentLevel"\s*:\s*([1-5](?:\.\d+)?)\b/g,
    /ego\s*development\s*level\s*[:=]\s*([1-5])\b/gi,
  ];
  let last: number | null = null;
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const n = coerceHolisticEgoLevelToIntLocal(Number(m[1]));
      if (n != null) last = n;
    }
  }
  return last;
}

/**
 * Holistic interview model output: collect every parseable `{…}` region (plus whole-string JSON),
 * coerce each with {@link coerceHolisticInterviewModelObject}, then pick the candidate with the best
 * `ego_development_level` + pillar count — matches `parseHolisticJsonFromModelText` on the Edge function.
 * Use this instead of {@link parseJsonObjectFromModelText} for holistic scoring so ego is not dropped
 * when the model emits multiple JSON objects or a shallow wrapper.
 */
export function parseHolisticInterviewModelObjectFromModelText(raw: string): Record<string, unknown> {
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  const objectAttempts: Record<string, unknown>[] = [];
  const pushParsed = (obj: unknown) => {
    if (obj != null && typeof obj === 'object' && !Array.isArray(obj)) {
      objectAttempts.push(coerceHolisticInterviewModelObject(obj));
    }
  };

  try {
    pushParsed(JSON.parse(cleaned));
  } catch {
    /* fall through */
  }

  let searchFrom = 0;
  let lastErr = 'no JSON object found in model output (expected { … })';
  const maxTries = 100;
  for (let t = 0; t < maxTries; t++) {
    const start = cleaned.indexOf('{', searchFrom);
    if (start < 0) break;
    const extracted = extractBalancedJsonObjectFrom(cleaned, start);
    if (!extracted) {
      searchFrom = start + 1;
      continue;
    }
    try {
      pushParsed(JSON.parse(extracted));
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    searchFrom = start + 1;
  }

  const seen = new Set<string>();
  const unique: Record<string, unknown>[] = [];
  for (const c of objectAttempts) {
    const sig = JSON.stringify(c);
    if (seen.has(sig)) continue;
    seen.add(sig);
    unique.push(c);
  }

  if (unique.length === 0) {
    throw new SyntaxError(lastErr);
  }

  let bestCoerced = unique[0]!;
  let bestRank = rankHolisticCoercedCandidate(bestCoerced);
  for (let i = 1; i < unique.length; i++) {
    const c = unique[i]!;
    const r = rankHolisticCoercedCandidate(c);
    if (r > bestRank) {
      bestRank = r;
      bestCoerced = c;
    }
  }
  if (egoLevelFromHolisticRecord(bestCoerced) == null) {
    const salvaged = tryExtractEgoLevelFromHolisticRawText(raw);
    if (salvaged != null) {
      return { ...bestCoerced, ego_development_level: salvaged };
    }
  }
  return bestCoerced;
}

/** Collect every parseable top-level `{…}` object from model text (whole string + balanced slices). */
export function collectJsonObjectsFromModelText(raw: string): unknown[] {
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  const objectAttempts: unknown[] = [];
  const pushParsed = (obj: unknown) => {
    if (obj != null && typeof obj === 'object' && !Array.isArray(obj)) {
      objectAttempts.push(obj);
    }
  };

  try {
    pushParsed(JSON.parse(cleaned));
  } catch {
    /* fall through */
  }

  let searchFrom = 0;
  const maxTries = 100;
  for (let t = 0; t < maxTries; t++) {
    const start = cleaned.indexOf('{', searchFrom);
    if (start < 0) break;
    const extracted = extractBalancedJsonObjectFrom(cleaned, start);
    if (!extracted) {
      searchFrom = start + 1;
      continue;
    }
    try {
      pushParsed(JSON.parse(extracted));
    } catch {
      /* try next `{` */
    }
    searchFrom = start + 1;
  }

  const seen = new Set<string>();
  const unique: unknown[] = [];
  for (const c of objectAttempts) {
    const sig = JSON.stringify(c);
    if (seen.has(sig)) continue;
    seen.add(sig);
    unique.push(c);
  }
  return unique;
}

function rankParseableJsonObjectCandidate(obj: unknown): number {
  if (obj == null || typeof obj !== 'object' || Array.isArray(obj)) return 0;
  const o = obj as Record<string, unknown>;
  const keys = Object.keys(o).length;
  const hasPillar = o.pillarScores != null || o.pillar_scores != null ? 1000 : 0;
  const hasEvidence = o.keyEvidence != null || o.key_evidence != null ? 500 : 0;
  const hasMoment = o.momentNumber != null || o.momentName != null ? 200 : 0;
  return hasPillar + hasEvidence + hasMoment + keys;
}

/** Parses model output that should be JSON; tolerates ``` fences, leading prose, and stray `{` snippets. */
export function parseJsonObjectFromModelText(raw: string): unknown {
  const unique = collectJsonObjectsFromModelText(raw);
  if (unique.length === 0) {
    throw new SyntaxError('no JSON object found in model output (expected { … })');
  }
  if (unique.length === 1) return unique[0];
  // Truncated responses often balance nested objects first (e.g. pillarScores) before the outer `{…}`.
  // Prefer the richest candidate when multiple regions parse.
  let best = unique[0]!;
  let bestRank = rankParseableJsonObjectCandidate(best);
  for (let i = 1; i < unique.length; i++) {
    const c = unique[i]!;
    const r = rankParseableJsonObjectCandidate(c);
    if (r > bestRank) {
      bestRank = r;
      best = c;
    }
  }
  return best;
}

/**
 * Normalize common holistic JSON key variants (`pillar_scores`, `egoDevelopmentLevel`, etc.)
 * so client scoring can read model output reliably.
 */
export function coerceHolisticInterviewModelObject(parsed: unknown): Record<string, unknown> {
  if (parsed == null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { pillarScores: {} };
  }
  const o = parsed as Record<string, unknown>;
  const base = { ...o };
  delete base.ego_development_level;
  delete base.egoDevelopmentLevel;
  const pillarScores = o.pillarScores ?? o.pillar_scores;
  const keyEvidence = o.keyEvidence ?? o.key_evidence;
  const pillarConfidence = o.pillarConfidence ?? o.pillar_confidence;
  const egoFromNested =
    pillarScores != null && typeof pillarScores === 'object' && !Array.isArray(pillarScores)
      ? (pillarScores as Record<string, unknown>).ego_development_level ??
        (pillarScores as Record<string, unknown>).egoDevelopmentLevel
      : undefined;
  const egoNorm = coerceHolisticEgoLevelToIntLocal(o.ego_development_level ?? o.egoDevelopmentLevel ?? egoFromNested);
  const skepticismModifier = o.skepticismModifier ?? o.skepticism_modifier;
  const communicationQuality = o.communicationQuality ?? o.communication_quality;
  const narrativeCoherence = o.narrativeCoherence ?? o.narrative_coherence;
  const behavioralSpecificity = o.behavioralSpecificity ?? o.behavioral_specificity;
  const notableInconsistencies = o.notableInconsistencies ?? o.notable_inconsistencies;
  const interviewSummary = o.interviewSummary ?? o.interview_summary;
  return {
    ...base,
    pillarScores: (pillarScores ?? {}) as Record<string, unknown>,
    ...(keyEvidence !== undefined ? { keyEvidence } : {}),
    ...(keyEvidence !== undefined ? { keyEvidence } : {}),
    ...(pillarConfidence !== undefined ? { pillarConfidence } : {}),
    ...(egoNorm != null ? { ego_development_level: egoNorm } : {}),
    ...(skepticismModifier !== undefined ? { skepticismModifier } : {}),
    ...(communicationQuality !== undefined ? { communicationQuality } : {}),
    ...(narrativeCoherence !== undefined ? { narrativeCoherence } : {}),
    ...(behavioralSpecificity !== undefined ? { behavioralSpecificity } : {}),
    ...(notableInconsistencies !== undefined ? { notableInconsistencies } : {}),
    ...(interviewSummary !== undefined ? { interviewSummary } : {}),
  };
}
