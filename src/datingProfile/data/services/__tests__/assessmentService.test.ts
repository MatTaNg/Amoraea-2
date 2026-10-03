import {
  ASSESSMENT_IDS,
  FIRST_DATING_PROFILE_ASSESSMENT_ID,
  getNextAssessmentStepMeta,
  getNextInstrument,
  getPreviousInstrument,
  isDatingProfileTypologyBatteryComplete,
  lastTypologyBatteryInstrument,
} from '@/data/services/assessmentService';

describe('dating profile ASSESSMENT_IDS', () => {
  it('starts with Schwartz values and does not include sexual communication', () => {
    expect(ASSESSMENT_IDS).toEqual(['PVQ-21', 'CONFLICT-30', 'ECR-36']);
    expect(ASSESSMENT_IDS).not.toContain('SEXUAL_COMMUNICATION');
    expect(FIRST_DATING_PROFILE_ASSESSMENT_ID).toBe('PVQ-21');
    expect(getNextInstrument('PVQ-21')).toBe('CONFLICT-30');
    expect(getNextInstrument('ECR-36')).toBeNull();
    expect(getPreviousInstrument('PVQ-21')).toBeNull();
    expect(getPreviousInstrument('ECR-36')).toBe('CONFLICT-30');
    expect(lastTypologyBatteryInstrument()).toBe('ECR-36');
  });

  it('derives insight step metadata from battery order', () => {
    expect(getNextAssessmentStepMeta('PVQ-21')).toEqual({
      isFinal: false,
      nextTitle: 'Conflict Style',
      nextMeta: '21 situations · ~9 min',
    });
    expect(getNextAssessmentStepMeta('ECR-36')).toEqual({
      isFinal: true,
      nextTitle: null,
      nextMeta: null,
    });
  });

  it('detects when all three relationship questionnaires are already saved', () => {
    expect(isDatingProfileTypologyBatteryComplete([])).toBe(false);
    expect(
      isDatingProfileTypologyBatteryComplete(['SEXUAL_COMMUNICATION', 'PVQ-21', 'CONFLICT-30']),
    ).toBe(false);
    expect(isDatingProfileTypologyBatteryComplete([...ASSESSMENT_IDS])).toBe(true);
    expect(
      isDatingProfileTypologyBatteryComplete([
        ...ASSESSMENT_IDS,
        'BFI-2',
      ]),
    ).toBe(true);
  });
});
