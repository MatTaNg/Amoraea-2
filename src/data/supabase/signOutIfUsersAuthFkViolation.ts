import { supabase } from './client';

/**
 * After an admin deletes `auth.users`, the client may still hold a cached JWT until `getUser()` runs.
 * Inserts into `public.users` then fail with FK `users_id_fkey` (Postgres 23503). Clear the bad session.
 */
export async function signOutIfUsersAuthFkViolation(err: { code?: string; message?: string } | null | undefined): Promise<boolean> {
  if (!err || err.code !== '23503') return false;
  const msg = err.message ?? '';
  if (!msg.includes('users_id_fkey')) return false;
  await supabase.auth.signOut();
  return true;
}
