/**
 * Admin UI: derive a short interview "intro" label without showing corrupt `users.name`
 * (e.g. a full scenario answer accidentally stored in `name`).
 * Mirrors the Amoraea greeting gate: 1–2 name tokens, max 50 chars, letters / ' / - only.
 */

export type AdminInterviewIntroUserFields = {
  name?: string | null;
  basic_info?: unknown;
  /** Prefer `interview_attempts.transcript`; legacy alias kept for tests. */
  transcript?: unknown;
  interview_transcript?: unknown;
  full_name?: string | null;
  display_name?: string | null;
  email?: string | null;
};

function transcriptForIntro(user: AdminInterviewIntroUserFields): unknown {
  return user.transcript ?? user.interview_transcript;
}

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

function looksLikeEmailLocalPart(text: string, email?: string | null): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  const local = email?.split('@')[0]?.trim();
  if (local && trimmed.toLowerCase() === local.toLowerCase()) return true;
  return false;
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
  const fromTranscript = firstUserMessageFromTranscript(transcriptForIntro(user));
  if (fromTranscript && isPlausibleInterviewStoredName(fromTranscript)) return fromTranscript;
  const fallback =
    user.full_name?.trim() || user.display_name?.trim() || user.email?.split('@')[0]?.trim() || '';
  return fallback.length > 0 ? fallback : '—';
}

/**
 * Participant-facing label (e.g. personal report title): interview name from greeting,
 * then onboarding first name — never email local part or auto-filled display_name.
 */
export function resolveReportParticipantDisplayName(user: AdminInterviewIntroUserFields): string | null {
  const n = user.name?.trim();
  if (n && isPlausibleInterviewStoredName(n) && !looksLikeEmailLocalPart(n, user.email)) return n;
  const fromBasic = firstNameFromBasicInfo(user.basic_info);
  if (fromBasic && !looksLikeEmailLocalPart(fromBasic, user.email)) return fromBasic;
  const fromTranscript = firstUserMessageFromTranscript(transcriptForIntro(user));
  if (
    fromTranscript &&
    isPlausibleInterviewStoredName(fromTranscript) &&
    !looksLikeEmailLocalPart(fromTranscript, user.email)
  ) {
    return fromTranscript;
  }
  const full = user.full_name?.trim();
  if (full && isPlausibleInterviewStoredName(full) && !looksLikeEmailLocalPart(full, user.email)) return full;
  return null;
}

/** Prefer plausible `users.name`, else same fallbacks as intro but without using transcript (list display). */
export function resolveAdminUserListDisplayName(user: AdminInterviewIntroUserFields): string {
  const n = user.name?.trim();
  if (n && isPlausibleInterviewStoredName(n)) return n;
  const fromBasic = firstNameFromBasicInfo(user.basic_info);
  if (fromBasic) return fromBasic;
  return user.full_name?.trim() || user.display_name?.trim() || user.email || 'Unknown';
}
