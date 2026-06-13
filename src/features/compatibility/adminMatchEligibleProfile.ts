import type { SupabaseClient } from '@supabase/supabase-js';
import { PROFILES_ROW_SELECT } from '@data/supabase/userInterviewRoutingSelect';
import { isProfileComplete } from '@/datingProfile/data/services/onboarding/progress/profileCompletenessChecker';
import type { UserProfile } from '@/datingProfile/types';

const PROFILE_PHOTO_KEYS = ['photos', 'photo_urls', 'photoUrls', 'profilePhotos'] as const;

function profileJsonObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }
  return {};
}

function rawPhotoFieldLooksNonempty(v: unknown): boolean {
  if (!Array.isArray(v) || v.length === 0) return false;
  for (const item of v) {
    if (typeof item === 'string' && item.trim()) return true;
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      const u = o.public_url ?? o.publicUrl ?? o.url ?? o.uri;
      if (typeof u === 'string' && u.trim()) return true;
    }
  }
  return false;
}

function mergeProfileRowFlat(row: Record<string, unknown>): Record<string, unknown> {
  const json = profileJsonObject(row.profile_json);
  let flat: Record<string, unknown> = { ...json };
  for (const [k, v] of Object.entries(row)) {
    if (k === 'profile_json' || k === 'id') continue;
    if (v === undefined || v === null) continue;
    if (
      (PROFILE_PHOTO_KEYS as readonly string[]).includes(k) &&
      Array.isArray(v) &&
      v.length === 0 &&
      rawPhotoFieldLooksNonempty(flat.photos)
    ) {
      continue;
    }
    flat[k] = v;
  }
  return { ...flat, ...json };
}

function mergePhotoUrls(flat: Record<string, unknown>, tableUrls: string[]): void {
  if (!tableUrls.length) return;
  const existingRaw = flat.photos;
  const stringsFromExisting: string[] = [];
  if (Array.isArray(existingRaw)) {
    for (const x of existingRaw) {
      if (typeof x === 'string' && x.trim()) stringsFromExisting.push(x.trim());
      else if (x && typeof x === 'object') {
        const o = x as Record<string, unknown>;
        const u = o.public_url ?? o.publicUrl ?? o.url ?? o.uri;
        if (typeof u === 'string' && u.trim()) stringsFromExisting.push(u.trim());
      }
    }
  }
  const seen = new Set(stringsFromExisting);
  const merged = [...stringsFromExisting];
  for (const u of tableUrls) {
    if (!seen.has(u)) {
      seen.add(u);
      merged.push(u);
    }
  }
  if (merged.length) flat.photos = merged;
}

export function isUserProfileMatchEligible(profile: UserProfile | null | undefined): boolean {
  return isProfileComplete(profile ?? null);
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Returns user IDs whose dating profile is complete enough for compatibility matching. */
export async function fetchMatchEligibleUserIds(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<Set<string>> {
  const eligible = new Set<string>();
  if (userIds.length === 0) return eligible;

  const profileById = new Map<string, Record<string, unknown>>();
  for (const ids of chunk(userIds, 200)) {
    const { data, error } = await supabase.from('profiles').select(PROFILES_ROW_SELECT).in('id', ids);
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      profileById.set(row.id, row as Record<string, unknown>);
    }
  }

  const photosByUser = new Map<string, string[]>();
  for (const ids of chunk(userIds, 200)) {
    const { data, error } = await supabase
      .from('profile_photos')
      .select('profile_id, public_url')
      .in('profile_id', ids)
      .order('display_order', { ascending: true });
    if (error) {
      // Optional table / RLS — treat as no join-table photos.
      continue;
    }
    for (const row of data ?? []) {
      const userId = (row as { profile_id?: string }).profile_id;
      const url = (row as { public_url?: unknown }).public_url;
      if (!userId || typeof url !== 'string' || !url.trim()) continue;
      const list = photosByUser.get(userId) ?? [];
      list.push(url.trim());
      photosByUser.set(userId, list);
    }
  }

  for (const userId of userIds) {
    const row = profileById.get(userId) ?? null;
    if (!row) continue;
    const flat = mergeProfileRowFlat(row);
    mergePhotoUrls(flat, photosByUser.get(userId) ?? []);
    if (isUserProfileMatchEligible(flat as UserProfile)) {
      eligible.add(userId);
    }
  }

  return eligible;
}
