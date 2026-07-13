export function egoLevelAdminColor(level: number | null | undefined): string {
  if (level == null || !Number.isFinite(level)) return '#7A9ABE';
  const n = Math.round(Number(level));
  if (n <= 2) return '#E87A7A';
  if (n === 3) return '#D4A84B';
  return '#2A8C6A';
}

export const EGO_LEVEL_ADMIN_SHORT_DESC: Record<number, string> = {
  1: 'Concrete and rule-based',
  2: 'Multiple perspectives, simplified resolution',
  3: 'Holds complexity, recognizes patterns',
  4: 'Integrates contradictions, genuine depth',
  5: 'Systemic relational understanding',
};

export function concretenessAdminColor(level: string | null | undefined): string {
  const t = (level ?? '').toLowerCase();
  if (t === 'absent' || t === 'low') return '#E87A7A';
  if (t === 'valid_non_applicable') return '#5B8FBD';
  if (t === 'moderate') return '#D4A84B';
  if (t === 'high') return '#2A8C6A';
  return '#7A9ABE';
}

export function disclosureAdminColor(cal: string | null | undefined): string {
  const t = (cal ?? '').toLowerCase();
  if (t === 'calibrated') return '#2A8C6A';
  if (t === 'underdisclosure' || t === 'overdisclosure') return '#D4A84B';
  return '#7A9ABE';
}

export function defenseCrossRefConfidenceColor(level: 'high' | 'moderate' | 'low'): string {
  if (level === 'high') return '#2A8C6A';
  if (level === 'moderate') return '#D4A84B';
  return '#E87A7A';
}

export function defenseCrossRefConsistencyLabel(consistent: boolean | null): string {
  if (consistent === true) return 'Consistent';
  if (consistent === false) return 'Contradicting';
  return 'Neutral / insufficient data';
}
