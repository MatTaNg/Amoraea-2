import type { SupabaseClient } from '@supabase/supabase-js';

/** Tag written by scripts/seedTestUsers.ts into profiles.profile_json.compatibilityTestSeed. */
export const COMPATIBILITY_TEST_SEED_TAG = 'compat-algo-v2';

export const COMPATIBILITY_TEST_SEED_EMAIL_SUFFIX = '@seed.amoraea.test';

export function isCompatibilityTestSeedEmail(email: string | null | undefined): boolean {
  return String(email ?? '')
    .trim()
    .toLowerCase()
    .endsWith(COMPATIBILITY_TEST_SEED_EMAIL_SUFFIX);
}

export function isCompatibilityTestSeedProfileJson(profileJson: unknown): boolean {
  const seed = (profileJson as Record<string, unknown> | null)?.compatibilityTestSeed;
  return (
    seed != null &&
    typeof seed === 'object' &&
    !Array.isArray(seed) &&
    (seed as Record<string, unknown>).tag === COMPATIBILITY_TEST_SEED_TAG
  );
}

export function isCompatibilityTestSeedUser(
  user: { id?: string; email?: string | null },
  seedUserIds?: ReadonlySet<string>,
): boolean {
  if (user.id && seedUserIds?.has(user.id)) return true;
  return isCompatibilityTestSeedEmail(user.email);
}

/** Profile IDs tagged as compatibility QA seed users (typically 12). */
export async function fetchCompatibilityTestSeedUserIds(
  supabase: SupabaseClient,
): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('profile_json->compatibilityTestSeed->>tag', COMPATIBILITY_TEST_SEED_TAG);

  if (error) {
    console.warn('[compatTestSeed] profile tag lookup failed:', error.message);
    return new Set();
  }

  return new Set((data ?? []).map((row) => row.id));
}
