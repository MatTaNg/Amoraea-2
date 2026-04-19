/**
 * Onboarding stages stored on `users.onboarding_stage`.
 * The post-interview multi-step flow (basic_info → psychometrics → compatibility) is no longer in the app;
 * new interview completions set `complete`. Legacy DB values are still parsed for old accounts.
 */

export type OnboardingStage =
  | 'basic_info'
  | 'interview'
  | 'psychometrics'
  | 'compatibility'
  | 'complete';

export type ApplicationStatus = 'pending' | 'under_review' | 'approved';

export interface BasicInfo {
  firstName: string;
  age: number;
  gender: string;
  attractedTo: string[];
  locationCity: string;
  locationCountry: string;
  photoUrl: string;
  heightCm: number;
  weightKg: number;
  bmi: number;
  occupation: string;
}

export interface Gate2Psychometrics {
  ecr12: { anxious: number; avoidant: number; classification: string };
  tipi: {
    openness: number;
    conscientiousness: number;
    extraversion: number;
    agreeableness: number;
    neuroticism: number;
  };
  dsisf: { satisfactionScore: number };
  brs: { resilienceScore: number };
  pvq21: {
    selfDirection: number;
    stimulation: number;
    hedonism: number;
    achievement: number;
    power: number;
    security: number;
    conformity: number;
    tradition: number;
    benevolence: number;
    universalism: number;
  };
  completedAt: string;
}

export interface Gate3ProfilePrompt {
  prompt: string;
  answer: string;
}

export interface Gate3Compatibility {
  [key: string]: unknown;
  preferredMinBMI?: number;
  preferredMaxBMI?: number;
  profilePrompts?: Gate3ProfilePrompt[];
  completedAt?: string;
}
