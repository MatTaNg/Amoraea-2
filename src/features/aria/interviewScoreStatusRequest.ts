/**
 * Detects mid-interview asks about score, pass/fail, or how the participant is doing.
 * Kept narrow so scenario answers that casually mention "score" or "passing" are not caught.
 */

const SCORE_STATUS_REQUEST_RES: RegExp[] = [
  /\b(?:what(?:'s| is| are)?|whats)\s+(?:my|the)\s+score\b/i,
  /\b(?:can|could)\s+you\s+(?:tell|give|share|reveal)\s+(?:me\s+)?(?:my|the)\s+score\b/i,
  /\bmy\s+score\b/i,
  /\b(?:am|are)\s+i\s+(?:gonna\s+|going\s+to\s+)?pass(?:ing)?\b/i,
  /\b(?:did|do|will|would)\s+i\s+pass\b/i,
  /\bam\s+i\s+passing\b/i,
  /\b(?:am|are)\s+i\s+(?:gonna\s+|going\s+to\s+)?fail(?:ing)?\b/i,
  /\b(?:did|do|will)\s+i\s+fail\b/i,
  /\bhow\s+(?:am|are)\s+i\s+doing\b/i,
  /\bhow(?:'s| is)\s+it\s+going\s+(?:so\s+far|for\s+me)\b/i,
  /\bhow\s+did\s+i\s+do\b/i,
  /\bam\s+i\s+doing\s+(?:well|ok|okay|good|alright|all\s+right)\b/i,
  /\bdid\s+i\s+do\s+(?:well|ok|okay|good)\b/i,
  /\b(?:what\s+are|whats|what's)\s+my\s+(?:results?|grades?)\b/i,
  /\b(?:did|do)\s+i\s+(?:make\s+it|get\s+in|pass\s+the\s+(?:interview|test|assessment))\b/i,
  /\bhow\s+(?:am|are)\s+i\s+(?:performing|scoring)\b/i,
  /\b(?:any\s+)?(?:idea|sense)\s+(?:of\s+)?(?:my\s+)?(?:score|how\s+i(?:'m| am)\s+doing)\b/i,
];

export function looksLikeInterviewScoreStatusRequest(text: string): boolean {
  const t = (text ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return false;
  // Substantive scenario answers that mention "score" in passing — keep this gate short-turn focused.
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 28) return false;
  return SCORE_STATUS_REQUEST_RES.some((re) => re.test(t));
}
