/**
 * Compare launch waitlist RPC vs user-level pass flags.
 * Usage: npx tsx --env-file=.env scripts/diagnoseLaunchWaitlistPassCount.ts
 */
import { createClient } from '@supabase/supabase-js';

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('Missing Supabase env');
    process.exit(1);
  }

  const sb = createClient(url, key);

  const { data: rpcCount, error: rpcErr } = await sb.rpc('get_launch_waitlist_passed_count');
  console.log('RPC get_launch_waitlist_passed_count:', rpcCount, rpcErr?.message ?? '');

  const { data: users, error: usersErr } = await sb
    .from('users')
    .select(
      'id, email, interview_completed, interview_passed, interview_passed_computed, interview_passed_admin_override',
    );
  if (usersErr) throw usersErr;

  const { data: attempts, error: attemptsErr } = await sb
    .from('interview_attempts')
    .select('id, user_id, passed, completed_at, is_phantom, override_status, pillar_scores')
    .or('is_phantom.eq.false,is_phantom.is.null')
    .not('completed_at', 'is', null);
  if (attemptsErr) throw attemptsErr;

  const completedUsers = (users ?? []).filter((u) => u.interview_completed === true);
  const userPassed = completedUsers.filter((u) => u.interview_passed === true);

  const passedAttempts = (attempts ?? []).filter((a) => a.passed === true);
  const distinctPassedUsers = new Set(passedAttempts.map((a) => a.user_id));

  // Latest completed attempt per user
  const latestByUser = new Map<string, (typeof attempts)[0]>();
  for (const a of attempts ?? []) {
    const prev = latestByUser.get(a.user_id);
    if (!prev || String(a.completed_at) > String(prev.completed_at)) {
      latestByUser.set(a.user_id, a);
    }
  }

  const adminLatestByUser = new Map<string, (typeof attempts)[0]>();
  const attemptFinishedMs = (a: (typeof attempts)[0]) => {
    const raw = a.completed_at ?? a.created_at;
    const t = raw ? new Date(raw).getTime() : NaN;
    return Number.isFinite(t) ? t : 0;
  };
  for (const u of users ?? []) {
    const userAttempts = (attempts ?? [])
      .filter((a) => a.user_id === u.id)
      .sort((a, b) => attemptFinishedMs(b) - attemptFinishedMs(a));
    if (userAttempts[0]) adminLatestByUser.set(u.id, userAttempts[0]);
  }

  const latestPassed = [...latestByUser.values()].filter((a) => a.passed === true);
  const scoredCompleted = (attempts ?? []).filter((a) => a.pillar_scores);

  console.log('users interview_completed=true:', completedUsers.length);
  console.log('users interview_completed + interview_passed=true:', userPassed.length);
  console.log('attempts passed=true (completed, non-phantom):', passedAttempts.length);
  console.log('distinct users with ANY passed attempt:', distinctPassedUsers.size);
  console.log('distinct users whose LATEST completed attempt passed:', latestPassed.length);
  console.log('scored completed attempts with passed=true:', scoredCompleted.filter((a) => a.passed === true).length);

  const adminStylePass = completedUsers.filter((u) => {
    if (u.interview_passed === true) return true;
    if (u.interview_passed_admin_override === true) return true;
    const latest = latestByUser.get(u.id);
    if (latest?.override_status === true) return true;
    return false;
  });
  console.log('completed users with interview_passed OR admin override pass:', adminStylePass.length);

  const nonSeedCompleted = completedUsers.filter(
    (u) => !String(u.email ?? '').toLowerCase().endsWith('@seed.amoraea.test'),
  );
  const nonSeedPassed = nonSeedCompleted.filter((u) => u.interview_passed === true);
  console.log('non-seed completed users:', nonSeedCompleted.length);
  console.log('non-seed completed + interview_passed=true:', nonSeedPassed.length);

  const { data: seedProfiles } = await sb
    .from('profiles')
    .select('id')
    .eq('profile_json->compatibilityTestSeed->>tag', 'compat-algo-v2');
  const seedIds = new Set((seedProfiles ?? []).map((r) => r.id));
  const cohortCompleted = completedUsers.filter((u) => !seedIds.has(u.id));
  const cohortPassed = cohortCompleted.filter((u) => u.interview_passed === true);
  console.log('cohort (exclude seed profile tag) completed:', cohortCompleted.length);
  console.log('cohort completed + interview_passed=true:', cohortPassed.length);

  const forcedFailDespiteUserPass = cohortCompleted.filter((u) => {
    if (u.interview_passed !== true) return false;
    const latest = latestByUser.get(u.id);
    return latest?.override_status === false || u.interview_passed_admin_override === false;
  });
  console.log('cohort interview_passed=true but forced fail override:', forcedFailDespiteUserPass.length);
  for (const u of forcedFailDespiteUserPass) {
    const latest = latestByUser.get(u.id);
    console.log(
      `  ${u.email ?? u.id.slice(0, 8)} attempt.override=${latest?.override_status} admin_override=${u.interview_passed_admin_override}`,
    );
  }

  const cohortEffectivePass = cohortCompleted.filter((u) => {
    const latest = latestByUser.get(u.id);
    if (latest?.override_status === false) return false;
    if (u.interview_passed_admin_override === false) return false;
    if (latest?.override_status === true) return true;
    if (u.interview_passed_admin_override === true) return true;
    if (u.interview_passed === true) return true;
    return latest?.passed === true;
  });
  console.log('cohort effective pass (override-aware, incl attempt.passed fallback):', cohortEffectivePass.length);

  const gateRecomputeCandidates = cohortCompleted.filter((u) => {
    if (u.interview_passed_admin_override === false) return false;
    if (u.interview_passed === true) return false;
    if (u.interview_passed_admin_override === true) return true;
    const latest = latestByUser.get(u.id);
    return latest?.passed === true;
  });
  console.log('cohort pass via attempt.passed (no interview_passed):', gateRecomputeCandidates.length);

  const sqlStylePass = cohortCompleted.filter((u) => {
    if (u.interview_passed_admin_override === false) return false;
    if (u.interview_passed_admin_override === true) return true;
    if (u.interview_passed === true) return true;
    const latest = latestByUser.get(u.id);
    if (latest?.override_status === false) return false;
    if (latest?.override_status === true) return true;
    return u.interview_passed == null && latest?.passed === true;
  });
  console.log('SQL-style pass count (user row + latest attempt flags):', sqlStylePass.length);

  const emailSeedExcluded = sqlStylePass.filter(
    (u) => !String(u.email ?? '').toLowerCase().endsWith('@seed.amoraea.test'),
  );
  console.log('SQL-style pass excluding @seed.amoraea.test emails:', emailSeedExcluded.length);

  const adminLatestStylePass = cohortCompleted.filter((u) => {
    if (u.interview_passed_admin_override === false) return false;
    if (u.interview_passed_admin_override === true) return true;
    if (u.interview_passed === true) return true;
    const latest = adminLatestByUser.get(u.id);
    if (latest?.override_status === false) return false;
    if (latest?.override_status === true) return true;
    return latest?.passed === true;
  }).filter((u) => !String(u.email ?? '').toLowerCase().endsWith('@seed.amoraea.test'));
  console.log('admin latestAttempt sort pass count:', adminLatestStylePass.length);

  const seedInPass = sqlStylePass.filter(
    (u) =>
      seedIds.has(u.id) || String(u.email ?? '').toLowerCase().endsWith('@seed.amoraea.test'),
  );
  console.log('seed users in SQL-style pass list:', seedInPass.length);
  for (const u of seedInPass) {
    console.log(`  ${u.email}`);
  }

  const effCompMismatch = cohortCompleted.filter((u) => {
    const eff = u.interview_passed;
    const comp = u.interview_passed_computed;
    return (eff === true || eff === false) && (comp === true || comp === false) && eff !== comp;
  });
  console.log('completed users eff!==comp:', effCompMismatch.length);
  for (const u of effCompMismatch) {
    console.log(
      `  ${u.email} eff=${u.interview_passed} comp=${u.interview_passed_computed} override=${u.interview_passed_admin_override}`,
    );
  }

  function adminPrimaryPass(u: (typeof users)[0]): boolean {
    const latest = adminLatestByUser.get(u.id);
    if (latest?.override_status === true) return true;
    if (latest?.override_status === false) return false;
    if (u.interview_passed_admin_override === true) return true;
    if (u.interview_passed_admin_override === false) return false;
    const eff = u.interview_passed;
    const comp = u.interview_passed_computed;
    if ((eff === true || eff === false) && (comp === true || comp === false) && eff !== comp) {
      return eff === true;
    }
    if (u.interview_passed === true) return true;
    if (u.interview_passed == null && latest?.passed === true) return true;
    return false;
  }

  const adminPrimaryPassUsers = cohortCompleted.filter((u) => adminPrimaryPass(u));
  console.log('adminPrimaryPass simulation (no gate recompute):', adminPrimaryPassUsers.length);

  const userRowOnlyPass = cohortCompleted.filter((u) => {
    if (u.interview_passed_admin_override === false) return false;
    if (u.interview_passed_admin_override === true) return true;
    const eff = u.interview_passed;
    const comp = u.interview_passed_computed;
    if ((eff === true || eff === false) && (comp === true || comp === false) && eff !== comp) {
      return eff === true;
    }
    return u.interview_passed === true;
  });
  console.log('user-row-only pass (no attempt fallback):', userRowOnlyPass.length);
  const infoUser = (users ?? []).find((u) => u.email === 'info@tinakaragulian.com');
  if (infoUser) {
    const latest = adminLatestByUser.get(infoUser.id);
    console.log(
      'info@tinakaragulian.com completed=',
      infoUser.interview_completed,
      'in cohort=',
      cohortCompleted.some((u) => u.id === infoUser.id),
      'adminPrimaryPass=',
      adminPrimaryPass(infoUser),
      'ip=',
      infoUser.interview_passed,
      'comp=',
      infoUser.interview_passed_computed,
      'override=',
      infoUser.interview_passed_admin_override,
      'attempt.passed=',
      latest?.passed,
      'attempt.override=',
      latest?.override_status,
    );
  }
  const passViaAttemptOnly = adminPrimaryPassUsers.filter((u) => u.interview_passed !== true);
  console.log('  via attempt.passed only (interview_passed not true):', passViaAttemptOnly.length);
  for (const u of passViaAttemptOnly) {
    const latest = adminLatestByUser.get(u.id);
    console.log(
      `    ${u.email} ip=${u.interview_passed} latest.passed=${latest?.passed} has_pillar=${!!latest?.pillar_scores}`,
    );
  }

  const adminOnly = adminStylePass.filter((u) => !distinctPassedUsers.has(u.id));
  const rpcOnly = [...distinctPassedUsers].filter((uid) => {
    const u = completedUsers.find((x) => x.id === uid);
    return !u || u.interview_passed !== true;
  });

  console.log('');
  console.log('Admin-style pass but no passed attempt on record:', adminOnly.length);
  for (const u of adminOnly.slice(0, 20)) {
    const latest = latestByUser.get(u.id);
    console.log(
      `  ${u.email ?? u.id.slice(0, 8)} ip=${u.interview_passed} ip_comp=${u.interview_passed_computed} override=${u.interview_passed_admin_override} latest.passed=${latest?.passed}`,
    );
  }

  console.log('');
  console.log('Distinct passed-attempt users where interview_passed !== true:', rpcOnly.length);
  for (const uid of rpcOnly.slice(0, 10)) {
    const u = users?.find((x) => x.id === uid);
    const latest = latestByUser.get(uid);
    console.log(
      `  ${u?.email ?? uid.slice(0, 8)} ip=${u?.interview_passed} latest.passed=${latest?.passed}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
