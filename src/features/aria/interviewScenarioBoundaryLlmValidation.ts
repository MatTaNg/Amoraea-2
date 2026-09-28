import { stripControlTokens } from '@features/aria/interviewControlTokens';

const VIGNETTE_OR_NEXT_SEGMENT_MARKERS: readonly RegExp[] = [
  /\bsarah has been job hunting\b/i,
  /\bsophie and daniel have had\b/i,
  /\bsophie and daniel\b/i,
  /\bemma and ryan have been\b/i,
  /\bemma and ryan\b/i,
  /\bwhat do you think is going on here\b/i,
  /\bhave you ever held a grudge\b/i,
  /\bthink of someone you(?:'ve| have) had a really hard time with\b/i,
  /\bthere are only two questions left\b.*\bhave you ever\b/is,
  /\[\w+/,
];

const BANNED_OPENERS = /^(?:sure|okay|absolutely|that makes sense|got it)\b/i;

export function parseScenarioBoundaryLeadFromLlm(raw: string): string | null {
  let t = (raw ?? '').trim();
  if (!t) return null;
  t = t.replace(/^["'`]+|["'`]+$/g, '').trim();
  const jsonMatch = t.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as { lead?: string; text?: string };
      const fromJson = (parsed.lead ?? parsed.text ?? '').trim();
      if (fromJson) return fromJson;
    } catch {
      /* plain text below */
    }
  }
  return t.replace(/\n{2,}/g, ' ').trim() || null;
}

export function isValidScenarioBoundaryLead(text: string, _completedScenario: 1 | 2 | 3): boolean {
  const t = stripControlTokens(text).replace(/\s+/g, ' ').trim();
  if (t.length < 12 || t.length > 320) return false;
  if (BANNED_OPENERS.test(t)) return false;
  if (VIGNETTE_OR_NEXT_SEGMENT_MARKERS.some((re) => re.test(t))) return false;
  const sentences = t.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [t];
  if (sentences.length > 4) return false;
  if (/^(?:thank you for|your interview is complete)/i.test(t)) return false;
  return true;
}
