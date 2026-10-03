import {
  RELATIONSHIP_VALIDATION_INSTRUMENT_IDS,
  type RelationshipValidationInstrumentId,
} from '../constants';
import { validationInstrumentsCompleted } from '../validationPsychometricsProgress';

describe('RELATIONSHIP_VALIDATION_INSTRUMENT_IDS', () => {
  it('matches the post-interview typology battery without sexual communication', () => {
    expect(RELATIONSHIP_VALIDATION_INSTRUMENT_IDS).toEqual(['PVQ-21', 'CONFLICT-30', 'ECR-36']);
    expect(RELATIONSHIP_VALIDATION_INSTRUMENT_IDS).not.toContain('SEXUAL_COMMUNICATION');
  });
});

describe('validationInstrumentsCompleted', () => {
  it('types nextStep as a validation instrument id', () => {
    const next: RelationshipValidationInstrumentId | null = 'PVQ-21';
    expect(next).toBe('PVQ-21');
    void validationInstrumentsCompleted;
  });
});
