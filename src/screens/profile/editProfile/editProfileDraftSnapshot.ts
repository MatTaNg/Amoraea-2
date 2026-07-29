import type { OnboardingLifeDomainValues } from '@/shared/components/LifeDomainDistribution';
import type { ArchetypeId } from '@/shared/constants/archetypes';
import type { ProfilePromptAnswer } from '@domain/models/Profile';
import type { TypologyPickerValue } from '@/shared/components/profileFields/TypologyPickerFields';
import type { MatchPreferences } from '@/shared/hooks/filterPreferences/types';
import type { LifeDomainAnswersMap } from '@/screens/profile/editProfile/lifeDomainProfileService';

/** Fields the edit profile form actually edits — ignore noisy profile blob keys. */
export const EDIT_PROFILE_TRACKED_DRAFT_KEYS = [
  'displayName',
  'name',
  'gender',
  'ethnicity',
  'birthDate',
  'birthTime',
  'birthLocation',
  'location',
  'relationshipStyle',
  'longestRomanticRelationship',
  'occupation',
  'educationLevel',
  'hobbies',
  'professionalHobbyId',
  'workout',
  'smoking',
  'drinking',
  'recreationalDrugsSocial',
  'relationshipWithPsychedelics',
  'relationshipWithCannabis',
  'haveKids',
  'wantKids',
  'politics',
  'religion',
  'sexDrive',
  'datingPaceAfterExcitement',
  'recentDatingEarlyWeeks',
  'spaceForNewRelationship',
  'partnerMoodMismatchResponse',
  'sexualFocusPreference',
  'questionAnswers',
] as const;

export type EditProfileTrackedDraftKey = (typeof EDIT_PROFILE_TRACKED_DRAFT_KEYS)[number];

export type EditProfileFormSnapshot = {
  draft: Record<string, unknown>;
  photoUrls: string[];
  attractedUi: string[];
  sexInterestSelected: string[];
  lifeDomainsState: OnboardingLifeDomainValues;
  weightLbsStr: string;
  heightCmPick: number | undefined;
  typologyValues: TypologyPickerValue;
  matchPrefs: MatchPreferences;
  prefPhysicalCompatImportance: string;
  prefPartnerSharesSexualInterests: string;
  prefPartnerHasChildren: string;
  prefPartnerPoliticalAlignmentImportance: string;
  archetypeSelection: ArchetypeId[];
  lifeDomainAnswers: LifeDomainAnswersMap;
  validatedBirthLocation: string | undefined;
  profilePrompts: ProfilePromptAnswer[];
};

export type EditProfileFormSnapshotInput = EditProfileFormSnapshot;

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const sorted: Record<string, unknown> = {};
      for (const key of Object.keys(v as Record<string, unknown>).sort()) {
        sorted[key] = (v as Record<string, unknown>)[key];
      }
      return sorted;
    }
    return v;
  });
}

export function pickTrackedEditProfileDraftFields(
  draft: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of EDIT_PROFILE_TRACKED_DRAFT_KEYS) {
    if (key in draft) {
      out[key] = draft[key];
    }
  }
  return out;
}

export function buildEditProfileFormSnapshot(
  input: EditProfileFormSnapshotInput,
): EditProfileFormSnapshot {
  return {
    draft: pickTrackedEditProfileDraftFields(input.draft),
    photoUrls: [...input.photoUrls],
    attractedUi: [...input.attractedUi],
    sexInterestSelected: [...input.sexInterestSelected],
    lifeDomainsState: { ...input.lifeDomainsState },
    weightLbsStr: input.weightLbsStr,
    heightCmPick: input.heightCmPick,
    typologyValues: { ...input.typologyValues },
    matchPrefs: { ...input.matchPrefs },
    prefPhysicalCompatImportance: input.prefPhysicalCompatImportance,
    prefPartnerSharesSexualInterests: input.prefPartnerSharesSexualInterests,
    prefPartnerHasChildren: input.prefPartnerHasChildren,
    prefPartnerPoliticalAlignmentImportance:
      input.prefPartnerPoliticalAlignmentImportance,
    archetypeSelection: [...input.archetypeSelection],
    lifeDomainAnswers: { ...input.lifeDomainAnswers },
    validatedBirthLocation: input.validatedBirthLocation,
    profilePrompts: [...input.profilePrompts],
  };
}

export function serializeEditProfileFormSnapshot(
  snapshot: EditProfileFormSnapshot,
): string {
  return stableStringify(snapshot);
}

export function editProfileFormSnapshotsEqual(
  left: EditProfileFormSnapshot,
  right: EditProfileFormSnapshot,
): boolean {
  return serializeEditProfileFormSnapshot(left) === serializeEditProfileFormSnapshot(right);
}

/** Keep auto-refreshed GPS location from counting as an unsaved edit. */
export function patchEditProfileFormSnapshotLocation(
  snapshot: EditProfileFormSnapshot,
  location: string,
): EditProfileFormSnapshot {
  return {
    ...snapshot,
    draft: { ...snapshot.draft, location },
  };
}
