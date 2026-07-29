/**
 * Print gender/age distribution for interview-completed cohort.
 * Usage: npx tsx --env-file=.env scripts/printAdminCohortDemographics.ts
 */
import { createClient } from '@supabase/supabase-js';
import {
  computeAdminCohortDemographics,
  type AdminCohortDemographics,
} from '@features/admin/interviewDashboard/adminCohortDemographics';
import { mergeAdminCohortDemographicFields } from '@features/admin/interviewDashboard/fetchAdminCohortProfileDemographics';

function printDistribution(title: string, stats: AdminCohortDemographics): void {
  console.log(`\n${title}`);
  console.log('='.repeat(title.length));
  console.log(`Cohort size: ${stats.cohortSize}`);
  console.log(`Gender known: ${stats.withGender}/${stats.cohortSize}`);
  for (const row of stats.gender) {
    console.log(`  ${row.label.padEnd(12)} ${String(row.count).padStart(3)} (${row.percentage}%)`);
  }
  console.log(`Age known: ${stats.withAge}/${stats.cohortSize}`);
  if (stats.ageMean != null) {
    console.log(
      `  Mean ${stats.ageMean} · Median ${stats.ageMedian} · Range ${stats.ageMin}–${stats.ageMax}`,
    );
  }
  for (const row of stats.ageBuckets) {
    console.log(`  ${row.label.padEnd(8)} ${String(row.count).padStart(3)} (${row.percentage}% of known ages)`);
  }
}

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
  const { data: users, error: usersErr } = await sb
    .from('users')
    .select('id, email, basic_info, interview_completed')
    .eq('interview_completed', true);
  if (usersErr) throw usersErr;

  const completed = users ?? [];
  const ids = completed.map((u) => u.id);
  const profileMap = new Map<string, unknown>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const [profilesRes, progressRes] = await Promise.all([
      sb.from('profiles').select('id, profile_json').in('id', chunk),
      sb.from('onboarding_progress').select('user_id, onboarding_data').in('user_id', chunk),
    ]);
    const progressByUser = new Map<string, unknown>();
    for (const row of progressRes.data ?? []) {
      progressByUser.set(String((row as { user_id: string }).user_id), (row as { onboarding_data: unknown }).onboarding_data);
    }
    const profileRows = new Map<string, unknown>();
    for (const row of profilesRes.data ?? []) {
      profileRows.set(String((row as { id: string }).id), (row as { profile_json: unknown }).profile_json);
    }
    for (const userId of chunk) {
      profileMap.set(
        userId,
        mergeAdminCohortDemographicFields(profileRows.get(userId), progressByUser.get(userId)),
      );
    }
  }

  const stats = computeAdminCohortDemographics(
    completed.map((u) => ({ id: u.id, basic_info: u.basic_info })),
    profileMap,
  );

  printDistribution('INTERVIEW-COMPLETED COHORT DEMOGRAPHICS', stats);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
