/**
 * Verify templated transparency sections on a persisted personal report.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/verifyReportTransparency.ts [attemptId]
 */
import { createClient } from '@supabase/supabase-js';
import { buildReportDataFromRows } from '../src/features/psychometrics/personalReportData';
import {
  detectEvidenceConflicts,
  finalizeUserFacingReportMarkdown,
  REPORT_CONFIDENCE_LIMITATIONS_HEADING,
  REPORT_EVIDENCE_MIXED_HEADING,
  REPORT_FOOTER_DISCLAIMER,
} from '../src/features/reports/reportTransparency';

const attemptId = process.argv[2] ?? '37b1ec35-7ad2-46b9-af75-315f762be109';
const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

const GRAMMAR_CORRUPTION_RE =
  /\bsomeone close to you (and|or|but|if|when|that|with|from|as|so|yet|nor|for|after|before|while|because|although|since|unless|until|where|which|who|whom|whose|than|then|also|still|just|even|only|both|either|neither|not|very|too|more|less|most|least|however|therefore|meanwhile|instead|otherwise|though|whereas|whether|into|onto|upon|about|over|under|between|among|through|during|without|within|against|toward|towards|across|around|behind|beside|beyond|despite|except|including|regarding|unlike|via|per|plus|minus)\b/i;

async function main() {
  const { data: attempt, error } = await supabase
    .from('interview_attempts')
    .select(
      `
      *,
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
    .eq('id', attemptId)
    .maybeSingle();

  if (error || !attempt) {
    throw new Error(error?.message ?? `Attempt not found: ${attemptId}`);
  }

  const reportData = buildReportDataFromRows(attempt.users, attempt);
  const conflicts = detectEvidenceConflicts(reportData);
  const raw = String(attempt.personal_report_markdown ?? '');
  const finalized = finalizeUserFacingReportMarkdown(raw, reportData);

  const summary = {
    attemptId,
    markdownLength: raw.length,
    conflicts: conflicts.map((c) => c.id),
    hasMixed: finalized.includes(REPORT_EVIDENCE_MIXED_HEADING),
    hasConfidence: finalized.includes(REPORT_CONFIDENCE_LIMITATIONS_HEADING),
    mixedBeforePractical:
      finalized.indexOf(REPORT_EVIDENCE_MIXED_HEADING) >= 0 &&
      finalized.indexOf(REPORT_EVIDENCE_MIXED_HEADING) <
        finalized.indexOf('## Practical Steps Forward'),
    confidenceBeforeClosing:
      finalized.indexOf(REPORT_CONFIDENCE_LIMITATIONS_HEADING) <
      finalized.indexOf('## Closing'),
    footerTextOk: REPORT_FOOTER_DISCLAIMER.includes('automated scoring and AI-generated writing'),
    devanshuInNarrative: /devanshu/i.test(finalized),
    grammarCorruption: GRAMMAR_CORRUPTION_RE.test(finalized),
    someoneCloseCount: (finalized.match(/someone close to you/gi) ?? []).length,
  };

  console.log(JSON.stringify(summary, null, 2));

  const mixedIdx = finalized.indexOf(`## ${REPORT_EVIDENCE_MIXED_HEADING}`);
  if (mixedIdx >= 0) {
    console.log('\nMixed section excerpt:\n');
    console.log(finalized.slice(mixedIdx, mixedIdx + 420));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
