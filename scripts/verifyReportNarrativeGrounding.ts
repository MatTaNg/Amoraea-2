/**
 * Audit persisted personal reports for scenario score grounding + psychometric integration.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/verifyReportNarrativeGrounding.ts [limit]
 */
import { createClient } from '@supabase/supabase-js';
import { buildReportDataFromRows } from '../src/features/psychometrics/personalReportData';
import { buildPersonalReportStructuralValidationContext } from '../src/features/psychometrics/personalReportPrompt';
import {
  getVisibleNarrativeMarkdown,
  parseStructuralNarrativeFields,
  psychometricWovenIntoNarrative,
  validateMarkdownStructuralEnforcement,
} from '../src/features/reports/reportNarrativeStructuralEnforcement';
import {
  detectScenarioScoreInflation,
  narrativeBandForScore,
} from '../src/features/reports/scenarioScoreGrounding';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const limit = Math.max(1, Number(process.argv[2] ?? 3));

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  const { data: attempts, error } = await supabase
    .from('interview_attempts')
    .select(
      `
      id,
      user_id,
      personal_report_markdown,
      personal_report_source_hash,
      scenario_1_scores,
      scenario_2_scores,
      scenario_3_scores,
      scenario_specific_patterns,
      pillar_scores,
      weighted_score,
      depth_signal_modifier,
      score_modifier,
      modified_weighted_score_with_psychometrics,
      modified_weighted_score,
      passed,
      final_gate_pass,
      gate_fail_reasons,
      gaming_correction,
      ego_development_level,
      emotion_recognition_score,
      disclosure_calibration,
      moment_4_concreteness,
      moment_5_concreteness,
      personal_moment_emotional_vocab_density,
      personal_moment_emotional_vocab_low,
      defense_patterns,
      mentalizing_overcertainty_count,
      completed_at,
      users!interview_attempts_user_id_fkey (
        name,
        psychometrics_aaq2_score,
        psychometrics_rses_score,
        psychometrics_scs_public_score,
        psychometrics_scs_private_score,
        psychometric_modifier,
        psychometrics_brs_score,
        psychometrics_scs_sf_score,
        psychometrics_scs_sf_self_kindness_score,
        psychometrics_scs_sf_common_humanity_score,
        psychometrics_scs_sf_mindfulness_score,
        psychometrics_mspss_score,
        psychometrics_mspss_family_score,
        psychometrics_mspss_friends_score,
        psychometrics_rfq_score,
        psychometrics_gasp_score,
        psychometrics_dweck_score,
        psychometric_straight_line_flags
      )
    `,
    )
    .not('personal_report_markdown', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error(error);
    process.exit(1);
  }

  if (!attempts?.length) {
    console.log('No persisted personal_report_markdown rows found.');
    return;
  }

  console.log(`Auditing ${attempts.length} most recent personal full reports...\n`);

  for (const row of attempts) {
    const markdown = row.personal_report_markdown as string;
    const user = Array.isArray(row.users) ? row.users[0] : row.users;
    const reportData = buildReportDataFromRows(user, row);
    const validationContext = buildPersonalReportStructuralValidationContext(reportData);
    const validation = validateMarkdownStructuralEnforcement(markdown, validationContext);
    const fields = parseStructuralNarrativeFields(markdown);
    const visible = getVisibleNarrativeMarkdown(markdown);
    const inflation = detectScenarioScoreInflation(visible, validationContext.scenarioScoreGrounding);
    const psychWoven =
      fields?.psychometric_integration != null
        ? psychometricWovenIntoNarrative(fields.psychometric_integration, visible)
        : false;

    const scenarioScores = validationContext.scenarioScoreGrounding?.slices.map(
      (s) => `${s.scenarioLabel.split(' ')[1]} mentalizing=${s.mentalizing} (${narrativeBandForScore(s.mentalizing)})`,
    );

    console.log(`--- attempt ${row.id} (${user?.name ?? row.user_id}) ---`);
    console.log(`generation_path: personal_full_report (client markdown + structural validation)`);
    console.log(`scenario_scores: ${scenarioScores?.join('; ') ?? 'n/a'}`);
    console.log(`structural_validation_ok: ${validation.ok}`);
    if (!validation.ok) console.log(`validation_issues: ${validation.issues.join(' | ')}`);
    console.log(`score_inflation_flags: ${inflation.length ? inflation.join(' | ') : 'none'}`);
    console.log(
      `psychometric_integration: ${fields?.psychometric_integration?.slice(0, 160) ?? 'MISSING'}`,
    );
    console.log(
      `populated_non_aaq2: ${validationContext.populatedNonAaq2InstrumentLabels?.join(', ') || 'none'}`,
    );
    console.log(`psychometric_woven_in_visible: ${psychWoven}`);
    console.log(
      `crossref_excerpt: ${fields?.scenario_personal_pattern_crossref?.slice(0, 200) ?? 'MISSING'}...`,
    );
    console.log('');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
