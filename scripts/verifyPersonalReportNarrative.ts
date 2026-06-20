/**
 * Regenerate personal reports for prompt verification (does not change scoring).
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/verifyPersonalReportNarrative.ts b8928107-aea5-408b-9a20-d0e45bc9486e
 */
import { createClient } from '@supabase/supabase-js';
import {
  buildReportPrompt,
  buildSystemPrompt,
} from '../src/features/psychometrics/personalReportPrompt';
import { buildReportDataFromRows } from '../src/features/psychometrics/personalReportData';
import {
  resolveUnderdisclosureNarrativeTier,
  buildMentalizingAsymmetryNote,
} from '../src/features/psychometrics/personalReportNarrativeGuidance';
import {
  resolveReportGateNarrativeTier,
  composeNarrativeCalibration,
} from '../src/features/reports/narrativeCalibration';
import { REPORT_NARRATIVE_TOKEN_BUDGETS } from '../src/utilities/reportNarrativeGeneration';

const CLAUDE_SONNET_MODEL = 'claude-sonnet-4-6';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

const ATTEMPT_SELECT = `
  user_id,
  weighted_score,
  depth_signal_modifier,
  score_modifier,
  modified_weighted_score_with_psychometrics,
  modified_weighted_score,
  passed,
  final_gate_pass,
  gate_fail_reasons,
  gaming_correction,
  pillar_scores,
  ego_development_level,
  emotion_recognition_score,
  disclosure_calibration,
  moment_4_concreteness,
  moment_5_concreteness,
  personal_moment_emotional_vocab_density,
  personal_moment_emotional_vocab_low,
  defense_patterns,
  mentalizing_overcertainty_count,
  scenario_1_scores,
  scenario_2_scores,
  scenario_3_scores,
  scenario_specific_patterns,
  transcript
`;

async function fetchReportDataForAttempt(attemptId: string) {
  const { data: attempt, error } = await supabase
    .from('interview_attempts')
    .select(ATTEMPT_SELECT)
    .eq('id', attemptId)
    .maybeSingle();
  if (error || !attempt?.user_id) {
    throw new Error(error?.message ?? `Attempt not found: ${attemptId}`);
  }
  const { data: user } = await supabase
    .from('users')
    .select(
      `
      name,
      basic_info,
      email,
      psychometrics_aaq2_score,
      psychometrics_rses_score,
      psychometrics_scs_public_score,
      psychometrics_scs_private_score,
      psychometric_modifier
    `,
    )
    .eq('id', attempt.user_id)
    .maybeSingle();
  return buildReportDataFromRows(user, attempt);
}

function thirdPersonHits(text: string, name: string | null): string[] {
  const hits: string[] = [];
  const patterns = [
    name ? new RegExp(`\\b${name}\\b`, 'gi') : null,
    /\b[A-Z][a-z]+ brings\b/g,
    /\b[A-Z][a-z]+ demonstrates\b/g,
    /\b[A-Z][a-z]+'s partner\b/gi,
    /\bthey tend to\b/gi,
    /\btheir partner\b/gi,
  ].filter(Boolean) as RegExp[];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) hits.push(...m.slice(0, 3));
  }
  return [...new Set(hits)].slice(0, 12);
}

function lonelinessHits(text: string): string[] {
  const lower = text.toLowerCase();
  const terms = ['loneliness', 'unknown to', 'opaque', 'hard to know', 'shut out', 'shut-out'];
  return terms.filter((t) => lower.includes(t));
}

async function findStrongUnderdisclosureAttempt(): Promise<string | null> {
  const { data } = await supabase
    .from('interview_attempts')
    .select('id')
    .eq('disclosure_calibration', 'underdisclosure')
    .in('moment_4_concreteness', ['low', 'absent'])
    .in('moment_5_concreteness', ['low', 'absent'])
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function callAnthropic(system: string, userPrompt: string): Promise<string> {
  if (!anthropicKey) {
    throw new Error('Set EXPO_PUBLIC_ANTHROPIC_API_KEY or ANTHROPIC_API_KEY for live regen');
  }
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: REPORT_NARRATIVE_TOKEN_BUDGETS.personal_full_report.initial,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic HTTP ${res.status}: ${await res.text()}`);
  }
  const json = (await res.json()) as { content?: Array<{ text?: string }> };
  const text = json.content?.[0]?.text?.trim();
  if (!text) throw new Error('Empty Anthropic response');
  return text;
}

async function runForAttempt(attemptId: string, label: string, promptOnly: boolean): Promise<void> {
  const { data: attempt, error } = await supabase
    .from('interview_attempts')
    .select('id, user_id')
    .eq('id', attemptId)
    .maybeSingle();
  if (error || !attempt?.user_id) {
    console.error(`Failed to load attempt ${attemptId}:`, error?.message ?? 'missing user_id');
    return;
  }

  const reportData = await fetchReportDataForAttempt(attemptId);
  const tier = resolveUnderdisclosureNarrativeTier({
    disclosureCalibration: reportData.attempt?.disclosureCalibration,
    moment4Concreteness: reportData.attempt?.moment4Concreteness,
    moment5Concreteness: reportData.attempt?.moment5Concreteness,
  });
  const asymmetry = reportData.attempt?.mentalizingProfile
    ? buildMentalizingAsymmetryNote(reportData.attempt.mentalizingProfile)
    : null;

  console.log(`\n=== ${label} (${attemptId}) ===`);
  console.log('disclosure:', reportData.attempt?.disclosureCalibration);
  console.log('M4 concreteness:', reportData.attempt?.moment4Concreteness);
  console.log('M5 concreteness:', reportData.attempt?.moment5Concreteness);
  console.log('underdisclosure narrative tier:', tier);
  console.log('mentalizing profile:', reportData.attempt?.mentalizingProfile);
  console.log('final_gate_pass:', reportData.attempt?.finalGatePass);
  console.log('gate_fail_reasons:', reportData.attempt?.gateFailReasons);
  console.log(
    'gate narrative tier:',
    resolveReportGateNarrativeTier({
      finalGatePass: reportData.attempt?.finalGatePass,
      gateFailReasons: reportData.attempt?.gateFailReasons,
    }),
  );

  const system = buildSystemPrompt();
  const userPrompt = buildReportPrompt(reportData);
  console.log('\n--- PROMPT SNIPPET (narrative calibration) ---');
  const calIdx = userPrompt.indexOf('NARRATIVE CALIBRATION');
  console.log(userPrompt.slice(calIdx, calIdx + 2200));

  console.log('\n--- PROMPT CHECKS ---');
  console.log('system prompt uses second person rule:', /second person throughout/i.test(system));
  console.log('user prompt mild tier:', /MANDATORY CALIBRATION — mild tier/i.test(userPrompt));
  console.log('user prompt mentalizing asymmetry:', /MENTALIZING ASYMMETRY \(MANDATORY\)/i.test(userPrompt));
  console.log('user prompt strong tier (should be false for Jordan):', /strong tier\): disclosure_calibration is underdisclosure AND both personal moments show low/i.test(userPrompt));
  console.log('user prompt gate calibration:', /PRIORITY PRINCIPLE/i.test(userPrompt));
  console.log(
    'user prompt shared mechanics hiding:',
    /MECHANICS-HIDING/i.test(userPrompt),
  );
  console.log(
    'user prompt psychometric-only tone:',
    /PSYCHOMETRIC-ONLY CONCERN TONE/i.test(userPrompt),
  );
  console.log('user prompt interview-fail tone:', /INTERVIEW FAIL TONE/i.test(userPrompt));
  if (tier === 'strong') {
    console.log('user prompt strong tier (expected for contrast):', /UNDERDISCLOSURE NARRATIVE \(strong tier\)/i.test(userPrompt));
  }

  if (promptOnly) {
    console.log('\n(--prompt-only: skipping Claude generation)');
    return;
  }

  console.log('\nGenerating report via Claude...');
  const markdown = await callAnthropic(system, userPrompt);
  console.log('\n--- REPORT PREVIEW (first 1500 chars) ---\n');
  console.log(markdown.slice(0, 1500));
  console.log('\n--- CHECKS ---');
  console.log('third-person hits:', thirdPersonHits(markdown, reportData.user.name));
  console.log('loneliness/opacity hits:', lonelinessHits(markdown));
  console.log(
    'mentions self/other mentalizing asymmetry:',
    /self-directed|your own experience|turn that same quality of attention toward your own|read others' inner worlds/i.test(
      markdown,
    ),
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => a !== '--prompt-only');
  const promptOnly = process.argv.includes('--prompt-only');
  const attemptId = args[0] ?? 'b8928107-aea5-408b-9a20-d0e45bc9486e';
  await runForAttempt(attemptId, 'Jordan / b8928107', promptOnly);

  const strongId = await findStrongUnderdisclosureAttempt();
  if (strongId && strongId !== attemptId) {
    await runForAttempt(strongId, 'Strong underdisclosure contrast case', promptOnly);
  } else if (!strongId) {
    console.log('\nNo contrast attempt with underdisclosure + low/absent M4 & M5 found in DB.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
