export type Gender = 'Man' | 'Woman' | 'Non-binary';

export type AttractedToOption = 'Men' | 'Women' | 'Non-binary';

export interface Location {
  latitude: number;
  longitude: number;
  label: string | null;
}

/** Onboarding gates (Stage 1–4) — re-export for convenience */
export type { OnboardingStage, ApplicationStatus, BasicInfo, Gate1Score, Gate2Psychometrics, Gate3Compatibility } from './OnboardingGates';

/** One profile prompt answer (UX only, not used by algorithm). */
export interface ProfilePromptAnswer {
  promptId: string;
  answer: string;
}

export interface Profile {
  id: string;
  createdAt: string;
  updatedAt: string;
  onboardingCompleted: boolean;
  onboardingStep: number;
  name: string | null;
  age: number | null;
  gender: Gender | null;
  attractedTo: AttractedToOption[] | null;
  heightCentimeters: number | null;
  occupation: string | null;
  location: Location | null;
  primaryPhotoUrl: string | null;
  inviteCode: string | null;
  /** Up to 3 prompt answers (UX only). */
  prompts: ProfilePromptAnswer[];

  // Onboarding gates
  onboardingStage: OnboardingStage;
  applicationStatus: ApplicationStatus;
  profileVisible: boolean;
  basicInfo: BasicInfo | null;
  gate1Score: Gate1Score | null;
  gate2Psychometrics: Gate2Psychometrics | null;
  gate3Compatibility: Gate3Compatibility | null;
}

export interface ProfilePhoto {
  id: string;
  profileId: string;
  storagePath: string;
  publicUrl: string;
  displayOrder: number;
  createdAt: string;
}

export interface ProfileUpdate {
  name?: string;
  age?: number;
  gender?: Gender;
  attractedTo?: AttractedToOption[];
  heightCentimeters?: number;
  occupation?: string;
  location?: Location;
  primaryPhotoUrl?: string;
  onboardingStep?: number;
  onboardingCompleted?: boolean;
  /** Up to 3 prompt answers. */
  prompts?: ProfilePromptAnswer[];

  onboardingStage?: OnboardingStage;
  applicationStatus?: ApplicationStatus;
  profileVisible?: boolean;
  basicInfo?: BasicInfo | null;
  gate1Score?: Gate1Score | null;
  gate2Psychometrics?: Gate2Psychometrics | null;
  gate3Compatibility?: Gate3Compatibility | null;
}

