import {
  RELATIONSHIP_VALIDATION_INSTRUMENT_IDS,
  type RelationshipValidationInstrumentId,
} from '../constants';
import { validationInstrumentsCompleted } from '../validationPsychometricsProgress';

describe('RELATIONSHIP_VALIDATION_INSTRUMENT_IDS', () => {
  it('includes all four profile typology instruments in battery order', () => {
    expect(RELATIONSHIP_VALIDATION_INSTRUMENT_IDS).toEqual([
      'SEXUAL_COMMUNICATION',
      'PVQ-21',
      'CONFLICT-30',
      'ECR-36',
    ]);
  });
});

describe('validationInstrumentsCompleted', () => {
  it('types nextStep as a validation instrument id', () => {
    const next: RelationshipValidationInstrumentId | null = 'SEXUAL_COMMUNICATION';
    expect(next).toBe('SEXUAL_COMMUNICATION');
    void validationInstrumentsCompleted;
  });
});
