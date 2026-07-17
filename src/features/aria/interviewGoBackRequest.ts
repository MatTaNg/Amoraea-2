/**
 * Detects asks to return to / redo / reset an earlier scenario or situation.
 */

const GO_BACK_PREVIOUS_SCENARIO_RES: RegExp[] = [
  /\bgo\s+back\b/i,
  /\bgoing\s+back\b/i,
  /\bcan\s+(?:we|i|you)\s+go\s+back\b/i,
  /\b(?:can|could)\s+(?:we|i)\s+(?:return|revert)\b/i,
  /\breturn\s+to\s+(?:the\s+)?(?:previous|last|earlier|first|prior)\b/i,
  /\b(?:previous|last|earlier|prior)\s+(?:scenario|situation|one|question)\b/i,
  /\b(?:scenario|situation)\s+(?:1|one|2|two|a|b)\b.{0,20}\b(?:again|back)\b/i,
  /\b(?:back|again)\s+to\s+(?:scenario|situation|emma|ryan|sarah|james|sophie|daniel)\b/i,
  /\bredo\s+(?:the\s+)?(?:previous|last|earlier|first)?\s*(?:scenario|situation|one)?\b/i,
  /\b(?:start|begin)\s+over\b/i,
  /\b(?:can|could)\s+(?:we|i)\s+(?:start|begin)\s+over\b/i,
  /\breset\s+(?:(?:the|my)\s+)?(?:interview|scenario|situation|scores?)\b/i,
  /\bdelete\s+(?:(?:the|my)\s+)?(?:scores?|answers?)\b/i,
  /\bchange\s+(?:my\s+)?(?:previous|earlier|last)\b/i,
  /\bi\s+want\s+to\s+(?:go\s+back|redo|restart|reset)\b/i,
  /\blet'?s\s+(?:go\s+back|start\s+over|redo)\b/i,
  /\b(?:take|bring)\s+me\s+back\b/i,
  /\b(?:the\s+)?(?:first|previous)\s+(?:one|scenario|situation)\s+again\b/i,
];

export function looksLikeGoBackToPreviousScenarioRequest(text: string): boolean {
  const t = (text ?? '').trim().replace(/\s+/g, ' ');
  if (!t) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length > 28) return false;
  return GO_BACK_PREVIOUS_SCENARIO_RES.some((re) => re.test(t));
}
