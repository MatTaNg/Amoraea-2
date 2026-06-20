/**
 * Backfill profiles.assessmentsCompleted for users who finished relationship-validation
 * typology but saved instruments with skipProfileUpdate (profile flags never synced).
 *
 * Usage: npx tsx --env-file=.env scripts/backfillValidationTypologyProfileSync.ts [email]
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const ASSESSMENT_IDS = [
  'SEXUAL_COMMUNICATION',
  'PVQ-21',
  'CONFLICT-30',
  'ECR-36',
] as const;

function mergeEnv(): void {
  const path = join(process.cwd(), '.env');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq < 1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

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

function batteryComplete(instruments: string[]): boolean {
  const done = new Set(instruments);
  return ASSESSMENT_IDS.every((id) => done.has(id));
}

async function syncUserProfile(
  sb: ReturnType<typeof createClient>,
  userId: string,
  email: string,
): Promise<'synced' | 'already' | 'incomplete'> {
  const { data: profile } = await sb.from('profiles').select('profile_json').eq('id', userId).maybeSingle();
  const json = profileJsonObject(profile?.profile_json);
  if (json.assessmentsCompleted === true) return 'already';

  const { data: assessments } = await sb
    .from('user_assessments')
    .select('instrument')
    .eq('user_id', userId);
  const instruments = (assessments ?? []).map((r) => String(r.instrument));
  if (!batteryComplete(instruments)) return 'incomplete';

  const now = new Date().toISOString();
  const nextJson = {
    ...json,
    assessmentsCompleted: true,
    assessmentsCompletedAt: json.assessmentsCompletedAt ?? now,
    assessmentsStarted: true,
    currentAssessment: null,
    currentAssessmentQuestion: null,
  };

  const { error } = await sb
    .from('profiles')
    .update({ profile_json: nextJson, updated_at: now })
    .eq('id', userId);
  if (error) throw new Error(`${email}: ${error.message}`);
  return 'synced';
}

async function main(): Promise<void> {
  mergeEnv();
  const url = process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('Missing Supabase env');
    process.exit(1);
  }
  const sb = createClient(url, key);
  const emailArg = process.argv[2]?.trim();

  if (emailArg) {
    const { data: user } = await sb.from('users').select('id, email').eq('email', emailArg).maybeSingle();
    if (!user) {
      console.log('No user for', emailArg);
      return;
    }
    const result = await syncUserProfile(sb, user.id, user.email ?? emailArg);
    console.log(user.email, result);
    return;
  }

  const { data: validationRows, error } = await sb
    .from('relationship_validation_records')
    .select('user_id, psychometrics_completed_at')
    .not('psychometrics_completed_at', 'is', null);
  if (error) throw new Error(error.message);

  let synced = 0;
  let already = 0;
  let incomplete = 0;
  for (const row of validationRows ?? []) {
    const userId = String(row.user_id);
    const { data: user } = await sb.from('users').select('email').eq('id', userId).maybeSingle();
    const email = user?.email ?? userId;
    const result = await syncUserProfile(sb, userId, email);
    if (result === 'synced') synced += 1;
    else if (result === 'already') already += 1;
    else incomplete += 1;
    console.log(email, result);
  }
  console.log(`Done: synced=${synced} already=${already} incomplete=${incomplete}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
