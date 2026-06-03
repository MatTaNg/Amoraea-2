import { supabase } from '@data/supabase/client';
import { mapGenderToDb, mapGenderToUi } from '@/shared/utils/genderMapper';

/** Canonical DB gender string (`man` | `woman` | `non-binary`) from signup or profile. */
export function normalizeAccountGenderRaw(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.trim()) return undefined;
  const ui = mapGenderToUi(raw.trim());
  if (ui) return mapGenderToDb(ui) ?? raw.trim().toLowerCase();
  return mapGenderToDb(raw.trim()) ?? raw.trim();
}

export function accountGenderFromAuthMetadata(
  metadata: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!metadata) return undefined;
  return normalizeAccountGenderRaw(metadata.gender);
}

/** Load gender from auth metadata or `profiles.profile_json` when not yet merged locally. */
export async function fetchAccountGenderDb(userId: string): Promise<string | undefined> {
  const { data: authData } = await supabase.auth.getUser();
  const u = authData?.user;
  if (u?.id === userId) {
    const fromMeta = accountGenderFromAuthMetadata(
      u.user_metadata && typeof u.user_metadata === 'object'
        ? (u.user_metadata as Record<string, unknown>)
        : undefined,
    );
    if (fromMeta) return fromMeta;
  }

  const { data: profileRow, error } = await supabase
    .from('profiles')
    .select('profile_json')
    .eq('id', userId)
    .maybeSingle();
  if (error) return undefined;
  const rawJson = (profileRow as { profile_json?: unknown } | null)?.profile_json;
  if (rawJson && typeof rawJson === 'object' && !Array.isArray(rawJson)) {
    const fromProfile = normalizeAccountGenderRaw((rawJson as Record<string, unknown>).gender);
    if (fromProfile) return fromProfile;
  }
  return undefined;
}
