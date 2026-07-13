/** Leaf module — no imports. Shared personal-disclosure ack detection without circular deps. */

/** True when assistant text is only a personal-disclosure thank-you (optional participant name). */
export function isStandalonePersonalDisclosureAcknowledgment(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  return (
    /^thank you for sharing(?: that| this)?(?:,\s+[A-Za-z][\w'-]*)?[.!]?\s*$/i.test(t) ||
    /^thanks for sharing(?: that| this)?(?:,\s+[A-Za-z][\w'-]*)?[.!]?\s*$/i.test(t) ||
    /^thank you for being so open(?: with me)?(?:,\s+[A-Za-z][\w'-]*)?[.!]?\s*$/i.test(t)
  );
}
