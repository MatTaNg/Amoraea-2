import { describe, expect, it } from '@jest/globals';
import { ASSESSMENT_ORDER } from '../assessmentContent';
import {
  getMissingPsychometricAssessments,
  formatMissingPsychometricAssessmentNames,
  PSYCHOMETRICS_RESPONSES_SELECT,
} from '../psychometricsPersistence';

const fullRow = {
  psychometrics_brs_responses: { 1: 4 },
  psychometrics_anxiety_trait_responses: { 1: 3 },
  psychometrics_scs_sf_responses: { 1: 3 },
  psychometrics_gasp_responses: { 1: 2 },
  psychometrics_relationship_growth_beliefs_responses: { 1: 5 },
  psychometrics_conflict_catastrophizing_responses: { 7: 2 },
  psychometrics_rses_responses: { 1: 4 },
  psychometrics_amoraea_entitlement_v1_responses: { 1: 3 },
};

describe('getMissingPsychometricAssessments', () => {
  it('returns empty when every active instrument has stored responses', () => {
    expect(getMissingPsychometricAssessments(fullRow)).toEqual([]);
  });

  it('flags instruments with missing or empty response JSON', () => {
    const partial = {
      ...fullRow,
      psychometrics_brs_responses: null,
      psychometrics_gasp_responses: {},
    };
    const missing = getMissingPsychometricAssessments(partial);
    expect(missing).toContain('brs');
    expect(missing).toContain('gasp');
    expect(missing).not.toContain('aaq2');
    expect(missing).not.toContain('mspss');
    expect(missing).not.toContain('scs');
  });

  it('does not require retired MSPSS or SCS for battery completion', () => {
    expect(getMissingPsychometricAssessments(fullRow)).not.toContain('mspss');
    expect(getMissingPsychometricAssessments(fullRow)).not.toContain('scs');
  });

  it('flags Relationship Growth Beliefs, Conflict Beliefs, and Relationship Attitudes when those columns were not loaded', () => {
    const rowWithoutExperimental = {
      psychometrics_brs_responses: { 1: 4 },
      psychometrics_anxiety_trait_responses: { 1: 3 },
      psychometrics_scs_sf_responses: { 1: 3 },
      psychometrics_gasp_responses: { 1: 2 },
      psychometrics_rses_responses: { 1: 4 },
    };
    const missing = getMissingPsychometricAssessments(rowWithoutExperimental);
    expect(missing).toEqual([
      'relationship_growth_beliefs',
      'conflict_catastrophizing',
      'amoraea_entitlement_v1',
    ]);
    expect(formatMissingPsychometricAssessmentNames(missing)).toBe(
      'Relationship Growth Beliefs, Conflict Beliefs, Relationship Attitudes',
    );
  });
});

describe('PSYCHOMETRICS_RESPONSES_SELECT', () => {
  it('loads response columns for every active battery instrument', () => {
    for (const assessmentId of ASSESSMENT_ORDER) {
      expect(PSYCHOMETRICS_RESPONSES_SELECT).toContain(`psychometrics_${assessmentId}_responses`);
    }
  });
});

describe('formatMissingPsychometricAssessmentNames', () => {
  it('lists human-readable instrument names', () => {
    const names = formatMissingPsychometricAssessmentNames(['brs', 'aaq2']);
    expect(names).toContain('Resilience');
    expect(names).toContain('Emotional Flexibility');
  });

  it('covers every active assessment in order when all missing', () => {
    expect(formatMissingPsychometricAssessmentNames([...ASSESSMENT_ORDER]).split(', ').length).toBe(
      ASSESSMENT_ORDER.length,
    );
  });
});
