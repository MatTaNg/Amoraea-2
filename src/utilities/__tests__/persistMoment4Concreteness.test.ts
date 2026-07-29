import {
  coalesceMoment4ConcretenessForFinalPersist,
} from '../persistPersonalMomentScoresIncremental';

const ANTonia_GRUDGE =
  "Yes, I held grudges when I was younger and I learned to reflect and look into that, forgive and move on because mostly the grudges were not based on reality but based on perceived filter through childhood traumas and when I was way younger I wasn't able to trust people, I thought they just want to hurt me.";

describe('coalesceMoment4ConcretenessForFinalPersist', () => {
  it('preserves valid_non_applicable from reconciled slice instead of falling back to baseline low', () => {
    expect(
      coalesceMoment4ConcretenessForFinalPersist(
        { response_concreteness: 'valid_non_applicable' },
        'low',
      ),
    ).toBe('valid_non_applicable');
  });

  it('reconciles model low to valid_non_applicable when grudge transcript qualifies', () => {
    expect(
      coalesceMoment4ConcretenessForFinalPersist({ response_concreteness: 'low' }, 'low', ANTonia_GRUDGE),
    ).toBe('valid_non_applicable');
  });
});
