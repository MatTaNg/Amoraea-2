/**
 * Deno copy — keep aligned with src/features/aria/narrativeTranscriptCompaction.ts
 */

export type NarrativeTranscriptTurn = { role: string; content?: string | null };

export const NARRATIVE_TRANSCRIPT_MAX_TOTAL_CHARS = 12_000;
export const NARRATIVE_USER_TURN_MAX_CHARS = 720;
export const NARRATIVE_ASSISTANT_TURN_MAX_CHARS = 360;
export const NARRATIVE_TRANSCRIPT_AUTO_COMPACT_RAW_CHARS = 14_000;

function truncateWithEllipsis(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  if (max <= 1) return '…';
  return `${t.slice(0, max - 1).trimEnd()}…`;
}

function looksLikeScenarioCardDelivery(text: string): string | null {
  const t = text.trim();
  if (t.length < 160) return null;
  if (/\bEmma and Ryan\b/i.test(t) && /\bRyan takes a call\b/i.test(t)) return 'Situation 1 scenario card';
  if (/\bSarah has been job hunting\b/i.test(t) || (/\bSarah and James\b/i.test(t) && /\bfight starts\b/i.test(t))) {
    return 'Situation 2 scenario card';
  }
  if (/\bSophie and Daniel\b/i.test(t) && /\bten minutes\b/i.test(t)) return 'Situation 3 scenario card';
  if (/\bThink of someone you(?:'ve| have) had a really hard time with\b/i.test(t)) return 'Moment 4 grudge prompt';
  if (/\bThink of a time when you had a conflict with someone important\b/i.test(t)) return 'Moment 5 conflict prompt';
  return null;
}

function compressTurn(m: NarrativeTranscriptTurn): NarrativeTranscriptTurn | null {
  if (m.role !== 'user' && m.role !== 'assistant') return null;
  let body = (m.content ?? '').trim();
  if (!body) return null;

  if (m.role === 'assistant') {
    const card = looksLikeScenarioCardDelivery(body);
    if (card) {
      body = `[Interviewer delivered ${card} — vignette omitted; use SCENARIO SCORES and SLICE KEY EVIDENCE.]`;
    } else if (body.length > NARRATIVE_ASSISTANT_TURN_MAX_CHARS) {
      body = truncateWithEllipsis(body, NARRATIVE_ASSISTANT_TURN_MAX_CHARS);
    }
  } else if (body.length > NARRATIVE_USER_TURN_MAX_CHARS) {
    body = truncateWithEllipsis(body, NARRATIVE_USER_TURN_MAX_CHARS);
  }

  return { role: m.role, content: body };
}

function formattedLineLength(m: NarrativeTranscriptTurn, index: number): number {
  const body = (m.content ?? '').trim();
  if (!body) return 0;
  const label = m.role === 'assistant' ? 'Interviewer' : 'Participant';
  return `[${index + 1}] ${label}: ${body}`.length + 1;
}

export function compactTranscriptForNarrativePrompt(
  transcript: ReadonlyArray<NarrativeTranscriptTurn>,
  opts?: { maxTotalChars?: number },
): NarrativeTranscriptTurn[] {
  const maxTotal = opts?.maxTotalChars ?? NARRATIVE_TRANSCRIPT_MAX_TOTAL_CHARS;
  const compressed: NarrativeTranscriptTurn[] = [];
  for (const m of transcript) {
    const c = compressTurn(m);
    if (c) compressed.push(c);
  }
  if (compressed.length === 0) return [];

  let total = 0;
  for (let i = 0; i < compressed.length; i++) {
    total += formattedLineLength(compressed[i]!, i);
  }
  if (total <= maxTotal) return compressed;

  const headCount = Math.min(8, Math.max(2, Math.floor(compressed.length * 0.15)));
  const tailCount = Math.min(compressed.length, Math.max(24, Math.floor(compressed.length * 0.55)));
  const head = compressed.slice(0, headCount);
  const tail = compressed.slice(Math.max(headCount, compressed.length - tailCount));
  const omitted = compressed.length - head.length - tail.length;
  const bridge =
    omitted > 0
      ? [
          {
            role: 'assistant',
            content: `[${omitted} middle turns omitted for length — use SCENARIO SCORES, SLICE KEY EVIDENCE, and participant turns below.]`,
          },
        ]
      : [];

  const merged = [...head, ...bridge, ...tail];
  total = 0;
  for (let i = 0; i < merged.length; i++) {
    total += formattedLineLength(merged[i]!, i);
  }
  if (total <= maxTotal) return merged;

  const out: NarrativeTranscriptTurn[] = [];
  total = 0;
  for (let i = 0; i < merged.length; i++) {
    const m = merged[i]!;
    const lineLen = formattedLineLength(m, i);
    if (total + lineLen > maxTotal) break;
    total += lineLen;
    out.push(m);
  }
  return out.length > 0 ? out : merged.slice(-12);
}

export function shouldAutoCompactTranscriptForNarrative(
  transcript: ReadonlyArray<NarrativeTranscriptTurn>,
): boolean {
  let rawChars = 0;
  for (const m of transcript) {
    if (m.role !== 'user' && m.role !== 'assistant') continue;
    rawChars += (m.content ?? '').length;
  }
  return rawChars > NARRATIVE_TRANSCRIPT_AUTO_COMPACT_RAW_CHARS || transcript.length > 90;
}

export function isWorkerResourceLimitError(status: number, errText: string): boolean {
  return status === 546 || /WORKER_RESOURCE_LIMIT/i.test(errText);
}
