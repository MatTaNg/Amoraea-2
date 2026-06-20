/** Inspect dating profile state for a user by email. */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

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
  const email = process.argv[2] ?? 'mattang5280@gmail.com';

  const { data: user } = await sb.from('users').select('*').eq('email', email).maybeSingle();
  if (!user) {
    console.log('No users row for', email);
    return;
  }
  console.log('USER', user.id, email);
  console.log('  validation_track:', user.validation_track);
  console.log('  validation_standard_app_enrolled:', user.validation_standard_app_enrolled);
  console.log('  validation_flow_active:', user.validation_flow_active);
  console.log('  psychometrics_sexual_communication_completed_at:', user.psychometrics_sexual_communication_completed_at);
  console.log('  psychometrics_sexual_communication_skipped_at:', user.psychometrics_sexual_communication_skipped_at);

  const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle();
  console.log('\nPROFILES row:', profile ? 'yes' : 'NO');
  if (profile) {
    console.log('  assessmentsStarted:', profile.assessments_started);
    console.log('  assessmentsCompleted:', profile.assessments_completed);
    console.log('  onboardingCompleted:', profile.onboarding_completed);
    console.log('  currentAssessment:', profile.current_assessment);
    const pj = profile.profile_json;
    const pjObj = pj && typeof pj === 'object' ? (pj as Record<string, unknown>) : {};
    console.log('  profile_json keys:', Object.keys(pjObj).slice(0, 30));
    console.log('  profile_json.assessmentsCompleted:', pjObj.assessmentsCompleted);
  }

  const { data: assessments } = await sb
    .from('user_assessments')
    .select('instrument, scores, completed_at')
    .eq('user_id', user.id);
  console.log('\nUSER_ASSESSMENTS:', (assessments ?? []).length);
  for (const a of assessments ?? []) {
    const scores = a.scores as Record<string, unknown> | null;
    const keys = scores && typeof scores === 'object' ? Object.keys(scores) : [];
    console.log(`  ${a.instrument}  completed=${a.completed_at?.slice(0, 10) ?? '—'}  score_keys=${keys.join(',') || '(empty)'}`);
  }

  const { data: progress } = await sb
    .from('onboarding_progress')
    .select('current_step, completed_steps, onboarding_data')
    .eq('user_id', user.id)
    .maybeSingle();
  console.log('\nONBOARDING_PROGRESS:', progress ? 'yes' : 'NO');
  if (progress) {
    console.log('  current_step:', progress.current_step);
    console.log('  completed_steps:', progress.completed_steps);
    const od = progress.onboarding_data as Record<string, unknown> | null;
    console.log('  onboarding_data keys:', od ? Object.keys(od).slice(0, 20) : null);
  }

  const { data: validation } = await sb
    .from('relationship_validation_records')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  console.log('\nRELATIONSHIP_VALIDATION:', validation ? 'yes' : 'NO');
  if (validation) {
    console.log('  welcome_completed_at:', validation.welcome_completed_at);
    console.log('  psychometrics_completed_at:', validation.psychometrics_completed_at);
    console.log('  partner_email:', validation.partner_email_entered);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
