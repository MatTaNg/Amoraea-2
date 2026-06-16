import type { ScoreReceiptAttemptInput } from '@features/admin/buildScoreReceipt';
import {
  computePsychometricModifier,
  type PsychometricModifierResult,
} from './computePsychometricModifier';
import { sd3NarcissismScoreFromUserRow } from './usersPsychometricsSchemaFallback';

export type AdminPsychometricScoringSlice = {
  modifier: number;
  band: string;
};

export type AdminPsychometricScoringByInstrument = {
  brs: AdminPsychometricScoringSlice;
  anxiety_trait: AdminPsychometricScoringSlice;
  scs_sf: AdminPsychometricScoringSlice;
  gasp: AdminPsychometricScoringSlice;
  dweck: AdminPsychometricScoringSlice;
  aaq2: AdminPsychometricScoringSlice;
  rses: AdminPsychometricScoringSlice;
  sd3_narcissism: AdminPsychometricScoringSlice;
  npi_entitlement: AdminPsychometricScoringSlice;
  rfq: AdminPsychometricScoringSlice;
};

export type AdminPsychometricScoringUserInput = {
  psychometrics_brs_score: number | null;
  psychometrics_anxiety_trait_score: number | null;
  psychometrics_scs_sf_score: number | null;
  psychometrics_gasp_score: number | null;
  psychometrics_dweck_score: number | null;
  psychometrics_aaq2_score: number | null;
  psychometrics_rses_score: number | null;
  psychometrics_sd3_narcissism_score: number | null;
  psychometrics_npi_entitlement_score?: number | null;
  psychometrics_rfq_score: number | null;
};

function formatScoringBandLabel(band: string): string {
  if (band === 'not assessed') return 'Not assessed';
  if (band === 'floor breach') return 'Floor breach';
  return band.charAt(0).toUpperCase() + band.slice(1);
}

function scoringByInstrumentFromResult(
  result: PsychometricModifierResult,
): AdminPsychometricScoringByInstrument {
  const b = result.breakdown;
  return {
    brs: { modifier: result.brsComponent, band: formatScoringBandLabel(b.brsBand) },
    anxiety_trait: {
      modifier: result.anxietyTraitComponent,
      band: formatScoringBandLabel(b.anxietyTraitBand),
    },
    scs_sf: { modifier: result.scsSfComponent, band: formatScoringBandLabel(b.scsSfBand) },
    gasp: { modifier: result.gaspComponent, band: formatScoringBandLabel(b.gaspBand) },
    dweck: { modifier: result.dweckComponent, band: formatScoringBandLabel(b.dweckBand) },
    aaq2: { modifier: result.aaq2Component, band: formatScoringBandLabel(b.aaq2Band) },
    rses: { modifier: result.rsesComponent, band: formatScoringBandLabel(b.rsesBand) },
    sd3_narcissism: {
      modifier: result.sd3NarcissismComponent,
      band: formatScoringBandLabel(b.sd3NarcissismBand),
    },
    npi_entitlement: {
      modifier: result.npiEntitlementComponent,
      band: formatScoringBandLabel(b.npiEntitlementBand),
    },
    rfq: { modifier: result.rfqComponent, band: formatScoringBandLabel(b.rfqBand) },
  };
}

/** Same modifier/band logic as Score Receipt — authoritative for gate scoring. */
export function adminPsychometricScoringDisplay(
  user: AdminPsychometricScoringUserInput,
  attempt?: ScoreReceiptAttemptInput | null,
): { byInstrument: AdminPsychometricScoringByInstrument; result: PsychometricModifierResult } | null {
  const hasAnyScore =
    user.psychometrics_brs_score != null ||
    user.psychometrics_anxiety_trait_score != null ||
    user.psychometrics_scs_sf_score != null ||
    user.psychometrics_gasp_score != null ||
    user.psychometrics_dweck_score != null ||
    user.psychometrics_aaq2_score != null ||
    user.psychometrics_rses_score != null ||
    user.psychometrics_sd3_narcissism_score != null ||
    user.psychometrics_npi_entitlement_score != null ||
    user.psychometrics_rfq_score != null;
  if (!hasAnyScore) return null;

  const pillars = attempt?.pillar_scores ?? {};
  const result = computePsychometricModifier(
    {
      brsScore: user.psychometrics_brs_score ?? null,
      anxietyTraitScore: user.psychometrics_anxiety_trait_score ?? null,
      scsSfScore: user.psychometrics_scs_sf_score ?? null,
      gaspScore: user.psychometrics_gasp_score ?? null,
      dweckScore: user.psychometrics_dweck_score ?? null,
      aaq2Score: user.psychometrics_aaq2_score ?? null,
      rsesScore: user.psychometrics_rses_score ?? null,
      sd3NarcissismScore: sd3NarcissismScoreFromUserRow(user as Record<string, unknown>),
      npiEntitlementScore: user.psychometrics_npi_entitlement_score ?? null,
      rfqScore: user.psychometrics_rfq_score ?? null,
    },
    {
      disclosureCalibration: attempt?.disclosure_calibration ?? null,
      moment5Concreteness: attempt?.moment_5_concreteness ?? null,
      moment4Concreteness: attempt?.moment_4_concreteness ?? null,
      personalMomentVocabDensity: attempt?.personal_moment_emotional_vocab_density ?? null,
      regulationPillar: pillars.regulation,
      accountabilityPillar: pillars.accountability,
      egoDevelopmentLevel: attempt?.ego_development_level ?? null,
      attunementPillar: pillars.attunement,
      contemptPillar: pillars.contempt,
      mentalizingPillar: pillars.mentalizing,
    },
  );

  return {
    byInstrument: scoringByInstrumentFromResult(result),
    result,
  };
}

export function mergeAdminBandWithAuthoritativeScoring<T extends { band: string; modifier: number }>(
  adminBand: T,
  scoring: AdminPsychometricScoringSlice | undefined,
): T {
  if (!scoring) return adminBand;
  return { ...adminBand, modifier: scoring.modifier, band: scoring.band };
}
