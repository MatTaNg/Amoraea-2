/** Pure life-domain slider parsing — safe for Node scripts (no React Native imports). */

export const ONBOARDING_LIFE_DOMAIN_KEYS = [
  'intimacy',
  'finance',
  'spirituality',
  'family',
  'physicalHealth',
] as const;

export type OnboardingLifeDomainKey = (typeof ONBOARDING_LIFE_DOMAIN_KEYS)[number];
export type OnboardingLifeDomainValues = Record<OnboardingLifeDomainKey, number>;

export const DEFAULT_ONBOARDING_LIFE_DOMAINS: OnboardingLifeDomainValues = {
  intimacy: 0,
  finance: 0,
  spirituality: 0,
  family: 0,
  physicalHealth: 0,
};

/** Parse slider values from merged profile JSON (camelCase or snake_case). */
export function normalizeLifeDomainsFromProfile(raw: unknown): OnboardingLifeDomainValues {
  const out: OnboardingLifeDomainValues = { ...DEFAULT_ONBOARDING_LIFE_DOMAINS };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const o = raw as Record<string, unknown>;
  const pick = (key: OnboardingLifeDomainKey, ...aliases: string[]) => {
    for (const alias of [key, ...aliases]) {
      const v = o[alias];
      if (typeof v === 'number' && Number.isFinite(v)) {
        out[key] = Math.max(0, Math.min(100, Math.round(v)));
        return;
      }
    }
  };
  pick('intimacy', 'intimacy');
  pick('finance', 'finance');
  pick('spirituality', 'spirituality');
  pick('family', 'family');
  pick('physicalHealth', 'physical_health', 'physicalHealth', 'health');
  return out;
}
