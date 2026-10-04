import { describe, expect, it, jest } from '@jest/globals';
import {
  ACTIVE_BATTERY_SCORE_COLUMNS,
  ACTIVE_PRE_INTERVIEW_ASSESSMENT_IDS,
  DEPRECATED_AAQ2_SCORE_COLUMN,
  DEPRECATED_DWECK_SCORE_COLUMN,
  DEPRECATED_RFQ_SCORE_COLUMN,
} from '@config/psychometrics/activeNewUserScoring';
import { ASSESSMENT_ORDER, ASSESSMENTS, scoreAssessment } from '../assessmentContent';
import {
  buildAssessmentSavePayload,
  getIncompleteActiveBatteryInstruments,
  getMissingPsychometricScores,
  PSYCHOMETRICS_ACTIVE_SCORE_SELECT,
} from '../psychometricsPersistence';
import {
  computePsychometricModifier,
  logMissingPsychometricModifierInputs,
  missingPsychometricModifierInputs,
} from '../computePsychometricModifier';
import { ACTIVE_NEW_USER_PSYCHOMETRIC_FLOOR_CODES } from '../psychometricFloorBreaches';
import { psychometricFloorScoresFromUserRow } from '../usersPsychometricsSchemaFallback';
import { sexualCommunicationSoftModifier } from '@config/psychometrics/sexualCommunicationSoftModifier';

const COMPLETE_SCORES: Record<string, number> = {
  psychometrics_brs_score: 4,
  psychometrics_anxiety_trait_score: 2,
  psychometrics_scs_sf_score: 3.5,
  psychometrics_gasp_score: 2,
  psychometrics_relationship_growth_beliefs_score: 4.5,
  psychometrics_conflict_catastrophizing_score: 2,
  psychometrics_rses_score: 30,
  psychometrics_entitlement_score: 3,
  psychometrics_sexual_communication_comfort_score: 4,
};

const COMPLETE_RESPONSES: Record<string, Record<number, number>> = {
  psychometrics_brs_responses: { 1: 4 },
  psychometrics_anxiety_trait_responses: { 1: 2 },
  psychometrics_scs_sf_responses: { 1: 4 },
  psychometrics_gasp_responses: { 1: 2 },
  psychometrics_relationship_growth_beliefs_responses: { 1: 5 },
  psychometrics_conflict_catastrophizing_responses: { 7: 2 },
  psychometrics_rses_responses: { 1: 3 },
  psychometrics_amoraea_entitlement_v1_responses: { 1: 3 },
  psychometrics_sexual_communication_comfort_responses: { 1: 4 },
};

const MODIFIER_SCORES = {
  brsScore: 4,
  anxietyTraitScore: 2,
  scsSfScore: 3.5,
  gaspScore: 2,
  gaspGuiltRepairScore: null,
  gaspShameWithdrawScore: null,
  dweckScore: null,
  aaq2Score: null,
  rsesScore: 22,
  scsPublicScore: null,
  scsPrivateScore: null,
  mspssFriendsScore: null,
  mspssFamilyScore: null,
  sd3NarcissismScore: null,
  npiEntitlementScore: null,
  rfqScore: null,
  relationshipGrowthBeliefsScore: 4.5,
  conflictCatastrophizingScore: 2,
  entitlementScore: 3,
  sexualCommunicationComfortScore: 4,
};

describe('active battery completion', () => {
  it('requires a non-null score for every instrument in ASSESSMENT_ORDER', () => {
    expect(getMissingPsychometricScores(COMPLETE_SCORES)).toEqual([]);
    expect(
      getIncompleteActiveBatteryInstruments({ ...COMPLETE_RESPONSES, ...COMPLETE_SCORES }),
    ).toEqual([]);

    const withoutSplitAndExperimental = { ...COMPLETE_RESPONSES, ...COMPLETE_SCORES };
    delete withoutSplitAndExperimental.psychometrics_relationship_growth_beliefs_score;
    delete withoutSplitAndExperimental.psychometrics_conflict_catastrophizing_score;
    delete withoutSplitAndExperimental.psychometrics_entitlement_score;
    delete withoutSplitAndExperimental.psychometrics_sexual_communication_comfort_score;

    expect(getIncompleteActiveBatteryInstruments(withoutSplitAndExperimental)).toEqual([
      'relationship_growth_beliefs',
      'conflict_catastrophizing',
      'amoraea_entitlement_v1',
      'sexual_communication_comfort',
    ]);
    expect(getMissingPsychometricScores(withoutSplitAndExperimental)).not.toContain('aaq2');
    expect(getMissingPsychometricScores(withoutSplitAndExperimental)).not.toContain('rfq');
    expect(getMissingPsychometricScores(withoutSplitAndExperimental)).not.toContain('dweck');
  });

  it('selects the active score columns, including entitlement and the dweck split', () => {
    for (const assessmentId of ASSESSMENT_ORDER) {
      expect(PSYCHOMETRICS_ACTIVE_SCORE_SELECT).toContain(ACTIVE_BATTERY_SCORE_COLUMNS[assessmentId]);
    }
    expect(PSYCHOMETRICS_ACTIVE_SCORE_SELECT).toContain('psychometrics_entitlement_score');
    expect(PSYCHOMETRICS_ACTIVE_SCORE_SELECT).not.toContain(DEPRECATED_DWECK_SCORE_COLUMN);
    expect(PSYCHOMETRICS_ACTIVE_SCORE_SELECT).not.toContain(DEPRECATED_AAQ2_SCORE_COLUMN);
    expect(PSYCHOMETRICS_ACTIVE_SCORE_SELECT).not.toContain(DEPRECATED_RFQ_SCORE_COLUMN);
    expect([...ACTIVE_PRE_INTERVIEW_ASSESSMENT_IDS]).toEqual([...ASSESSMENT_ORDER]);
  });

  it('persists two dweck subscales and an experimental entitlement score', () => {
    const growth = buildAssessmentSavePayload('relationship_growth_beliefs', {
      1: 1,
      2: 1,
      3: 1,
      4: 6,
      5: 6,
      6: 6,
    });
    expect(growth.psychometrics_relationship_growth_beliefs_score).toBe(
      scoreAssessment('relationship_growth_beliefs', { 1: 1, 2: 1, 3: 1, 4: 6, 5: 6, 6: 6 }).total,
    );
    expect(growth).not.toHaveProperty('psychometrics_dweck_score');
    expect(growth).not.toHaveProperty('psychometrics_dweck_responses');
    expect(ASSESSMENTS.relationship_growth_beliefs.questions).toHaveLength(6);

    const conflict = buildAssessmentSavePayload('conflict_catastrophizing', {
      7: 6,
      8: 6,
      9: 6,
      10: 6,
    });
    expect(conflict.psychometrics_conflict_catastrophizing_score).toBe(6);
    expect(conflict).not.toHaveProperty('psychometrics_dweck_score');
    expect(ASSESSMENTS.conflict_catastrophizing.questions.map((q) => q.id)).toEqual([7, 8, 9, 10]);

    const entitlement = buildAssessmentSavePayload('amoraea_entitlement_v1', {
      1: 4,
      2: 4,
      3: 4,
      4: 4,
      5: 4,
      6: 4,
      7: 4,
      8: 4,
    });
    expect(entitlement.psychometrics_entitlement_score).toBe(4);
    expect(entitlement.psychometrics_amoraea_entitlement_v1_score).toBe(4);
    expect(ASSESSMENTS.amoraea_entitlement_v1.confidence).toBe('experimental');
  });

  it('does not put entitlement, growth beliefs, catastrophizing, or sexual communication on auto-fail floors', () => {
    const codes = ACTIVE_NEW_USER_PSYCHOMETRIC_FLOOR_CODES.join(' ');
    expect(codes).not.toMatch(/entitlement|dweck|growth|catastroph|sexual_communication|aaq2|rfq/i);
    const floors = psychometricFloorScoresFromUserRow({
      psychometrics_entitlement_score: 7,
      psychometrics_relationship_growth_beliefs_score: 1,
      psychometrics_conflict_catastrophizing_score: 6,
      psychometrics_sexual_communication_comfort_score: 1,
    });
    expect(floors.npiEntitlementScore).toBeNull();
    expect(floors.dweckScore).toBeNull();
  });

  it('flags a modifier computed while required battery scores are still null', () => {
    const missing = missingPsychometricModifierInputs(
      {
        ...MODIFIER_SCORES,
        relationshipGrowthBeliefsScore: null,
        conflictCatastrophizingScore: null,
        entitlementScore: null,
        sexualCommunicationComfortScore: null,
      },
      { includeExperimentalBattery: true },
    );
    expect(missing).toEqual([
      'relationship_growth_beliefs',
      'conflict_catastrophizing',
      'entitlement',
      'sexual_communication_comfort',
    ]);

    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const partial = computePsychometricModifier(
      {
        ...MODIFIER_SCORES,
        relationshipGrowthBeliefsScore: null,
        conflictCatastrophizingScore: null,
        entitlementScore: null,
        sexualCommunicationComfortScore: null,
      },
      undefined,
      undefined,
      { enforceActiveBatteryCompleteness: true },
    );
    expect(partial.modifier).toBe(-0.1);
    expect(partial.missingRequiredInputs).toEqual(missing);
    expect(partial.dweckComponent).toBe(0);
    logMissingPsychometricModifierInputs(partial.missingRequiredInputs);
    expect(warn).toHaveBeenCalled();
    expect(String(warn.mock.calls[0]?.[0])).toContain('missing required battery scores');
    warn.mockRestore();

    const complete = computePsychometricModifier(MODIFIER_SCORES, undefined, undefined, {
      enforceActiveBatteryCompleteness: true,
    });
    expect(complete.missingRequiredInputs).toEqual([]);
    expect(complete.modifier).toBe(partial.modifier);
  });

  it('does not let a null sexual-communication mean skip or throw', () => {
    expect(ASSESSMENT_ORDER).toContain('sexual_communication_comfort');
    expect(sexualCommunicationSoftModifier(null)).toBe(0);
    expect(sexualCommunicationSoftModifier(undefined)).toBe(0);
    expect(sexualCommunicationSoftModifier(2)).toBe(0.05);
  });

  it('marks retired aaq2, rfq, and dweck score columns deprecated', () => {
    expect(DEPRECATED_AAQ2_SCORE_COLUMN).toBe('psychometrics_aaq2_score');
    expect(DEPRECATED_RFQ_SCORE_COLUMN).toBe('psychometrics_rfq_score');
    expect(DEPRECATED_DWECK_SCORE_COLUMN).toBe('psychometrics_dweck_score');
    expect(ASSESSMENT_ORDER).not.toContain('aaq2');
    expect(ASSESSMENT_ORDER).not.toContain('rfq');
    expect(ASSESSMENT_ORDER).not.toContain('dweck');
  });
});
