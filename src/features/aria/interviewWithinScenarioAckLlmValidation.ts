import { stripControlTokens } from '@features/aria/interviewControlTokens';

const BANNED_OPENERS = /^(?:sure|okay|absolutely|that makes sense|got it)\b/i;

export function parseWithinScenarioAckFromLlm(raw: string): string | null {
  let t = (raw ?? '').trim().replace(/^["'`]+|["'`]+$/g, '').trim();
  if (!t) return null;
  t = t.replace(/\n+/g, ' ').trim();
  return t || null;
}

export function isValidWithinScenarioAck(text: string): boolean {
  const t = stripControlTokens(text).replace(/\s+/g, ' ').trim();
  if (t.length < 3 || t.length > 80) return false;
  if (BANNED_OPENERS.test(t)) return false;
  if (/\?/.test(t)) return false;
  if (/\[\w+/.test(t)) return false;
  if (/\bnext situation\b/i.test(t)) return false;
  if (/\btwo questions left\b/i.test(t)) return false;
  return true;
}
