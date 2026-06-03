import {
  getActiveLifeDomainOptionalOpenEndedSteps,
  getActiveLifeDomainRequiredQuestionSteps,
  isLifeDomainOptionalOpenEndedStep,
  isLifeDomainRequiredQuestionStep,
  type LifeDomainId,
} from '@/shared/constants/lifeDomainOnboardingQuestions';
import {
  shouldShowTypologyOnboardingStep,
  type TypologyOnboardingAnswers,
} from '@/shared/constants/typologyOnboardingOptions';
import { ONBOARDING_STEPS_ORDER, type OnboardingStep } from './onboardingStepOrder';

export type OnboardingNavigationContext = {
  wantKids?: string | null;
  typology?: TypologyOnboardingAnswers | null;
};

/** Steps order with inactive conditional steps removed. */
export function getEffectiveOnboardingStepsOrder(ctx?: OnboardingNavigationContext | null): OnboardingStep[] {
  const wantKids = ctx?.wantKids;
  const activeLifeDomainSteps = new Set(
    getActiveLifeDomainRequiredQuestionSteps(wantKids).map((row) => row.step),
  );
  const includeTypology = shouldShowTypologyOnboardingStep(ctx?.typology);
  return ONBOARDING_STEPS_ORDER.filter((step) => {
    if (isLifeDomainRequiredQuestionStep(step)) {
      return activeLifeDomainSteps.has(step);
    }
    if (step === 'typology') {
      return includeTypology;
    }
    return true;
  });
}

export function getNextOnboardingStep(
  currentStep: OnboardingStep,
  ctx?: OnboardingNavigationContext | null,
): OnboardingStep | null {
  const steps = getEffectiveOnboardingStepsOrder(ctx);
  const index = steps.indexOf(currentStep);
  if (index < 0 || index >= steps.length - 1) return null;
  return steps[index + 1] ?? null;
}

export function getPrevOnboardingStep(
  currentStep: OnboardingStep,
  ctx?: OnboardingNavigationContext | null,
): OnboardingStep | null {
  const steps = getEffectiveOnboardingStepsOrder(ctx);
  const index = steps.indexOf(currentStep);
  if (index <= 0) return null;
  return steps[index - 1] ?? null;
}

export function getOnboardingNavigationContext(
  onboardingData?: {
    wantKids?: string | null;
    typology?: TypologyOnboardingAnswers | null;
    lifeDomainAnswers?: Partial<Record<LifeDomainId, Record<string, string | undefined>>>;
  } | null,
): OnboardingNavigationContext {
  return {
    wantKids: onboardingData?.wantKids,
    typology: onboardingData?.typology,
    lifeDomainAnswers: onboardingData?.lifeDomainAnswers,
  };
}
