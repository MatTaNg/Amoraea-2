/**
 * Types for the ported dating onboarding bundle (`@/src/types`).
 * Kept permissive so DB JSON merges don't fight the typechecker.
 */
export type Result<T> =
  | { success: true; data: T }
  | { success: false; error: Error; data?: undefined };

export type AvailabilitySlot = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type TraitScores = Record<string, unknown> & {
  userId?: string;
  updatedAt?: string;
  attachmentAnxious?: number;
  attachmentAvoidant?: number;
  openness?: number;
  conscientiousness?: number;
  extraversion?: number;
  agreeableness?: number;
  neuroticism?: number;
  spiralLevel?: number;
  humanDesignType?: string;
  humanDesignProfile?: string;
  humanDesignCenters?: unknown;
  conflictCompeting?: number;
  conflictCollaborating?: number;
  conflictCompromising?: number;
  conflictAvoiding?: number;
  conflictAccommodating?: number;
};

export type UserProfile = Record<string, unknown>;

export type OnboardingProgress = {
  userId: string;
  basicInfoCompleted: boolean;
  additionalInfoCompleted: boolean;
  availabilityCompleted: boolean;
  attachmentTestCompleted: boolean;
  bigFiveTestCompleted: boolean;
  spiralDynamicsTestCompleted: boolean;
  humanDesignCompleted: boolean;
  lifeDomainsCompleted: boolean;
  isProfileComplete: boolean;
  updatedAt: string;
};

export type AssessmentInsightSnapshot = {
  instrumentLabel?: string;
  headline?: string;
  body?: string;
  growthEdge?: string;
  details?: Array<{ label: string; value: string; description: string }>;
  aiParagraphs?: string[];
  /** Legacy / simple paragraph-only snapshots */
  instrument?: string;
  title?: string;
  paragraphs?: string[];
};
