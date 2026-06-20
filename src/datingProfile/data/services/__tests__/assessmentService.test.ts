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
  it('runs sexual communication first, then longest attachment last', () => {
    expect(ASSESSMENT_IDS).toEqual([
      'SEXUAL_COMMUNICATION',
      'PVQ-21',
      'CONFLICT-30',
      'ECR-36',
    ]);
    expect(FIRST_DATING_PROFILE_ASSESSMENT_ID).toBe('SEXUAL_COMMUNICATION');
    expect(getNextInstrument('SEXUAL_COMMUNICATION')).toBe('PVQ-21');
    expect(getNextInstrument('ECR-36')).toBeNull();
    expect(getPreviousInstrument('SEXUAL_COMMUNICATION')).toBeNull();
    expect(getPreviousInstrument('PVQ-21')).toBe('SEXUAL_COMMUNICATION');
    expect(getPreviousInstrument('ECR-36')).toBe('CONFLICT-30');
    expect(lastTypologyBatteryInstrument()).toBe('ECR-36');
  });

  it('derives insight step metadata from battery order', () => {
    expect(getNextAssessmentStepMeta('SEXUAL_COMMUNICATION')).toEqual({
      isFinal: false,
      nextTitle: 'Schwartz Values',
      nextMeta: '21 questions · ~3 min',
    });
    expect(getNextAssessmentStepMeta('ECR-36')).toEqual({
      isFinal: true,
      nextTitle: null,
      nextMeta: null,
    });
  });

  it('detects when all four relationship questionnaires are already saved', () => {
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
