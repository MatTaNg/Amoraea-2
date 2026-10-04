import { describe, expect, it } from '@jest/globals';

import {
  COMPATIBILITY_ALGORITHM_VERSION,
  COMPATIBILITY_ALGORITHM_VERSION_V5,
  PSYCHOMETRIC_BATTERY_VERSION,
  PSYCHOMETRIC_BATTERY_VERSION_V2,
  SEXUAL_COMMUNICATION_COMFORT_ASSESSMENT_VERSION,
  SEXUAL_COMMUNICATION_TYPOLOGY_VERSION,
} from '@config/algorithmVersions';
import { COMPATIBILITY_EVIDENCE_RULES } from '@config/matching/compatibilityEvidenceRegistry';
import { compatV3CoreWeightsSum } from '@config/matching/compatibilityScoring';
import {
  SEXUAL_COMMUNICATION_SOFT_MODIFIER_FLAG,
  SEXUAL_COMMUNICATION_SOFT_MODIFIER_MAGNITUDE,
  hasHistoricalSexualCommunicationTypology,
  sexualCommunicationComfortUncertaintyFields,
  sexualCommunicationSoftModifier,
} from '@config/psychometrics/sexualCommunicationSoftModifier';
import { ACTIVE_NEW_USER_MODIFIER_INSTRUMENTS } from '@config/psychometrics/activeNewUserScoring';
import { ASSESSMENT_IDS } from '@/data/services/assessmentService';
import { EDIT_PROFILE_ASSESSMENT_RESULT_TABS } from '@/screens/profile/editProfile/EditProfileMyResultsView';
import { MATCHMAKING_SUBSCORE_WEIGHTS } from '@features/compatibility/matchmakingPairPayload';
import { buildMatchmakingPairPayloadExample } from '@features/compatibility/matchmakingCompatibilityPrompt';
import { computeFinalCompatibilityScore as computeAiBlendScore } from '@features/compatibility/styleCompatibilityScore';
import {
  ASSESSMENT_ORDER,
  ASSESSMENTS,
  POST_INTERVIEW_ASSESSMENTS,
  scoreAssessment,
  scorePostInterviewAssessment,
} from '../assessmentContent';
import { buildAssessmentSavePayload } from '../psychometricsPersistence';
import { computeUncertaintyScore } from '../computeUncertaintyScore';
import {
  ACTIVE_NEW_USER_PSYCHOMETRIC_FLOOR_CODES,
  collectPsychometricFloorGateFailReasons,
} from '../psychometricFloorBreaches';
import { computePsychometricModifier } from '../computePsychometricModifier';

const TEN_FOURS = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 4]));
const TEN_TWOS = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [i + 1, 2]));

const EMPTY_ATTEMPT = {
  weighted_score: 8,
  pillar_scores: {},
  scenario_composites: { s1: 7, s2: 7, s3: 7 },
  mentalizing_overcertainty_count: 0,
  defense_patterns: {},
  review_flags: [],
  personal_moment_emotional_vocab_low: false,
  disclosure_calibration: 'calibrated',
  scenario_1_scores: null,
  scenario_2_scores: null,
  scenario_3_scores: null,
  psychometric_straight_line_flags: [],
  psychometrics_gasp_externalization_score: 3,
  psychometrics_aaq2_score: 15,
  psychometrics_brs_score: 4,
  psychometrics_rses_score: 28,
  psychometrics_scs_sf_score: 4,
  psychometrics_dweck_score: 4,
  psychometrics_sd3_narcissism_score: 2,
  psychometrics_npi_entitlement_score: null as number | null,
  psychometrics_rfq_score: 5,
  psychometrics_scs_public_score: null as number | null,
  psychometrics_scs_private_score: null as number | null,
  reasoning_pending: false,
};

describe('sexual communication comfort move', () => {
  it('keeps the 10 historical items and adds them to the pre-interview battery under a new id', () => {
    expect(ASSESSMENT_IDS).not.toContain('SEXUAL_COMMUNICATION');
    expect(ASSESSMENT_ORDER).toContain('sexual_communication_comfort');
    expect(ASSESSMENT_ORDER).not.toContain('sexual_communication');
    const moved = ASSESSMENTS.sexual_communication_comfort;
    const historical = POST_INTERVIEW_ASSESSMENTS.sexual_communication;
    expect(moved.questions.map((q) => q.text)).toEqual(historical.questions.map((q) => q.text));
    expect(moved.scale).toEqual(historical.scale);
    expect(moved.assessmentVersion).toBe(SEXUAL_COMMUNICATION_COMFORT_ASSESSMENT_VERSION);
    expect(scoreAssessment('sexual_communication_comfort', TEN_FOURS).total).toBe(4);
    expect(scorePostInterviewAssessment('sexual_communication', TEN_FOURS).total).toBe(4);
  });

  it('does not show sexual communication on the edit-profile results tabs', () => {
    expect(EDIT_PROFILE_ASSESSMENT_RESULT_TABS.map((tab) => tab.id)).toEqual([
      'ECR-36',
      'CONFLICT-30',
      'PVQ-21',
    ]);
  });

  it('adds a soft uncertainty contribution at or below 2.0 and does not auto-fail', () => {
    expect(sexualCommunicationSoftModifier(2)).toBe(SEXUAL_COMMUNICATION_SOFT_MODIFIER_MAGNITUDE);
    expect(sexualCommunicationSoftModifier(2.01)).toBe(0);
    expect(SEXUAL_COMMUNICATION_SOFT_MODIFIER_MAGNITUDE).toBe(0.05);

    const baseline = computeUncertaintyScore(EMPTY_ATTEMPT);
    const low = computeUncertaintyScore({
      ...EMPTY_ATTEMPT,
      psychometrics_sexual_communication_comfort_score: 2,
      psychometrics_sexual_communication_comfort_soft_modifier: 0.05,
    });
    expect(low.components.depthSignalConcerns).toBeCloseTo(
      baseline.components.depthSignalConcerns + 0.05,
      5,
    );
    expect(low.activeFlags).toContain(SEXUAL_COMMUNICATION_SOFT_MODIFIER_FLAG);
    expect(low.total).toBeGreaterThan(baseline.total);
    expect(low.total).toBeLessThan(1);

    const floors = collectPsychometricFloorGateFailReasons(
      {
        rfqScore: null,
        gaspScore: 2,
        gaspGuiltRepairScore: null,
        gaspShameWithdrawScore: null,
        dweckScore: null,
        scsSfScore: 4,
        sd3NarcissismScore: null,
        npiEntitlementScore: null,
        brsScore: 4,
        anxietyTraitScore: 2,
        aaq2Score: null,
        rsesScore: 30,
        scsPublicScore: null,
        scsPrivateScore: null,
      },
      [],
    );
    expect(floors).toEqual([]);
    expect([...ACTIVE_NEW_USER_PSYCHOMETRIC_FLOOR_CODES].join(',')).not.toMatch(/sexual/);
    expect([...ACTIVE_NEW_USER_MODIFIER_INSTRUMENTS]).not.toContain('sexual_communication_comfort');
    const modifier = computePsychometricModifier({
      brsScore: 4.5,
      anxietyTraitScore: 2,
      scsSfScore: 4.2,
      gaspScore: 2,
      gaspGuiltRepairScore: null,
      gaspShameWithdrawScore: null,
      dweckScore: null,
      aaq2Score: null,
      rsesScore: 35,
      scsPublicScore: null,
      scsPrivateScore: null,
      mspssFriendsScore: null,
      mspssFamilyScore: null,
      sd3NarcissismScore: null,
      npiEntitlementScore: null,
      rfqScore: null,
    });
    expect(modifier.psychometricFloorBreaches).toEqual([]);
    expect(modifier.modifier).toBeGreaterThanOrEqual(-0.35);
  });

  it('persists the new score and soft modifier without writing the historical typology columns', () => {
    const payload = buildAssessmentSavePayload('sexual_communication_comfort', TEN_TWOS);
    expect(payload.psychometrics_sexual_communication_comfort_score).toBe(2);
    expect(payload.psychometrics_sexual_communication_comfort_soft_modifier).toBe(0.05);
    expect(payload.psychometrics_sexual_communication_comfort_version).toBe(
      SEXUAL_COMMUNICATION_COMFORT_ASSESSMENT_VERSION,
    );
    expect(payload.psychometrics_battery_version).toBe(PSYCHOMETRIC_BATTERY_VERSION);
    expect(payload).not.toHaveProperty('psychometrics_sexual_communication_score');
    expect(payload).not.toHaveProperty('psychometrics_sexual_communication_completed_at');
    expect(payload).not.toHaveProperty('psychometrics_sexual_communication_responses');
  });

  it('treats a null historical typology pair as absent when comfort is already scored', () => {
    const freshBattery = {
      psychometrics_sexual_communication_comfort_score: 3.2,
      psychometrics_sexual_communication_score: null,
      psychometrics_sexual_communication_completed_at: null,
    };
    expect(hasHistoricalSexualCommunicationTypology(freshBattery)).toBe(false);
    expect(freshBattery.psychometrics_sexual_communication_comfort_score).toBe(3.2);
    expect(
      hasHistoricalSexualCommunicationTypology({
        psychometrics_sexual_communication_score: 4,
        psychometrics_sexual_communication_completed_at: '2026-01-01T00:00:00.000Z',
      }),
    ).toBe(true);
  });

  it('does not reinterpret a historical typology mean as the new uncertainty input', () => {
    const fields = sexualCommunicationComfortUncertaintyFields({
      psychometrics_sexual_communication_score: 1,
    });
    expect(fields.psychometrics_sexual_communication_comfort_score).toBeNull();
    expect(fields.psychometrics_sexual_communication_comfort_soft_modifier).toBeNull();
    const withLegacyOnly = computeUncertaintyScore({
      ...EMPTY_ATTEMPT,
      ...fields,
    });
    const baseline = computeUncertaintyScore(EMPTY_ATTEMPT);
    expect(withLegacyOnly.total).toBe(baseline.total);
    expect(withLegacyOnly.activeFlags).not.toContain(SEXUAL_COMMUNICATION_SOFT_MODIFIER_FLAG);
    expect(PSYCHOMETRIC_BATTERY_VERSION).not.toBe(PSYCHOMETRIC_BATTERY_VERSION_V2);
    expect(SEXUAL_COMMUNICATION_TYPOLOGY_VERSION).toBe(
      'post_interview_typology_sexual_communication_v1',
    );
  });

  it('leaves sexual communication out of both compatibility blends and keeps weights summing to 1', () => {
    const rule = COMPATIBILITY_EVIDENCE_RULES.find(
      (entry) => entry.ruleId === 'level_b_intimacy_sexual_communication',
    );
    expect(rule?.lifecycle).toBe('retired');
    expect(rule?.coefficient).toBe(0);
    expect(rule?.description).toMatch(/individual readiness signal/i);

    expect(compatV3CoreWeightsSum()).toBeCloseTo(1, 10);
    const aiWeightSum = Object.values(MATCHMAKING_SUBSCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);
    expect(aiWeightSum).toBeCloseTo(1, 10);
    expect(JSON.stringify(buildMatchmakingPairPayloadExample())).not.toContain('sexualCommunication');
    const blend = computeAiBlendScore({
      attachmentScore: 0.8,
      valuesScore: 0.8,
      semanticScore: 0.8,
      styleScore: 1,
      styleConfidence: 1,
      dealbreakerMultiplier: 1,
    });
    expect(blend).toBeCloseTo(0.8 * 0.35 + 0.8 * 0.3 + 1 * 0.2 + 0.8 * 0.15, 5);
    expect(COMPATIBILITY_ALGORITHM_VERSION).not.toBe(COMPATIBILITY_ALGORITHM_VERSION_V5);
  });
});
