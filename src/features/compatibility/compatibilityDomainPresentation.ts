import { COMPATIBILITY_ALGORITHM_VERSION } from '@config/algorithmVersions';

export const COMPATIBILITY_DOMAIN_IDS = [
  'life_vision',
  'values_worldview',
  'relationship_needs',
  'intimacy',
  'lifestyle',
  'financial_outlook',
  'interaction_conflict',
] as const;

export type CompatibilityDomainId = (typeof COMPATIBILITY_DOMAIN_IDS)[number];

export const COMPATIBILITY_DOMAIN_LABELS: Record<CompatibilityDomainId, string> = {
  life_vision: 'Life Vision',
  values_worldview: 'Values & Worldview',
  relationship_needs: 'Relationship Needs',
  intimacy: 'Intimacy',
  lifestyle: 'Lifestyle',
  financial_outlook: 'Financial Outlook',
  interaction_conflict: 'Interaction / Conflict Dynamics',
};

export type CompatibilityDomainBand =
  | 'Exceptional'
  | 'Strong'
  | 'Good'
  | 'Mixed'
  | 'Potential Friction'
  | 'Unavailable';

export type CompatibilityDomainView = {
  id: CompatibilityDomainId;
  label: string;
  score: number | null;
  band: CompatibilityDomainBand;
  explanation: string;
};

export function bandForDomainScore(score: number | null | undefined): CompatibilityDomainBand {
  if (score == null || !Number.isFinite(score)) return 'Unavailable';
  if (score >= 0.88) return 'Exceptional';
  if (score >= 0.75) return 'Strong';
  if (score >= 0.6) return 'Good';
  if (score >= 0.45) return 'Mixed';
  return 'Potential Friction';
}

export function buildCompatibilityDomainViews(args: {
  lifeDomainAlignment: number;
  valuesScore: number;
  financeScore: number;
  intimacyScore: number | null;
  lifestyleScore: number;
  relationshipNeedsScore: number;
  interactionScore: number;
}): CompatibilityDomainView[] {
  const rows: Array<{ id: CompatibilityDomainId; score: number | null; explanation: string }> = [
    {
      id: 'life_vision',
      score: args.lifeDomainAlignment,
      explanation:
        'Concrete desired-life fit from existing profile and onboarding answers (children, relationship structure, location, religion/politics when not hard-blocked, lifestyle). This is not the four abstract importance sliders.',
    },
    {
      id: 'values_worldview',
      score: args.valuesScore,
      explanation: 'Worldview overlap from religion, politics (when required), and Schwartz values — values similarity is a supporting cue, not the main ranking driver.',
    },
    {
      id: 'relationship_needs',
      score: args.relationshipNeedsScore,
      explanation:
        'Abstract alignment of four 0–100 importance sliders (intimacy, spirituality, family, physical health). This is not full life-vision compatibility.',
    },
    {
      id: 'intimacy',
      score: args.intimacyScore,
      explanation:
        'Intimacy compatibility is not scored from sexual-communication comfort similarity. A proper intimacy domain should use sexual/intimacy preferences and needs, not communication-capacity similarity. Temporarily unavailable.',
    },
    {
      id: 'lifestyle',
      score: args.lifestyleScore,
      explanation: 'Day-to-day lifestyle, hobbies, and substances using existing dealbreaker answers rather than a second questionnaire.',
    },
    {
      id: 'financial_outlook',
      score: args.financeScore,
      explanation: 'Pooling, risk comfort, and income-bracket alignment from existing finance fields.',
    },
    {
      id: 'interaction_conflict',
      score: args.interactionScore,
      explanation: 'How you tend to handle tension, using interview process markers and conflict-style as a low-weight cue.',
    },
  ];
  return rows.map((row) => ({
    ...row,
    label: COMPATIBILITY_DOMAIN_LABELS[row.id],
    band: bandForDomainScore(row.score),
  }));
}

export const COMPATIBILITY_OVERALL_PERCENT_TEMPORARY_FLAG =
  'User-facing overall % is retained temporarily pending a product decision to lead with domain labels only. Internal ranking uses compat_v6 (same core weights as compat_v5_concrete_life) and is not presented as a scientifically calibrated single percentage.';

export function compatibilityPresentationVersion(): string {
  return COMPATIBILITY_ALGORITHM_VERSION;
}
