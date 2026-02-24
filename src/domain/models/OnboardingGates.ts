/**
 * Onboarding gates: stages, application status, and gate payloads.
 * Used for routing and storing Stage 1–4 data.
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

export interface Gate1Score {
  pillarScores: Record<string, number>;
  pillarConfidence?: Record<string, string>;
  averageScore: number;
  narrativeCoherence: string;
  behavioralSpecificity: string;
  noExampleConstructs?: string[];
  avoidanceSignals?: string[];
  passed: boolean;
  failReasons: string[];
  scoredAt: string;
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
