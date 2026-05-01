/**
 * Admin UI: derive a short interview "intro" label without showing corrupt `users.name`
 * (e.g. a full scenario answer accidentally stored in `name`).
 * Mirrors the Aria greeting gate: 1–2 name tokens, max 50 chars, letters / ' / - only.
 */

export type AdminInterviewIntroUserFields = {
  name?: string | null;
  basic_info?: unknown;
  interview_transcript?: unknown;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
};

type TranscriptLine = { role: string; content?: string };

function stripNameTokenPunctuation(token: string): string {
  return token.replace(/[.!?,;:]+$/g, '').trim();
}

export function isPlausibleInterviewStoredName(text: string | null | undefined): boolean {
  const t = (text ?? '').trim();
  if (!t || t.length > 50) return false;
  const parts = t
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => stripNameTokenPunctuation(p))
    .filter((p) => p.length > 0);
  return parts.length <= 2 && parts.every((p) => /^[a-zA-Z'-]+$/.test(p));
}

function firstNameFromBasicInfo(raw: unknown): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const fn = (raw as { firstName?: unknown }).firstName;
  if (typeof fn !== 'string') return null;
  const t = fn.trim();
  return isPlausibleInterviewStoredName(t) ? t : null;
}

function parseTranscriptLines(raw: unknown): TranscriptLine[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as TranscriptLine[];
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? (p as TranscriptLine[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

function firstUserMessageFromTranscript(transcript: unknown): string | null {
  const lines = parseTranscriptLines(transcript);
  const u = lines.find(
    (m) =>
      (m.role === 'user' || m.role === 'User') && typeof m.content === 'string' && m.content.trim().length > 0,
  );
  return u?.content?.trim() ?? null;
}

/** Cohort cards / detail header — plausible interview name, else onboarding firstName, else first user line if name-like, else profile/email. */
export function resolveAdminInterviewIntroDisplayName(user: AdminInterviewIntroUserFields): string {
  const n = user.name?.trim();
  if (n && isPlausibleInterviewStoredName(n)) return n;
  const fromBasic = firstNameFromBasicInfo(user.basic_info);
  if (fromBasic) return fromBasic;
  const fromTranscript = firstUserMessageFromTranscript(user.interview_transcript);
  if (fromTranscript && isPlausibleInterviewStoredName(fromTranscript)) return fromTranscript;
  const fallback =
    user.full_name?.trim() || user.display_name?.trim() || user.email?.split('@')[0]?.trim() || '';
  return fallback.length > 0 ? fallback : '—';
}

/** Prefer plausible `users.name`, else same fallbacks as intro but without using transcript (list display). */
export function resolveAdminUserListDisplayName(user: AdminInterviewIntroUserFields): string {
  const n = user.name?.trim();
  if (n && isPlausibleInterviewStoredName(n)) return n;
  const fromBasic = firstNameFromBasicInfo(user.basic_info);
  if (fromBasic) return fromBasic;
  return user.full_name?.trim() || user.display_name?.trim() || user.email || 'Unknown';
}
