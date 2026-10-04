export const PARTNER_ALIGNMENT_IMPORTANCE = {
  nonNegotiable: 'non_negotiable',
  veryImportant: 'very_important',
  preference: 'preference',
  doesntMatter: 'doesnt_matter',
} as const;

export type PartnerAlignmentImportance =
  (typeof PARTNER_ALIGNMENT_IMPORTANCE)[keyof typeof PARTNER_ALIGNMENT_IMPORTANCE];

export type PartnerAlignmentImportanceOption = {
  label: string;
  value: PartnerAlignmentImportance;
};

/** User-facing 4-level dealbreaker scale for “how much of a dealbreaker would that be?” */
export const PARTNER_ALIGNMENT_IMPORTANCE_OPTIONS: PartnerAlignmentImportanceOption[] = [
  {
    value: PARTNER_ALIGNMENT_IMPORTANCE.nonNegotiable,
    label: 'Non-negotiable: Do not match me with someone who differs here',
  },
  {
    value: PARTNER_ALIGNMENT_IMPORTANCE.veryImportant,
    label: 'Very important / strong preference: I could make an exception for the right person',
  },
  {
    value: PARTNER_ALIGNMENT_IMPORTANCE.preference,
    label: 'Preference: I’d prefer alignment, but I’m flexible',
  },
  {
    value: PARTNER_ALIGNMENT_IMPORTANCE.doesntMatter,
    label: 'Doesn’t matter to me: no meaningful matching effect',
  },
];

const LABEL_BY_VALUE = new Map(
  PARTNER_ALIGNMENT_IMPORTANCE_OPTIONS.map((option) => [option.value, option.label]),
);

function compactKey(raw: unknown): string {
  return String(raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '_');
}

/**
 * Maps stored slugs, current labels, and legacy Yes/No / Dealbreaker answers
 * onto the 4-level scale. Unrecognized values return null.
 */
export function parsePartnerAlignmentImportance(
  raw: unknown,
): PartnerAlignmentImportance | null {
  const original = String(raw ?? '').trim();
  if (!original) return null;

  const compact = compactKey(original);

  if (
    compact === 'non_negotiable' ||
    compact.startsWith('non_negotiable') ||
    compact === 'yes' ||
    compact === 'dealbreaker'
  ) {
    return PARTNER_ALIGNMENT_IMPORTANCE.nonNegotiable;
  }

  if (
    compact === 'very_important' ||
    compact.startsWith('very_important') ||
    compact === 'important' ||
    compact === 'strong_preference'
  ) {
    return PARTNER_ALIGNMENT_IMPORTANCE.veryImportant;
  }

  if (
    compact === 'preference' ||
    compact.startsWith('preference') ||
    compact === 'somewhat_important'
  ) {
    return PARTNER_ALIGNMENT_IMPORTANCE.preference;
  }

  if (
    compact === 'doesnt_matter' ||
    compact.startsWith('doesnt_matter') ||
    compact === 'no' ||
    compact === 'no_preference' ||
    compact === 'not_important'
  ) {
    return PARTNER_ALIGNMENT_IMPORTANCE.doesntMatter;
  }

  return null;
}

/** Picker value: slug when parseable, otherwise the raw stored string. */
export function partnerAlignmentImportancePickerValue(raw: unknown): string {
  return parsePartnerAlignmentImportance(raw) ?? String(raw ?? '').trim();
}

export function partnerAlignmentImportanceLabel(
  raw: unknown,
): string {
  const parsed = parsePartnerAlignmentImportance(raw);
  if (parsed) return LABEL_BY_VALUE.get(parsed) ?? '';
  return String(raw ?? '').trim();
}

export function isPartnerAlignmentHardBlock(raw: unknown): boolean {
  return parsePartnerAlignmentImportance(raw) === PARTNER_ALIGNMENT_IMPORTANCE.nonNegotiable;
}

export function partnerAlignmentRankingWeight(
  raw: unknown,
): 'very_important' | 'preference' | null {
  const parsed = parsePartnerAlignmentImportance(raw);
  if (parsed === PARTNER_ALIGNMENT_IMPORTANCE.veryImportant) return 'very_important';
  if (parsed === PARTNER_ALIGNMENT_IMPORTANCE.preference) return 'preference';
  return null;
}
