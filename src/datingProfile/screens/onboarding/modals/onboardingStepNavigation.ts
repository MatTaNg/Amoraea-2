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
  lifeDomainAnswers?: Partial<Record<LifeDomainId, Record<string, string | undefined>>> | null;
};

/** Steps order with inactive conditional steps removed. */
export function getEffectiveOnboardingStepsOrder(
  ctx?: OnboardingNavigationContext | null,
): OnboardingStep[] {
  const wantKids = ctx?.wantKids;
  const activeLifeDomainSteps = new Set(
    getActiveLifeDomainRequiredQuestionSteps(wantKids).map((row) => row.step),
  );
  const activeOptionalSteps = new Set(
    getActiveLifeDomainOptionalOpenEndedSteps(
      wantKids,
      ctx?.lifeDomainAnswers ?? undefined,
    ).map((row) => row.step),
  );
  const includeTypology = shouldShowTypologyOnboardingStep(ctx?.typology);

  return ONBOARDING_STEPS_ORDER.filter((step) => {
    if (isLifeDomainRequiredQuestionStep(step)) {
      return activeLifeDomainSteps.has(step);
    }
    if (isLifeDomainOptionalOpenEndedStep(step)) {
      return activeOptionalSteps.has(step);
    }
    if (step === 'typology') {
      return includeTypology;
    }
    return true;
  });
}

/** Map a stale/inactive saved step to the nearest active step in canonical order. */
export function resolveRestoredOnboardingStep(
  rawStep: OnboardingStep,
  ctx?: OnboardingNavigationContext | null,
): OnboardingStep {
  const activeSteps = getEffectiveOnboardingStepsOrder(ctx);
  if (activeSteps.includes(rawStep)) return rawStep;

  const canonicalIndex = ONBOARDING_STEPS_ORDER.indexOf(rawStep);
  if (canonicalIndex < 0) return activeSteps[0] ?? 'name';

  for (let i = canonicalIndex + 1; i < ONBOARDING_STEPS_ORDER.length; i++) {
    const candidate = ONBOARDING_STEPS_ORDER[i];
    if (activeSteps.includes(candidate)) return candidate;
  }
  for (let i = canonicalIndex - 1; i >= 0; i--) {
    const candidate = ONBOARDING_STEPS_ORDER[i];
    if (activeSteps.includes(candidate)) return candidate;
  }
  return activeSteps[0] ?? 'name';
}

function findPrevActiveStep(
  currentStep: OnboardingStep,
  activeSteps: OnboardingStep[],
): OnboardingStep | null {
  const index = activeSteps.indexOf(currentStep);
  if (index > 0) return activeSteps[index - 1] ?? null;
  if (index === 0) return null;

  const canonicalIndex = ONBOARDING_STEPS_ORDER.indexOf(currentStep);
  if (canonicalIndex <= 0) return null;
  for (let i = canonicalIndex - 1; i >= 0; i--) {
    const candidate = ONBOARDING_STEPS_ORDER[i];
    if (activeSteps.includes(candidate)) return candidate;
  }
  return null;
}

function findNextActiveStep(
  currentStep: OnboardingStep,
  activeSteps: OnboardingStep[],
): OnboardingStep | null {
  const index = activeSteps.indexOf(currentStep);
  if (index >= 0 && index < activeSteps.length - 1) {
    return activeSteps[index + 1] ?? null;
  }
  if (index >= 0) return null;

  const canonicalIndex = ONBOARDING_STEPS_ORDER.indexOf(currentStep);
  if (canonicalIndex < 0 || canonicalIndex >= ONBOARDING_STEPS_ORDER.length - 1) return null;
  for (let i = canonicalIndex + 1; i < ONBOARDING_STEPS_ORDER.length; i++) {
    const candidate = ONBOARDING_STEPS_ORDER[i];
    if (activeSteps.includes(candidate)) return candidate;
  }
  return null;
}

export function getNextOnboardingStep(
  currentStep: OnboardingStep,
  ctx?: OnboardingNavigationContext | null,
): OnboardingStep | null {
  return findNextActiveStep(currentStep, getEffectiveOnboardingStepsOrder(ctx));
}

export function getPrevOnboardingStep(
  currentStep: OnboardingStep,
  ctx?: OnboardingNavigationContext | null,
): OnboardingStep | null {
  return findPrevActiveStep(currentStep, getEffectiveOnboardingStepsOrder(ctx));
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
