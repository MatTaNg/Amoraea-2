export function isNoEvidenceText(text: string | null | undefined): boolean {
  if (!text) return false;
  const t = text.trim().toLowerCase();
  return (
    /no\s+[a-z_ ]+\s+content\s+in\s+this\s+(scenario|moment|interview)/i.test(t) ||
    /not\s+directly\s+assessed/i.test(t) ||
    /insufficient\s+evidence/i.test(t) ||
    /no\s+evidence\s+(was\s+)?(available|observed|surfaced)/i.test(t)
  );
}

export function normalizeScoresByEvidence(
  scores: Record<string, number> | null | undefined,
  keyEvidence: Record<string, string> | null | undefined
): Record<string, number> {
  if (!scores) return {};
  const out: Record<string, number> = {};
  Object.entries(scores).forEach(([id, raw]) => {
    if (typeof raw !== 'number' || !Number.isFinite(raw)) return;
    const ev = keyEvidence?.[id];
    if (isNoEvidenceText(ev)) return;
    out[id] = raw;
  });
  return out;
}

export function evaluateMoment5AppreciationSpecificity(text: string): {
  hasSpecificPerson: boolean;
  hasSpecificMoment: boolean;
  hasAttunement: boolean;
  hasRelationalSpecificity: boolean;
  isGeneric: boolean;
} {
  const t = text.toLowerCase().trim();
  if (!t || t.length < 12) {
    return {
      hasSpecificPerson: false,
      hasSpecificMoment: false,
      hasAttunement: false,
      hasRelationalSpecificity: false,
      isGeneric: true,
    };
  }
  const hasSpecificPerson =
    /\b(my|our)\s+(partner|wife|husband|boyfriend|girlfriend|friend|mom|mother|dad|father|sister|brother|cousin|aunt|uncle|daughter|son|teammate|roommate)\b|\b(he|she|they)\b/.test(
      t
    );
  const hasSpecificMoment =
    /\b(last|yesterday|today|week|month|birthday|anniversary|graduation|after|when|that time|once|on \w+day|at dinner|at work|turned \d+)\b/.test(
      t
    );
  const hasAttunement =
    /\bneeded|was going through|felt|feeling|stressed|upset|overwhelmed|encourag|support|noticed|because they|hard year|hard time\b/.test(
      t
    );
  const hasConnectionMoment =
    /\b(in that moment|when (she|he|they) (opened it|saw it|heard it|responded)|we hugged|teared up|started crying|smiled and|it landed|really touched)\b/.test(
      t
    );
  const hasWordsExchanged =
    /"(.*?)"|\b(she said|he said|they said|i said|i told (her|him|them)|they told me)\b/.test(
      t
    );
  const hasMeaningDetail =
    /\b(meaningful|mattered|why it mattered|what made it meaningful|because (she|he|they) (had|were|was)|for (her|him|them) specifically)\b/.test(
      t
    );
  const hasRelationalSpecificity = hasConnectionMoment || hasWordsExchanged || hasMeaningDetail;
  const isGeneric = !(hasSpecificPerson && hasSpecificMoment && hasAttunement && hasRelationalSpecificity);
  return {
    hasSpecificPerson,
    hasSpecificMoment,
    hasAttunement,
    hasRelationalSpecificity,
    isGeneric,
  };
}

export function isLikelyMisplacedPersonalNarrativeForScenarioCThreshold(text: string): boolean {
  const t = text.toLowerCase();
  const referencesScenarioCharacters = /\b(theo|morgan|they)\b/.test(t) && /\b(should|would|relationship|not working|walk away|end)\b/.test(t);
  if (referencesScenarioCharacters) return false;
  const hasPersonalNarrativeSignals =
    /\b(i|my|me|we|our|us)\b/.test(t) &&
    /\b(ex|relationship|partner|wife|husband|boyfriend|girlfriend|friend|family|when i|i had|i was|i felt|i decided|i left|i stayed)\b/.test(
      t
    );
  return hasPersonalNarrativeSignals;
}
