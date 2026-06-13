import { describe, expect, it } from '@jest/globals';
import { ASSESSMENT_ORDER } from '../assessmentContent';
import { NPI_ENTITLEMENT_ENABLED } from '../interviewCompletionStatus';
import {
  getMissingPsychometricAssessments,
  formatMissingPsychometricAssessmentNames,
} from '../psychometricsPersistence';

const fullRow = {
  psychometrics_brs_responses: { 1: 4 },
  psychometrics_anxiety_trait_responses: { 1: 3 },
  psychometrics_scs_sf_responses: { 1: 3 },
  psychometrics_gasp_responses: { 1: 2 },
  psychometrics_dweck_responses: { 1: 5 },
  psychometrics_aaq2_responses: { 1: 2 },
  psychometrics_rses_responses: { 1: 4 },
  ...(NPI_ENTITLEMENT_ENABLED
    ? { psychometrics_npi_entitlement_responses: { 1: { selectedOptionIndex: 0, wasEntitlement: false } } }
    : { psychometrics_sd3_narcissism_responses: { 1: 3 } }),
  psychometrics_rfq_responses: { 1: 4 },
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
