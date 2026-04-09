/**
 * When the model omits regulation from aggregated scores, Moment 4 first-person
 * narrative can still show emotional self-management (passive regulation signal).
 */

function moment4UserTextCorpus(
  slice: Array<{ role: string; content?: string }> | null | undefined
): string {
  if (!slice?.length) return '';
  return slice
    .filter((m) => m.role === 'user')
    .map((m) => (m.content ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

/** Heuristic: ongoing difficult feelings held without flooding, hostility, or pure avoidance framing. */
export function hasMoment4PassiveRegulationEvidence(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 60) return false;

  const hostileOrFlooded =
    /\b(i hate|i despise|they can rot|hope they|piece of shit|pathetic|disgusting|lost it|blew up|went off on|screamed at|wanted to hurt)\b/i.test(
      t
    );
  if (hostileOrFlooded) return false;

  const firstPerson = /\b(i|me|my|i'?ve|i'?m)\b/i.test(t);
  if (!firstPerson) return false;

  const ongoingProcess =
    /\b(still|over time|these days|nowadays|for years|a long time|never fully|not fully resolved|ongoing|lingering|less loud|quieter now|making peace with|made peace with|situation|the person|unresolved|complicated|mixed feelings|both things|hold both|sit with|sitting with|tension|ambivalen|working through|process|gradual|slowly|learning to|trying to|manage|managed|regulated|grounded|didn'?t let it|held it together|kept my|stayed calm|didn'?t escalate|avoided drama|stepped back|distance myself|pulled back)\b/i.test(
      t
    );

  const reflectiveComplexity =
    /\b(if i'?m honest|in hindsight|i can see|i realize|i recognize|complicated|nuanced|not black and white|both sides|partly|also my|my part|not proud|ashamed|embarrassed|hurt|wounded|disappointed|sad|grief|resentment|bitterness|forgiveness|forgive|let go|letting go)\b/i.test(
      t
    );

  return ongoingProcess && reflectiveComplexity;
}

function sophisticationBand(text: string): number {
  const t = text.toLowerCase();
  let score = 6;
  if (/\b(ambivalen|nuanced|both things|not black|making peace with|less loud|sit with|tension between)\b/.test(t)) {
    score += 0.75;
  }
  if (/\b(if i'?m honest|in hindsight|i recognize|my part|working through|gradual)\b/.test(t)) {
    score += 0.75;
  }
  return Math.min(8, Math.round(score * 10) / 10);
}

export function applyMoment4PassiveRegulationCalibration(
  pillarScores: Record<string, number>,
  moment4Slice: Array<{ role: string; content?: string }> | null | undefined
): Record<string, number> {
  const corpus = moment4UserTextCorpus(moment4Slice);
  if (!hasMoment4PassiveRegulationEvidence(corpus)) return pillarScores;

  const current = pillarScores.regulation;
  if (typeof current === 'number' && Number.isFinite(current) && current >= 6) {
    return pillarScores;
  }

  const band = sophisticationBand(corpus);
  const next = typeof current === 'number' && Number.isFinite(current) ? Math.max(current, band) : band;
  return { ...pillarScores, regulation: next };
}
