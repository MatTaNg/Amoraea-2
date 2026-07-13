const SCENARIO_B_TOPIC_RE =
  /\b(sarah|james|job|offer|celebrat|salary|commute|fight|blindsided|appreciat|tears?|tearful|cry|cries|promotion|hunt)\b/i;

/** Scenario B Q1: any on-topic engagement counts — shallow answers are scorable; do not force probes for depth. */
export function hasScenarioBQ1OnTopicEngagement(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 12) return false;
  if (SCENARIO_B_TOPIC_RE.test(t)) return true;
  const lower = t.toLowerCase();
  return (
    /\b(needed to feel|emotional bid|logistics alone|salary alone|commute alone|don'?t cry|tears? up|redirect(ing)?|trail(ed|ing) off|worth it)\b/.test(
      lower
    ) ||
    /\b(sarah needed|she needed|she wanted|he needed|he wanted)\b.*\b(comfort|validation|acknowledg|empathy|care|attunement)\b/.test(
      lower
    )
  );
}
