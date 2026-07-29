export type Gender = 'Man' | 'Woman' | 'Non-binary';

export type AttractedToOption = 'Men' | 'Women' | 'Non-binary';

export interface Location {
  latitude: number;
  longitude: number;
  label: string | null;
}

/** Onboarding gates — re-export for convenience */
export type { OnboardingStage, ApplicationStatus, BasicInfo } from './OnboardingGates';

/** One profile prompt answer (UX only, not used by algorithm). */
export interface ProfilePromptAnswer {
  promptId: string;
  categoryId: string;
  answer: string;
}

/**
 * Mapped from `public.users` (interview / legacy onboarding).
 * Dating profile fields live in `public.profiles.profile_json` via `profilesRepo`.
 */
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
  /** True when account used the alpha tester referral code — sees scoring/analysis UX after interview. */
  isAlphaTester: boolean;
  /** When true, weighted interview gate uses 5.5 instead of 6.0 (referral benefit; floors unchanged). */
  referralBoostActive: boolean;
  /** One-shot notice when someone you referred completed their interview (cleared when dismissed). */
  referralNoticePending: string | null;
  /** From `users.interview_completed` — used to restore PostInterview route after refresh for standard applicants. */
  interviewCompleted: boolean;
  /** True only when `users.interview_passed` is true (weighted interview gate). */
  interviewPassed: boolean;
  /** True when the gate returned a definite fail (`users.interview_passed === false`), including the “almost” band. */
  interviewFailed: boolean;
  /** Up to 3 prompt answers (UX only). */
  prompts: ProfilePromptAnswer[];

  // Onboarding gates
  onboardingStage: OnboardingStage;
  applicationStatus: ApplicationStatus;
  basicInfo: BasicInfo | null;
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
  basicInfo?: BasicInfo | null;
  referralNoticePending?: string | null;
}

