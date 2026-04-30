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

/** Parses model output that should be JSON; tolerates ``` fences, leading prose, and stray `{` snippets. */
export function parseJsonObjectFromModelText(raw: string): unknown {
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  try {
    return JSON.parse(cleaned);
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
      return JSON.parse(extracted);
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
      searchFrom = start + 1;
    }
  }
  throw new SyntaxError(lastErr);
}
