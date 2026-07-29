import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { computePsychometricModifier } from '../supabase/functions/_shared/computePsychometricModifier';
import { GATE_PASS_WEIGHTED_MIN } from '../src/config/scoring/interviewGateThresholds';

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
  const email = process.argv[2]?.trim() ?? 'mattang5280@gmail.com';
  const admin = createClient(
    process.env.EXPO_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data: user } = await admin
    .from('users')
    .select(
      'id,psychometrics_brs_score,psychometrics_anxiety_trait_score,psychometrics_scs_sf_score,psychometrics_gasp_score,psychometrics_gasp_guilt_repair_score,psychometrics_gasp_shame_withdraw_score,psychometrics_dweck_score,psychometrics_aaq2_score,psychometrics_rses_score,psychometrics_rfq_score,psychometrics_sd3_narcissism_score,psychometrics_npi_entitlement_score,psychometric_modifier',
    )
    .eq('email', email)
    .maybeSingle();
  if (!user?.id) throw new Error('user not found');

  const { data: attempt } = await admin
    .from('interview_attempts')
    .select(
      'weighted_score,modified_weighted_score,modified_weighted_score_with_psychometrics,depth_signal_modifier,psychometric_modifier_applied,ego_development_level,moment_4_concreteness,moment_5_concreteness,mentalizing_overcertainty_count,disclosure_calibration,personal_moment_emotional_vocab_low,defense_patterns,review_flags,gate_fail_reasons,final_gate_pass',
    )
    .eq('user_id', user.id)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!attempt) throw new Error('attempt not found');

  const mod = computePsychometricModifier({
    brsScore: user.psychometrics_brs_score,
    anxietyTraitScore: user.psychometrics_anxiety_trait_score,
    scsSfScore: user.psychometrics_scs_sf_score,
    gaspScore: user.psychometrics_gasp_score,
    gaspGuiltRepairScore: user.psychometrics_gasp_guilt_repair_score,
    gaspShameWithdrawScore: user.psychometrics_gasp_shame_withdraw_score,
    dweckScore: user.psychometrics_dweck_score,
    aaq2Score: user.psychometrics_aaq2_score,
    rsesScore: user.psychometrics_rses_score,
    rfqScore: user.psychometrics_rfq_score,
    sd3NarcissismScore: user.psychometrics_sd3_narcissism_score,
    npiEntitlementScore: user.psychometrics_npi_entitlement_score,
  });

  process.stdout.write(
    JSON.stringify(
      {
        scoreStack: {
          weighted: attempt.weighted_score,
          depthSignalModifier: attempt.depth_signal_modifier,
          modifiedWeighted: attempt.modified_weighted_score,
          psychometricModifierApplied: attempt.psychometric_modifier_applied,
          finalModified: attempt.modified_weighted_score_with_psychometrics,
          passThreshold: GATE_PASS_WEIGHTED_MIN,
          finalGatePass: attempt.final_gate_pass,
        },
        psychometricPenalties: {
          brs: { delta: mod.brsComponent, band: mod.breakdown.brsBand },
          anxiety: { delta: mod.anxietyTraitComponent, band: mod.breakdown.anxietyTraitBand },
          scsSf: { delta: mod.scsSfComponent, band: mod.breakdown.scsSfBand },
          gasp: { delta: mod.gaspComponent, band: mod.breakdown.gaspBand },
          dweck: { delta: mod.dweckComponent, band: mod.breakdown.dweckBand },
          aaq2: { delta: mod.aaq2Component, band: mod.breakdown.aaq2Band },
          rses: { delta: mod.rsesComponent, band: mod.breakdown.rsesBand },
          rfq: { delta: mod.rfqComponent, band: mod.breakdown.rfqBand },
          rawTotal: mod.modifier,
          storedApplied: attempt.psychometric_modifier_applied,
        },
        interviewContext: {
          egoDevelopmentLevel: attempt.ego_development_level,
          moment4Concreteness: attempt.moment_4_concreteness,
          moment5Concreteness: attempt.moment_5_concreteness,
          mentalizingOvercertaintyCount: attempt.mentalizing_overcertainty_count,
          disclosureCalibration: attempt.disclosure_calibration,
          personalMomentEmotionalVocabLow: attempt.personal_moment_emotional_vocab_low,
          defensePatterns: attempt.defense_patterns,
        },
        flagsNotDirectPenalties: {
          straightLineFlags: mod.straightLineFlags,
          consistencyFlags: mod.consistencyFlags,
          reviewFlags: attempt.review_flags,
          gateFailReasons: attempt.gate_fail_reasons,
          floorBreaches: mod.psychometricFloorBreaches,
          gamingCorrectionLevel: null,
        },
      },
      null,
      2,
    ),
  );
}

void main().catch((e) => {
  console.error(e);
  process.exit(1);
});
