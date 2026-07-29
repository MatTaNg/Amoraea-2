import { supabase } from '@data/supabase/client';
import { USER_INTERVIEW_APPLICATION_SELECT } from '@data/supabase/userInterviewRoutingSelect';
import { profilesRepo } from '@data/repos/profilesRepo';
import { updateUserInterviewApplication } from '@data/repos/usersInterviewRepo';
import type {
  AttractedToOption,
  BasicInfo,
  Gender,
  Location,
  ProfilePromptAnswer,
  ProfileUpdate,
} from '@domain/models/Profile';
import { mapAttractionToDb, normalizeAttractedToUiLabels } from '@/shared/utils/attractionMapper';
import { mapGenderToDb, mapGenderToUi } from '@/shared/utils/genderMapper';
import {
  assertValidProfilePromptsForServerSave,
  normalizeProfilePromptAnswers,
} from '@/features/profile/profilePromptValidation';

function parseProfilePrompts(v: unknown): ProfilePromptAnswer[] {
  return normalizeProfilePromptAnswers(v);
}

function parseBasicInfo(v: unknown): BasicInfo | null {
  if (v === null || v === undefined || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  return {
    firstName: typeof o.firstName === 'string' ? o.firstName : '',
    age: typeof o.age === 'number' ? o.age : 0,
    gender: typeof o.gender === 'string' ? o.gender : '',
    attractedTo: Array.isArray(o.attractedTo) ? o.attractedTo.filter((x): x is string => typeof x === 'string') : [],
    locationCity: typeof o.locationCity === 'string' ? o.locationCity : '',
    locationCountry: typeof o.locationCountry === 'string' ? o.locationCountry : '',
    photoUrl: typeof o.photoUrl === 'string' ? o.photoUrl : '',
    heightCm: typeof o.heightCm === 'number' ? o.heightCm : 0,
  };
}

function pickString(...candidates: unknown[]): string {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
  }
  return '';
}

function pickNumber(...candidates: unknown[]): number | undefined {
  for (const c of candidates) {
    if (typeof c === 'number' && !Number.isNaN(c)) return c;
    if (typeof c === 'string' && c.trim()) {
      const n = parseInt(c, 10);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

export type EditProfileSnapshot = {
  name: string;
  age?: number;
  gender?: Gender;
  attractedTo: AttractedToOption[];
  heightCentimeters?: number;
  occupation: string;
  primaryPhotoUrl: string | null;
  prompts: ProfilePromptAnswer[];
  basicInfo: BasicInfo | null;
};

/** Load edit-profile fields from `profiles.profile_json` + interview fields on `users`. */
export async function loadEditProfileSnapshot(userId: string): Promise<EditProfileSnapshot | null> {
  const [profileRes, appRes] = await Promise.all([
    profilesRepo.getProfile(userId),
    supabase.from('users').select(USER_INTERVIEW_APPLICATION_SELECT).eq('id', userId).maybeSingle(),
  ]);

  if (appRes.error) throw new Error(appRes.error.message);

  const flat = profileRes.success && profileRes.data ? (profileRes.data as Record<string, unknown>) : {};
  const appRow = (appRes.data ?? {}) as Record<string, unknown>;

  const basicInfo = parseBasicInfo(appRow.basic_info);
  const name = pickString(flat.displayName, flat.display_name, flat.name);
  const age = pickNumber(flat.age) ?? (basicInfo?.age && basicInfo.age > 0 ? basicInfo.age : undefined);

  const genderRaw = flat.gender;
  const genderUi = typeof genderRaw === 'string' ? mapGenderToUi(genderRaw) : undefined;
  const gender = genderUi && ['Man', 'Woman', 'Non-binary'].includes(genderUi) ? (genderUi as Gender) : undefined;

  const attractedRaw = flat.attractedTo ?? flat.lookingFor;
  const attractedTo = normalizeAttractedToUiLabels(
    Array.isArray(attractedRaw) ? (attractedRaw as string[]) : [],
  ) as AttractedToOption[];

  const heightCentimeters = pickNumber(flat.height_cm, flat.heightCentimeters) ?? undefined;
  const occupation = pickString(flat.occupation);
  const primaryPhotoUrl =
    pickString(flat.primaryPhotoUrl, flat.primary_photo_url, flat.avatar_url, flat.avatarUrl) || null;
  const prompts = parseProfilePrompts(appRow.profile_prompts);

  if (!profileRes.success && !appRes.data) return null;

  return {
    name,
    age,
    gender,
    attractedTo,
    heightCentimeters,
    occupation,
    primaryPhotoUrl: primaryPhotoUrl || null,
    prompts,
    basicInfo,
  };
}

export type EditProfileDemographicsPatch = {
  name: string;
  age: number;
  gender: Gender;
  attractedTo: AttractedToOption[];
  heightCentimeters: number;
  occupation: string;
};

/** Persist demographics to `profiles.profile_json` (not legacy `users` columns). */
export async function saveEditProfileDemographics(
  userId: string,
  data: EditProfileDemographicsPatch,
): Promise<void> {
  await applyProfileUpdate(userId, data);
}

export async function saveEditProfileLocation(userId: string, location: Location): Promise<void> {
  const result = await profilesRepo.updateProfile(userId, {
    location_latitude: location.latitude,
    location_longitude: location.longitude,
    location_label: location.label,
    locationLatitude: location.latitude,
    locationLongitude: location.longitude,
    locationLabel: location.label,
    location: location.label ?? undefined,
  });
  if (!result.success) throw result.error;
}

export async function saveEditProfilePrimaryPhoto(userId: string, publicUrl: string): Promise<void> {
  const result = await profilesRepo.updateProfile(userId, {
    primaryPhotoUrl: publicUrl,
    primary_photo_url: publicUrl,
    avatar_url: publicUrl,
    avatarUrl: publicUrl,
  });
  if (!result.success) throw result.error;
}

/** Interview UX prompts remain on `users.profile_prompts`. */
export async function saveEditProfilePrompts(userId: string, prompts: ProfilePromptAnswer[]): Promise<void> {
  const normalized = normalizeProfilePromptAnswers(prompts);
  assertValidProfilePromptsForServerSave(normalized, { requireSetupFloor: true });
  await updateUserInterviewApplication(userId, { prompts: normalized });
}

function hasDatingProfileFields(update: ProfileUpdate): boolean {
  return (
    update.name !== undefined ||
    update.age !== undefined ||
    update.gender !== undefined ||
    update.attractedTo !== undefined ||
    update.heightCentimeters !== undefined ||
    update.occupation !== undefined ||
    update.location !== undefined ||
    update.primaryPhotoUrl !== undefined
  );
}

/**
 * Route a `ProfileUpdate` to canonical stores:
 * - demographics / location / avatar → `profiles.profile_json`
 * - prompts / gates / basicInfo → `users` (interview application)
 */
export async function applyProfileUpdate(userId: string, update: ProfileUpdate): Promise<void> {
  if (hasDatingProfileFields(update)) {
    const patch: Record<string, unknown> = {};
    if (update.name !== undefined) {
      patch.name = update.name;
      patch.displayName = update.name;
      patch.display_name = update.name;
    }
    if (update.age !== undefined) patch.age = update.age;
    if (update.gender !== undefined) {
      patch.gender = mapGenderToDb(update.gender) ?? update.gender;
    }
    if (update.attractedTo !== undefined) {
      const mapped = mapAttractionToDb(update.attractedTo);
      patch.attractedTo = mapped ?? update.attractedTo;
      patch.lookingFor = patch.attractedTo;
    }
    if (update.heightCentimeters !== undefined) {
      patch.height_cm = update.heightCentimeters;
      patch.heightCentimeters = update.heightCentimeters;
    }
    if (update.occupation !== undefined) patch.occupation = update.occupation;

    if (Object.keys(patch).length > 0) {
      const result = await profilesRepo.updateProfile(userId, patch);
      if (!result.success) throw result.error;
    }
  }

  if (update.location !== undefined) {
    await saveEditProfileLocation(userId, update.location);
  }
  if (update.primaryPhotoUrl !== undefined) {
    await saveEditProfilePrimaryPhoto(userId, update.primaryPhotoUrl);
  }

  const appPatch: Parameters<typeof updateUserInterviewApplication>[1] = {};
  if (update.prompts !== undefined) {
    const normalized = normalizeProfilePromptAnswers(update.prompts);
    assertValidProfilePromptsForServerSave(normalized, { requireSetupFloor: true });
    appPatch.prompts = normalized;
  }
  if (update.onboardingStage !== undefined) appPatch.onboardingStage = update.onboardingStage;
  if (update.applicationStatus !== undefined) appPatch.applicationStatus = update.applicationStatus;
  if (update.basicInfo !== undefined) appPatch.basicInfo = update.basicInfo;
  if (Object.keys(appPatch).length > 0) {
    await updateUserInterviewApplication(userId, appPatch);
  }
}
