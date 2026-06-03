import { supabase } from '@/data/supabase/client';
import { profilesRepo } from '@/data/repos/profilesRepo';
import type { MatchPreferences } from '@/shared/hooks/filterPreferences/types';
import type { OnboardingData } from '@/datingProfile/screens/onboarding/modals/types';

function profileJsonObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return { ...(raw as Record<string, unknown>) };
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      /* ignore */
    }
  }
  return {};
}

function stripRelationshipType(prefs: Record<string, unknown>): MatchPreferences {
  const { relationshipType: _, ...rest } = prefs;
  return rest as MatchPreferences;
}

/** Map stored profile + legacy pref* columns into dealbreaker `matchPreferences`. */
export function normalizeMatchPreferencesFromProfile(
  profile: Record<string, unknown>,
): MatchPreferences {
  const rawPrefs = profileJsonObject(profile.matchPreferences ?? profile.match_preferences);
  const prefs = stripRelationshipType({ ...rawPrefs });

  const heightDynamic =
    prefs.heightDynamicPreference ??
    prefs.height_dynamic_preference ??
    profile.heightDynamicPreference ??
    profile.height_dynamic_preference;
  if (heightDynamic != null && String(heightDynamic).trim()) {
    prefs.heightDynamicPreference = String(heightDynamic).trim();
  }

  if (!Array.isArray(prefs.ageRange) || prefs.ageRange.length !== 2) {
    const min =
      prefs.prefAgeMin ??
      profile.prefAgeMin ??
      profile.pref_age_min;
    const max =
      prefs.prefAgeMax ??
      profile.prefAgeMax ??
      profile.pref_age_max;
    if (min != null && max != null) {
      prefs.ageRange = [Number(min), Number(max)];
    }
  }

  return prefs;
}

export async function fetchOnboardingMatchPreferencesDraft(
  userId: string,
): Promise<MatchPreferences | null> {
  const { data, error } = await supabase
    .from('onboarding_progress')
    .select('onboarding_data')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);

  const onboardingData = (data?.onboarding_data ?? {}) as OnboardingData;
  const mp = onboardingData.matchPreferences;
  if (!mp || typeof mp !== 'object' || Array.isArray(mp)) return null;
  return stripRelationshipType({ ...(mp as Record<string, unknown>) });
}

function mergeMatchPreferences(
  ...sources: Array<MatchPreferences | null | undefined>
): MatchPreferences {
  const out: MatchPreferences = {};
  for (const src of sources) {
    if (!src || typeof src !== 'object' || Array.isArray(src)) continue;
    Object.assign(out, src);
  }
  return out;
}

/** Profile JSON first; merge onboarding draft when attraction fields are missing. */
export async function resolveMatchPreferencesForEdit(
  userId: string,
  profile: Record<string, unknown>,
): Promise<MatchPreferences> {
  const fromProfile = normalizeMatchPreferencesFromProfile(profile);
  const heightFromProfile = String(fromProfile.heightDynamicPreference ?? '').trim();
  if (heightFromProfile) return fromProfile;

  try {
    const fromDraft = await fetchOnboardingMatchPreferencesDraft(userId);
    if (fromDraft) {
      return mergeMatchPreferences(fromProfile, fromDraft);
    }
  } catch (e) {
    if (__DEV__) console.warn('[matchPreferencesProfileService] onboarding draft', e);
  }
  return fromProfile;
}

/** Deep-merge into existing profile `matchPreferences` (avoids wiping fields on partial saves). */
export async function mergeAndPersistMatchPreferences(
  userId: string,
  patch: MatchPreferences,
): Promise<void> {
  const current = await profilesRepo.getProfile(userId);
  const existing =
    current.success && current.data?.matchPreferences
      ? stripRelationshipType(
          profileJsonObject(current.data.matchPreferences),
        )
      : {};
  const cleanPatch = stripRelationshipType({ ...patch });
  await profilesRepo.updateProfile(userId, {
    matchPreferences: { ...existing, ...cleanPatch },
  });
}
