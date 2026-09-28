import type { LifeDomainId } from '@/shared/constants/lifeDomainOnboardingQuestions';
import type { OnboardingLifeDomainKey } from '@/shared/components/LifeDomainDistribution';

export const DOMAIN_ID_TO_ONBOARDING_KEY: Record<
  LifeDomainId,
  OnboardingLifeDomainKey
> = {
  intimacy: 'intimacy',
  finance: 'finance',
  spirituality: 'spirituality',
  family: 'family',
  health: 'physicalHealth',
};

export const ONBOARDING_KEY_TO_DOMAIN_ID: Record<
  OnboardingLifeDomainKey,
  LifeDomainId
> = {
  intimacy: 'intimacy',
  finance: 'finance',
  spirituality: 'spirituality',
  family: 'family',
  physicalHealth: 'health',
};
