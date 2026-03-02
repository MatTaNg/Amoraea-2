/**
 * Permanently delete a Supabase auth user (and all app data) by email.
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY (from Supabase Dashboard → Settings → API).
 * Optionally: EXPO_PUBLIC_SUPABASE_URL or SUPABASE_URL (defaults to .env if present).
 *
 * Usage:
 *   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key node scripts/delete-user-by-email.mjs mattang5280@gmail.com
 *
 * Or set SUPABASE_SERVICE_ROLE_KEY in .env.local and run:
 *   node scripts/delete-user-by-email.mjs mattang5280@gmail.com
 */

import { createClient } from '@supabase/supabase-js';

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/delete-user-by-email.mjs <email>');
  process.exit(1);
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    'Missing SUPABASE_SERVICE_ROLE_KEY (and optionally EXPO_PUBLIC_SUPABASE_URL).\n' +
      'Get the service role key from: Supabase Dashboard → Project Settings → API → service_role (secret).'
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

async function main() {
  // List users and find by email (admin API)
  const { data: list, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (listError) {
    console.error('Failed to list users:', listError.message);
    process.exit(1);
  }

  const user = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }

  const { error: deleteError } = await supabase.auth.admin.deleteUser(user.id);
  if (deleteError) {
    console.error('Failed to delete user:', deleteError.message);
    process.exit(1);
  }

  console.log(`Deleted user: ${email} (id: ${user.id}).`);
  console.log('App data (users, typologies, compatibility, profile_photos, aria_sessions) is removed by DB CASCADE.');
}

main();
