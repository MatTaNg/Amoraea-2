import {
  LIFE_DOMAIN_OPTIONAL_OPEN_ENDED_ONBOARDING_STEPS,
  LIFE_DOMAIN_REQUIRED_QUESTION_ONBOARDING_STEPS,
  type LifeDomainOptionalOpenEndedOnboardingStep,
  type LifeDomainRequiredQuestionOnboardingStep,
} from '@/shared/constants/lifeDomainOnboardingQuestions';

/** Screen order per spec: Name -> Dealbreakers flow. No welcome screen. */
export type OnboardingStep =
  | 'name'
  | 'ethnicity'
  | 'ethnicityAttraction'
  | 'attraction'
  | 'dateOfBirth'
  | 'relationshipStyle'
  | 'longestRelationship'
  | 'location'
  | 'educationLevel'
  | 'heightWeight'
  | 'workout'
  | 'smoking'
  | 'partnerAlignmentTobacco'
  | 'drinking'
  | 'partnerAlignmentAlcohol'
  | 'recreationalDrugsSocial'
  | 'partnerAlignmentRecreationalDrugs'
  | 'relationshipPsychedelics'
  | 'partnerAlignmentPsychedelics'
  | 'relationshipCannabis'
  | 'partnerAlignmentCannabis'
  | 'haveKids'
  | 'wantKids'
  | 'prefPartnerHasChildren'
  | 'politics'
  | 'prefPartnerPoliticalAlignment'
  | 'religion'
  | 'partnerSameReligionRequired'
  | 'sexDrive'
  | 'sexInterests'
  | 'partnerSharesSexualInterests'
  | 'partnerMoodMismatch'
  | 'sexualFocus'
  | 'datingPaceAfterExcitement'
  | 'recentDatingEarlyWeeks'
  | 'spaceForNewRelationship'
  | 'lifeDomains'
  | LifeDomainRequiredQuestionOnboardingStep
  | LifeDomainOptionalOpenEndedOnboardingStep
  | 'personalityDocuments'
  | 'typology'
  | 'archetypes'
  | 'photos'
  | 'matchPreferences'
  | 'attractionPreferences'
  | 'profileComplete'
  | 'complete';

export const ONBOARDING_STEPS_ORDER: OnboardingStep[] = [
  'name',
  'attraction',
  'ethnicity',
  'ethnicityAttraction',
  'dateOfBirth',
  'relationshipStyle',
  'longestRelationship',
  'location',
  'educationLevel',
  'heightWeight',
  'workout',
  'smoking',
  'partnerAlignmentTobacco',
  'drinking',
  'partnerAlignmentAlcohol',
  'recreationalDrugsSocial',
  'partnerAlignmentRecreationalDrugs',
  'relationshipPsychedelics',
  'partnerAlignmentPsychedelics',
  'relationshipCannabis',
  'partnerAlignmentCannabis',
  'haveKids',
  'wantKids',
  'prefPartnerHasChildren',
  'politics',
  'prefPartnerPoliticalAlignment',
  'religion',
  'partnerSameReligionRequired',
  'sexDrive',
  'sexInterests',
  'partnerSharesSexualInterests',
  'partnerMoodMismatch',
  'sexualFocus',
  'datingPaceAfterExcitement',
  'recentDatingEarlyWeeks',
  'spaceForNewRelationship',
  'matchPreferences',
  'archetypes',
  'photos',
  'attractionPreferences',
  ...LIFE_DOMAIN_REQUIRED_QUESTION_ONBOARDING_STEPS.map((s) => s.step),
  'lifeDomains',
  ...LIFE_DOMAIN_OPTIONAL_OPEN_ENDED_ONBOARDING_STEPS.map((s) => s.step),
  'typology',
  'personalityDocuments',
  'profileComplete',
  'complete',
];
