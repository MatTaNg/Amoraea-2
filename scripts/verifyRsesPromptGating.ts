/**
 * Prompt-only verification for RSES base-profile gating.
 * Usage: npx tsx --env-file=.env scripts/verifyRsesPromptGating.ts [attemptId]
 */
import { createClient } from '@supabase/supabase-js';
import { loadPersonalReportPromptForAttempt, extractSelfAssessmentsBlock } from './lib/reportPromptHarness';
import { shouldNarrateInstrument } from '../src/features/reports/narrativeCalibration';

const mattAttemptId = '9199fd17-b9be-46f0-9fba-76460691c7a7';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function checkAttempt(label: string, attemptId: string) {
  const { data, userPrompt: prompt } = await loadPersonalReportPromptForAttempt(supabase, attemptId);
  const gc = data.attempt?.gamingCorrection ?? null;
  const flags = data.user.psychometricStraightLineFlags;
  const narrateRses = shouldNarrateInstrument(data.user.rsesScore, 'rses', gc, flags);
  const selfBlock = extractSelfAssessmentsBlock(prompt) ?? '(missing SELF-ASSESSMENTS block)';
  const hasRsesLine = /Self-esteem and self-worth:/.test(prompt);

  console.log(`\n=== ${label} (${attemptId}) ===`);
  console.log('name:', data.user.name);
  console.log('rsesScore:', data.user.rsesScore);
  console.log('straightLineFlags:', flags);
  console.log('strippedInstruments:', gc?.strippedInstruments ?? []);
  console.log('shouldNarrateInstrument(rses):', narrateRses);
  console.log('prompt has Self-esteem line:', hasRsesLine);
  console.log('SELF-ASSESSMENTS block:\n', selfBlock);
  console.log('SCS second-pass included:', /SELF-COMPASSION PROFILE/.test(prompt));
}

async function findNarratableRsesAttempt(): Promise<string | null> {
  const { data } = await supabase
    .from('interview_attempts')
    .select('id, user_id')
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(30);
  for (const row of data ?? []) {
    const { data: user } = await supabase
      .from('users')
      .select('psychometrics_rses_score, psychometric_straight_line_flags')
      .eq('id', row.user_id)
      .maybeSingle();
    const flags = Array.isArray(user?.psychometric_straight_line_flags)
      ? user.psychometric_straight_line_flags
      : [];
    if (
      user?.psychometrics_rses_score != null &&
      !flags.includes('rses_straight_line')
    ) {
      return row.id;
    }
  }
  return null;
}

async function main() {
  const extraId = process.argv[2];
  await checkAttempt('Matt (RSES suppressed)', mattAttemptId);
  const regressionId = extraId ?? (await findNarratableRsesAttempt());
  if (regressionId && regressionId !== mattAttemptId) {
    await checkAttempt('Regression (RSES narratable)', regressionId);
  } else {
    console.log('\n(no narratable-RSES attempt found for regression check)');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
