import { useState, useEffect, useMemo } from "react";
import { onboardingService } from "@/data/services/onboardingService";

type OnboardingStep = "basic" | "birthinfo" | "filters" | "lifedomains" | "photos" | "done";

interface UseOnboardingNavigationParams {
  userId: string | undefined;
}

interface UseOnboardingNavigationReturn {
  step: OnboardingStep;
  setStep: (step: OnboardingStep) => void;
  progress: number;
  currentStepNumber: number;
  totalSteps: number;
  minutesRemaining: number;
}

export const useOnboardingNavigation = ({
  userId,
}: UseOnboardingNavigationParams): UseOnboardingNavigationReturn => {
  const [step, setStep] = useState<OnboardingStep>("basic");

  const requiredSteps: OnboardingStep[] = [
    "basic",
    "birthinfo",
    "filters",
    "lifedomains",
    "photos",
  ];
  const totalSteps = requiredSteps.length;
  const inRequired = requiredSteps.includes(step);
  const currentIndex = inRequired
    ? requiredSteps.indexOf(step)
    : totalSteps - 1;
  const currentStepNumber = inRequired ? currentIndex + 1 : totalSteps;
  const progress = Math.min(1, Math.max(0, currentStepNumber / totalSteps));

  // Estimated time remaining
  const stepToServiceKey: Record<string, string> = {
    basic: "basic-info",
    birthinfo: "birth-info",
    filters: "filters",
    lifedomains: "life-domains",
    photos: "photos",
  };
  const remainingSteps = requiredSteps.slice(
    Math.min(currentIndex + (inRequired ? 0 : 1), totalSteps)
  );
  const minutesRemaining = remainingSteps.reduce(
    (sum, s) =>
      sum + onboardingService.getEstimatedTimeForStep(stepToServiceKey[s]),
    0
  );

  // Resume step where user left off
  useEffect(() => {
    let active = true;
    (async () => {
      if (!userId) return;
      const next = await onboardingService.getNextOnboardingStep(userId);
      if (active && next.success) {
        const s = next.data;
        if (s === "basic-info") setStep("basic");
        else if (s === "birth-info") setStep("birthinfo");
        else if (s === "filters") setStep("filters");
        else if (s === "life-domains") setStep("lifedomains");
        else if (s === "photos") setStep("photos");
        else setStep("done");
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  return {
    step,
    setStep,
    progress,
    currentStepNumber,
    totalSteps,
    minutesRemaining,
  };
};


