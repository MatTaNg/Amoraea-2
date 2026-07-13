import { sanitizeInterviewParticipantFirstNameForSpeech } from '@features/aria/interviewerFrameworkPrompt';

/** Keep the participant's first name at most once in a personal-moment closing (prefer the thank-you line). */
export function dedupeDuplicateParticipantNameInClosing(text: string, rawFirstName: string): string {
  const name = sanitizeInterviewParticipantFirstNameForSpeech(rawFirstName);
  if (!name || !text?.trim()) return text;
  let esc: string;
  try {
    esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  } catch {
    return text;
  }
  const nameRe = new RegExp(`\\b${esc}\\b`, 'gi');
  const matches = text.match(nameRe);
  if (!matches || matches.length <= 1) return text;

  let out = text.replace(
    new RegExp(`(\\bgood work getting through all of this),\\s*${esc}(?=\\s*[.!?])`, 'i'),
    '$1',
  );
  const remaining = out.match(nameRe);
  if (!remaining || remaining.length <= 1) {
    return out.replace(/\s+/g, ' ').trim();
  }

  let seen = 0;
  out = out.replace(nameRe, (match) => {
    seen += 1;
    return seen < remaining.length ? '' : match;
  });
  return out
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.!?])/g, '$1')
    .trim();
}

/** Collapse stacked generic interview sign-offs (e.g. walking-through + open-with-me). */
export function dedupeStackedInterviewThankYous(text: string): string {
  if (!text?.trim()) return text;
  const hasOpenThanks = /\bthank you for being so open with me\b/i.test(text);
  const hasWalkThanks = /\bthank you for walking through\b/i.test(text);
  const hasStickThanks = /\bthanks for sticking with\b/i.test(text);
  if (!hasOpenThanks || (!hasWalkThanks && !hasStickThanks)) return text;
  let out = text
    .replace(/\bthank you for walking through[^.!?]*[.!?]\s*/gi, '')
    .replace(/\bthanks for sticking with[^.!?]*[.!?]\s*/gi, '');
  out = out.replace(/\s{2,}/g, ' ').trim();
  return out || text;
}

/** Remove model mirror recap ("That X sounds like…") before the scripted thanks line. */
export function stripLeadingMirrorRecapBeforeThanks(text: string): string {
  const thankRe = /\bThank you for being so open\b/i;
  const idx = text.search(thankRe);
  if (idx <= 0) return text;
  const before = text.slice(0, idx).trim();
  if (/^that\s/i.test(before) && /\bsounds like\b/i.test(before)) {
    return text.slice(idx).trimStart();
  }
  return text;
}

export function sanitizeClosingLanguage(text: string): string {
  if (!text) return text;
  let out = text
    .replace(/^\s*Sure[.,]?\s+/i, '')
    .replace(/^\s*Okay[.,]?\s+/i, '')
    .replace(/^\s*Absolutely[.,]?\s+/i, '')
    .replace(/^\s*That makes sense[.,]?\s+/i, '')
    .replace(/^\s*That checks out[.,]?\s+/i, '')
    .replace(/^\s*That lands[.,]?\s+/i, '')
    .replace(/\brather\s+than\s+just\s+saying\b/gi, '')
    .replace(/\brather\s+than\s+just\b/gi, '')
    .replace(/\byou(?:'ve| have)\s+stayed grounded throughout this whole conversation[.,]?/gi, '')
    .replace(/\byou stayed grounded throughout this whole conversation[.,]?/gi, '')
    // Model glitch: "...made it happen going through the motions" (two incompatible phrases stitched).
    .replace(/\b(made|make)\s+it\s+happen\s+going through the motions\b/gi, '$1 it happen')
    .replace(/\b(made|make)\s+it\s+happen\s*,\s*going through the motions\b/gi, '$1 it happen')
    .replace(/\s+going through the motions(?=\s*[.…]?\s*Thank\b)/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  out = dedupeStackedInterviewThankYous(out);
  out = stripLeadingMirrorRecapBeforeThanks(out);
  return out;
}
