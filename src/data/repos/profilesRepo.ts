import { supabase } from '../supabase/client';
import type { Result, UserProfile } from '../../datingProfile/types';

/** When `profiles.profile_json` is missing on the server, we stash dating fields here until migrations run. */
const OVERLAY_METADATA_KEY = 'dating_profile_overlay';

function pickNonEmptyString(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === 'string' && c.trim() !== '') return c.trim();
  }
  return null;
}

/** Existing DB row keys to carry into upsert so we do not wipe NOT NULL / legacy top-level columns. */
function compactProfileRowForUpsert(existing: Record<string, unknown> | null): Record<string, unknown> {
  if (!existing) return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(existing)) {
    if (k === 'id' || k === 'profile_json') continue;
    if (v !== null && v !== undefined) out[k] = v;
  }
  return out;
}

/** Update path only: set `key` if the server row already has that column (avoids PGRST on unknown columns on insert). */
function setTopLevelIfColumnExists(
  row: Record<string, unknown>,
  existingRow: Record<string, unknown> | null,
  key: string,
  value: unknown,
) {
  if (value === null || value === undefined) return;
  if (!existingRow || !Object.prototype.hasOwnProperty.call(existingRow, key)) return;
  row[key] = value;
}

function isMissingProfileJsonColumnError(e: { message?: string; code?: string } | null): boolean {
  if (!e?.message) return false;
  const m = e.message;
  return (
    (e.code === 'PGRST204' && m.includes('profile_json')) ||
    (m.includes('profile_json') && (m.includes('schema cache') || m.includes('Could not find')))
  );
}

/** `profile_json` / overlays may arrive as objects or JSON strings depending on client/driver. */
function profileJsonObject(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
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

const PROFILE_PHOTO_KEYS = ['photos', 'photo_urls', 'photoUrls', 'profilePhotos'] as const;

function rawPhotoFieldLooksNonempty(v: unknown): boolean {
  if (!Array.isArray(v) || v.length === 0) return false;
  for (const item of v) {
    if (typeof item === 'string' && item.trim() !== '') {
      const t = item.trim();
      if (
        /^https?:\/\//i.test(t) ||
        t.startsWith('//') ||
        t.startsWith('file:') ||
        t.startsWith('blob:') ||
        t.startsWith('content:')
      ) {
        return true;
      }
    }
    if (item && typeof item === 'object' && !Array.isArray(item)) {
      const o = item as Record<string, unknown>;
      const u = o.public_url ?? o.publicUrl ?? o.url ?? o.uri;
      if (typeof u === 'string' && u.trim() !== '') return true;
    }
  }
  return false;
}

/** True when merged flat already has photo URLs from `profile_json` (avoid wiping with legacy empty top-level arrays). */
function mergedFlatHasPhotoUrls(flat: Record<string, unknown>): boolean {
  for (const key of PROFILE_PHOTO_KEYS) {
    if (rawPhotoFieldLooksNonempty(flat[key])) return true;
  }
  const prim = flat.primary_photo_url ?? flat.primaryPhotoUrl ?? flat.avatar_url ?? flat.avatarUrl;
  return typeof prim === 'string' && prim.trim() !== '';
}

/** Append URLs from `profile_photos` when onboarding/API stored gallery rows but `photos` JSON stayed empty. */
async function mergeProfilePhotosJoinTable(userId: string, flat: Record<string, unknown>): Promise<void> {
  try {
    const { data, error } = await supabase
      .from('profile_photos')
      .select('public_url')
      .eq('profile_id', userId)
      .order('display_order', { ascending: true });
    if (error || !data?.length) return;
    const tableUrls = data
      .map((r) => {
        const u = (r as { public_url?: unknown }).public_url;
        return typeof u === 'string' ? u.trim() : '';
      })
      .filter(Boolean);
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
  } catch {
    /* optional legacy table / RLS */
  }
}

/**
 * Dating-app `profiles` row (from your migrated schema).
 * We merge updates into `profile_json` when that column exists; otherwise we merge a shallow
 * overlay in `auth.user_metadata` so onboarding can still persist (e.g. relationship style).
 */
async function readMergedProfile(
  userId: string,
  options?: { existingRow?: Record<string, unknown> | null },
): Promise<Record<string, unknown>> {
  let data: Record<string, unknown> | null = null;
  if (options && 'existingRow' in options) {
    data = options.existingRow ?? null;
  } else {
    const { data: fetched, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
    if (error) throw new Error(error.message);
    data = fetched as Record<string, unknown> | null;
  }

  let flat: Record<string, unknown> = {};
  if (data) {
    const row = data as Record<string, unknown>;
    const json = profileJsonObject(row.profile_json);
    flat = { ...json };
    for (const [k, v] of Object.entries(row)) {
      if (k === 'profile_json' || k === 'id') continue;
      if (v === undefined || v === null) continue;
      if (
        (PROFILE_PHOTO_KEYS as readonly string[]).includes(k) &&
        Array.isArray(v) &&
        v.length === 0 &&
        mergedFlatHasPhotoUrls(flat)
      ) {
        continue;
      }
      flat[k] = v;
    }
  }

  const { data: authData } = await supabase.auth.getUser();
  const u = authData?.user;
  if (u?.id === userId && u.user_metadata && typeof u.user_metadata === 'object') {
    const raw = (u.user_metadata as Record<string, unknown>)[OVERLAY_METADATA_KEY];
    const overlayFlat = profileJsonObject(raw);
    if (Object.keys(overlayFlat).length > 0) {
      flat = { ...flat, ...overlayFlat };
    }
  }
  return flat;
}

async function clearDatingProfileOverlay(): Promise<void> {
  const { data: authData } = await supabase.auth.getUser();
  const u = authData?.user;
  if (!u?.user_metadata || typeof u.user_metadata !== 'object') return;
  if (!(OVERLAY_METADATA_KEY in u.user_metadata)) return;
  const meta = { ...(u.user_metadata as Record<string, unknown>) };
  delete meta[OVERLAY_METADATA_KEY];
  await supabase.auth.updateUser({ data: meta });
}

export const profilesRepo = {
  async getProfile(userId: string): Promise<Result<UserProfile>> {
    try {
      const merged = await readMergedProfile(userId);
      await mergeProfilePhotosJoinTable(userId, merged);
      return { success: true, data: merged as UserProfile };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  },

  async ensureProfile(userId: string, email?: string): Promise<Result<UserProfile>> {
    try {
      const fallbackName =
        email && email.includes('@') ? email.split('@')[0]!.trim() || 'Member' : 'Member';
      const { data: exData, error: exErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (exErr) return { success: false, error: new Error(exErr.message) };
      const ex = exData as Record<string, unknown> | null;

      const payload: Record<string, unknown> = {
        ...compactProfileRowForUpsert(ex),
        id: userId,
        display_name: fallbackName,
        updated_at: new Date().toISOString(),
      };
      if (email) payload.email = email;
      if (!ex) payload.created_at = new Date().toISOString();
      setTopLevelIfColumnExists(payload, ex, 'full_name', fallbackName);
      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
      if (error) return { success: false, error: new Error(error.message) };
      return this.getProfile(userId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  },

  async updateProfile(userId: string, patch: Record<string, unknown>): Promise<Result<UserProfile>> {
    try {
      const { data: existingRowData, error: existingErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      if (existingErr) throw new Error(existingErr.message);
      const ex = existingRowData as Record<string, unknown> | null;

      const current = await readMergedProfile(userId, { existingRow: ex });
      const nextFlat = { ...current, ...patch };
      const profile_json = { ...nextFlat };

      const { data: authData } = await supabase.auth.getUser();
      const u = authData?.user;
      const fromAuth =
        u?.id === userId && typeof u.email === 'string' && u.email.trim() !== '' ? u.email.trim() : null;
      const fromFlat =
        typeof nextFlat.email === 'string' && nextFlat.email.trim() !== '' ? nextFlat.email.trim() : null;
      let emailForRow = fromAuth || fromFlat;

      if (!emailForRow && ex?.email && typeof ex.email === 'string' && ex.email.trim() !== '') {
        emailForRow = ex.email.trim();
      }
      if (!emailForRow) {
        return {
          success: false,
          error: new Error(
            'Cannot save profile: no email on this account. Try signing out and signing in again.',
          ),
        };
      }

      const meta =
        u?.user_metadata && typeof u.user_metadata === 'object'
          ? (u.user_metadata as Record<string, unknown>)
          : {};
      const displayNameForRow =
        pickNonEmptyString(
          nextFlat.display_name,
          nextFlat.displayName,
          ex?.display_name,
          meta.full_name,
          meta.name,
          meta.preferred_username,
          emailForRow.includes('@') ? emailForRow.split('@')[0] : undefined,
        ) ?? 'Member';

      const row: Record<string, unknown> = {
        ...compactProfileRowForUpsert(ex),
        id: userId,
        email: emailForRow,
        display_name: displayNameForRow,
        profile_json,
        updated_at: new Date().toISOString(),
      };
      if (!ex) {
        row.created_at = new Date().toISOString();
      }

      const fullNameVal =
        pickNonEmptyString(nextFlat.full_name, nextFlat.fullName) ?? displayNameForRow;
      setTopLevelIfColumnExists(row, ex, 'full_name', fullNameVal);

      const avatarPick = pickNonEmptyString(
        nextFlat.avatar_url,
        nextFlat.avatarUrl,
        nextFlat.primaryPhotoUrl,
      );
      if (avatarPick) setTopLevelIfColumnExists(row, ex, 'avatar_url', avatarPick);

      const websitePick = pickNonEmptyString(nextFlat.website);
      if (websitePick) setTopLevelIfColumnExists(row, ex, 'website', websitePick);

      const usernameVal = pickNonEmptyString(nextFlat.username);
      if (usernameVal) setTopLevelIfColumnExists(row, ex, 'username', usernameVal);

      const { error } = await supabase.from('profiles').upsert(row, { onConflict: 'id' });
      if (!error) {
        await clearDatingProfileOverlay();
        return { success: true, data: nextFlat as UserProfile };
      }

      if (!isMissingProfileJsonColumnError(error)) {
        return { success: false, error: new Error(error.message) };
      }

      if (!u || u.id !== userId) {
        return { success: false, error: new Error(error.message) };
      }

      const prev = (u.user_metadata as Record<string, unknown> | undefined)?.[OVERLAY_METADATA_KEY];
      const prevObj =
        prev && typeof prev === 'object' && !Array.isArray(prev) ? { ...(prev as Record<string, unknown>) } : {};
      const nextOverlay = { ...prevObj, ...patch };
      const { error: authErr } = await supabase.auth.updateUser({
        data: {
          ...(typeof u.user_metadata === 'object' && u.user_metadata ? u.user_metadata : {}),
          [OVERLAY_METADATA_KEY]: nextOverlay,
        },
      });
      if (authErr) {
        return { success: false, error: new Error(authErr.message) };
      }
      return { success: true, data: nextFlat as UserProfile };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e : new Error(String(e)) };
    }
  },
};
