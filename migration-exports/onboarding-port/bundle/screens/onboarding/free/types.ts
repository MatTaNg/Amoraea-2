import { AvailabilitySlot } from '@/src/types';

export interface OnboardingData {
  name?: string;
  birthPlace?: string;
  birthDate?: string;
  birthTime?: string;
  gender?: string;
  attractedTo?: string[];
  relationshipStyle?: string;
  location?: string;
  availability?: AvailabilitySlot[];
  contactPreference?: string;
  phoneNumber?: string;
  photos?: string[];
  bio?: string;
}

export interface OnboardingProgress {
  currentStep: string;
  completedSteps: string[];
  onboardingData: OnboardingData;
}


