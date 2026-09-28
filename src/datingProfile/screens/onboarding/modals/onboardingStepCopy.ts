import { MAX_PROFILE_PROMPTS } from '@/features/profile/profilePromptsLibrary';
import { HOBBY_DEFINITION } from '@/shared/constants/hobbies';

/** User-facing subtext for onboarding steps — source of truth for matching edit-profile copy. */

export const EDIT_PROFILE_PAGE_LEAD =
  'Share what makes you, you. It helps us find your best match.';

export const EDIT_PROFILE_STRENGTH_HINT =
  'Complete more to increase your match quality.';

export const EDIT_PROFILE_STRENGTH_TAP_HINT =
  'Tap to see what\u2019s left to complete.';

export const EDIT_PROFILE_STRENGTH_COMPLETE_HINT =
  'Your profile is complete for matching.';

export const EDIT_PROFILE_DEEP_DIVE_LEAD =
  'The deeper we go, the better we can match what matters.';

export const ONBOARDING_PHOTOS_DESCRIPTION = 'Add up to 6 photos.';

export const ONBOARDING_ETHNICITY_DESCRIPTION = 'Tell us about your background.';

export const ONBOARDING_HOBBIES_DESCRIPTION = HOBBY_DEFINITION;

export const ONBOARDING_LOCATION_DESCRIPTION =
  'We use your location to find matches nearby. Location is detected automatically and must be enabled to continue.';

export const ONBOARDING_LONGEST_RELATIONSHIP_DESCRIPTION =
  'What has been your longest romantic relationship?';

export const ONBOARDING_HEIGHT_WEIGHT_NOTE =
  'This is only used to calculate BMI. Your height, weight, and BMI will not be communicated to your potential matches.';

export const ONBOARDING_TYPOLOGY_DESCRIPTION =
  'Optional: add any typology details you would like to share. Skip any field and tap Next when you are ready.';

export const ONBOARDING_LIFE_DOMAINS_DESCRIPTION =
  'Distribute 100 points across the 5 life domains to indicate how important each is to you. All domains must add up to exactly 100.';

export const ONBOARDING_SEXUAL_COMPATIBILITY_LEAD =
  'Answer honestly — this helps us understand what matters to you in matching.';

export const ONBOARDING_HOBBY_DEALBREAKER_DESCRIPTION =
  "If you met someone amazing who didn't share these hobbies with you, how much of a dealbreaker would that be? Which hobby specifically would that be?";

export const ONBOARDING_DEALBREAKERS_LEAD =
  'Please note that although honoring yourself is important, dealbreakers will also significantly reduce potential matches.';

export const ONBOARDING_LIFE_DOMAIN_QUESTIONS_REQUIRED_DESCRIPTION =
  'Answer each required question for this life area to continue. You can add more detail later from your profile.';

export const ONBOARDING_LIFE_DOMAIN_QUESTIONS_OPTIONAL_DESCRIPTION =
  'Optional: share more about this life area if you like. You can skip any question and tap Next.';

export const ONBOARDING_RECREATIONAL_DRUGS_DESCRIPTION =
  'Examples include MDMA, cocaine, or similar in social settings. Cannabis and psychedelics/plant medicines are asked separately.';

export const ONBOARDING_PSYCHEDELICS_DESCRIPTION =
  'Psychedelics and traditional plant medicines (e.g. ayahuasca, peyote in lawful ceremonial contexts). This is separate from alcohol and cannabis.';

export const ONBOARDING_PROFILE_PROMPTS_SETUP_LEAD = `Pick at least one prompt from What Matters To Me or How I Show Up. You can add up to ${MAX_PROFILE_PROMPTS} total — the rest are optional.`;
