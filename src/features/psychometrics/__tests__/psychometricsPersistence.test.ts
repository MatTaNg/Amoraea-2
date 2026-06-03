import { describe, expect, it } from '@jest/globals';
import { ASSESSMENT_ORDER } from '../assessmentContent';
import {
  getMissingPsychometricAssessments,
  formatMissingPsychometricAssessmentNames,
} from '../psychometricsPersistence';

const fullRow = {
  psychometrics_brs_responses: { 1: 4 },
  psychometrics_scs_sf_responses: { 1: 3 },
  psychometrics_gasp_responses: { 1: 2 },
  psychometrics_dweck_responses: { 1: 5 },
  psychometrics_aaq2_responses: { 1: 2 },
  psychometrics_rses_responses: { 1: 4 },
  psychometrics_scs_public_responses: { 1: 3 },
  psychometrics_scs_private_responses: { 1: 4 },
  psychometrics_mspss_responses: { 1: 5 },
  psychometrics_sd3_narcissism_responses: { 1: 3 },
  psychometrics_rfq_responses: { 1: 4 },
};

describe('getMissingPsychometricAssessments', () => {
  it('returns empty when every instrument has stored responses', () => {
    expect(getMissingPsychometricAssessments(fullRow)).toEqual([]);
  });

  it('flags instruments with missing or empty response JSON', () => {
    const partial = {
      ...fullRow,
      psychometrics_brs_responses: null,
      psychometrics_gasp_responses: {},
      psychometrics_scs_private_responses: null,
    };
    const missing = getMissingPsychometricAssessments(partial);
    expect(missing).toContain('brs');
    expect(missing).toContain('gasp');
    expect(missing).toContain('scs');
    expect(missing).not.toContain('aaq2');
  });

  it('requires both SCS public and private blocks', () => {
    expect(
      getMissingPsychometricAssessments({
        ...fullRow,
        psychometrics_scs_public_responses: { 1: 2 },
        psychometrics_scs_private_responses: null,
      }),
    ).toContain('scs');
  });
});

describe('formatMissingPsychometricAssessmentNames', () => {
  it('lists human-readable instrument names', () => {
    const names = formatMissingPsychometricAssessmentNames(['brs', 'aaq2']);
    expect(names).toContain('Resilience');
    expect(names).toContain('Emotional Flexibility');
  });

  it('covers every assessment in order when all missing', () => {
    expect(formatMissingPsychometricAssessmentNames([...ASSESSMENT_ORDER]).split(', ').length).toBe(
      ASSESSMENT_ORDER.length,
    );
  });
});
