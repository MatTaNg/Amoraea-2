import { supabase } from '@data/supabase/client';

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/** Merge profile_json with onboarding draft answers for demographic rollups. */
export function mergeAdminCohortDemographicFields(
  profileJson: unknown,
  onboardingData: unknown,
): Record<string, unknown> {
  const profile = asRecord(profileJson) ?? {};
  const draft = asRecord(onboardingData) ?? {};
  return {
    ...profile,
    gender: profile.gender ?? draft.gender,
    age: profile.age ?? draft.age,
    birthDate:
      profile.birthDate ??
      profile.birth_date ??
      profile.dateOfBirth ??
      draft.dateOfBirth ??
      draft.birthDate,
  };
}

/** Batch-load profile + onboarding draft fields for admin cohort demographics. */
export async function fetchAdminCohortProfileDemographics(
  userIds: string[],
): Promise<Map<string, unknown>> {
  const map = new Map<string, unknown>();
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return map;

  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const [profilesRes, progressRes] = await Promise.all([
      supabase.from('profiles').select('id, profile_json').in('id', chunk),
      supabase
        .from('onboarding_progress')
        .select('user_id, onboarding_data')
        .in('user_id', chunk),
    ]);

    if (profilesRes.error) {
      console.warn('[AdminCohortDemographics] profiles fetch failed', profilesRes.error.message);
    }
    if (progressRes.error) {
      console.warn('[AdminCohortDemographics] onboarding_progress fetch failed', progressRes.error.message);
    }

    const progressByUser = new Map<string, unknown>();
    for (const row of progressRes.data ?? []) {
      progressByUser.set(
        String((row as { user_id: string }).user_id),
        (row as { onboarding_data: unknown }).onboarding_data,
      );
    }

    const profileRows = new Map<string, unknown>();
    for (const row of profilesRes.data ?? []) {
      profileRows.set(String((row as { id: string }).id), (row as { profile_json: unknown }).profile_json);
    }

    for (const userId of chunk) {
      map.set(
        userId,
        mergeAdminCohortDemographicFields(profileRows.get(userId), progressByUser.get(userId)),
      );
    }
  }

  return map;
}
