import { AvailabilitySlot } from '@/src/types';
import type { ProfilePromptAnswer } from '@domain/models/Profile';
import { MatchPreferences } from '@/shared/hooks/filterPreferences/types';
import type { ArchetypeId } from '@/shared/constants/archetypes';

export interface OnboardingDealbreakerPreferences extends MatchPreferences {
  childrenPreference?: string;
  partnerSameReligionRequired?: string;
  partnerAlignmentTobacco?: string;
  partnerAlignmentRecreationalDrugs?: string;
  partnerAlignmentPsychedelics?: string;
  partnerAlignmentCannabis?: string;
  partnerAlignmentAlcohol?: string;
  heightDynamicPreference?: string;
  ethnicityAttraction?: string[];
}

/** Location from GPS + reverse geocode (step 6). Used for imperial vs metric in Height/Weight. */
export interface OnboardingUserLocation {
  latitude: number;
  longitude: number;
  city?: string;
  region?: string;
  country?: string;
  countryCode?: string;
}

export interface OnboardingData {
  name?: string;
  /** Date of birth as ISO date string (YYYY-MM-DD). Age is derived from this everywhere. */
  dateOfBirth?: string;
  /** 24h time (HH:MM). Optional; used for astrology / charting. */
  birthTime?: string;
  /** Free-text place of birth. Optional; used for astrology / charting. */
  birthLocation?: string;
  gender?: string;
  /** Self-reported ethnicity / heritage (same values as Edit Profile). */
  ethnicity?: string;
  attractedTo?: string[];
  relationshipStyle?: string;
  /** Longest romantic relationship duration (slug, see `longestRomanticRelationshipOptions`). */
  longestRomanticRelationship?: string;
  /** Display string e.g. "City, Region" */
  location?: string;
  occupation?: string;
  educationLevel?: string;
  typology?: {
    loveLanguage?: string;
    myersBriggs?: string;
    enneagramType?: string;
    enneagramWing?: string;
    enneagramInstinct?: string;
    sunSign?: string;
    risingSign?: string;
    moonSign?: string;
    venusSign?: string;
    marsSign?: string;
    saturnSign?: string;
    humanDesignType?: string;
    humanDesignProfile?: string;
    humanDesignAuthority?: string;
    eroticBlueprintType?: string;
    spiralDynamics?: string;
  };
  /** Jungian brand archetypes (`profile_json.archetypes`) — two or three when set. */
  archetypes?: ArchetypeId[];
  /** Full location from GPS (for countryCode → imperial vs metric) */
  userLocation?: OnboardingUserLocation;
  /** Stored in metric (cm). Display in ft/in or cm based on countryCode. */
  height_cm?: number;
  /** Stored in metric (kg). Display in lbs or kg based on countryCode. */
  weight_kg?: number;
  /** Calculated and stored; never shown on profile. */
  bmi?: number;
  /** Legacy UI strings for height/weight when not yet converted to metric */
  height?: string;
  weight?: string;
  workout?: string;
  smoking?: string;
  drinking?: string;
  /** Social use of party drugs (MDMA, cocaine, etc.) — stored as `recreationalDrugsSocial` on profile. */
  recreationalDrugsSocial?: string;
  /** Psychedelics / plant medicines — stored as `relationshipWithPsychedelics` on profile. */
  relationshipWithPsychedelics?: string;
  /** Cannabis (marijuana) — stored as `relationshipWithCannabis` on profile. */
  relationshipWithCannabis?: string;
  haveKids?: string;
  wantKids?: string;
  politics?: string;
  religion?: string;
  /** Dealbreakers + onboarding sexual compatibility step */
  prefPhysicalCompatImportance?: string;
  prefPartnerSharesSexualInterests?: string;
  sexDrive?: string;
  sexInterestCategories?: string[];
  /** Most recent dating: how often you saw each other in the first 2–3 weeks */
  recentDatingEarlyWeeks?: string;
  /** Bandwidth / priority for a new relationship right now */
  spaceForNewRelationship?: string;
  partnerMoodMismatchResponse?: string;
  sexualFocusPreference?: string;
  /** Partner already has children — Yes / No / No preference */
  prefPartnerHasChildren?: string;
  prefPartnerPoliticalAlignmentImportance?: string;
  hobbies?: string;
  professionalHobbyId?: string | null;
  /** Hobby that would be a dealbreaker if a partner did not share it; null = none. */
  hobbyDealbreakerId?: string | null;
  /** Set when the hobby-dealbreaker step has been completed in onboarding. */
  hobbyDealbreakerAnswered?: boolean;
  availability?: AvailabilitySlot[];
  contactPreference?: string;
  phoneNumber?: string;
  photos?: string[];
  bio?: string;
  /** Life domains: object (sliders) for current UI; or string[] for future grid (3–10). */
  lifeDomains?:
    | {
        intimacy: number;
        finance: number;
        spirituality: number;
        family: number;
        physicalHealth: number;
      }
    | string[];
  /** Optional deep-dive answers keyed by domain id → question id → text (resume in onboarding_progress). */
  lifeDomainAnswers?: Partial<
    Record<
      'finance' | 'family' | 'intimacy' | 'spirituality' | 'health',
      Record<string, string>
    >
  >;
  matchPreferences?: OnboardingDealbreakerPreferences;
  /** Hinge-style profile prompts (stored on `users.profile_prompts`). */
  profilePrompts?: ProfilePromptAnswer[];
}

export interface OnboardingProgress {
  currentStep: string;
  completedSteps: string[];
  onboardingData: OnboardingData;
}

