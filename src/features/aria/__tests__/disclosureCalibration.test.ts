import { computeDisclosureCalibration, detectOverdisclosure } from '../disclosureCalibration';

describe('disclosureCalibration', () => {
  it('does not label calibrated-length personal moments as overdisclosure', () => {
    const calibration = computeDisclosureCalibration(
      'moderate',
      'moderate',
      280,
      290,
      200,
      [],
    );
    expect(calibration).toBe('calibrated');
  });

  it('detectOverdisclosure requires calibration plus length and secondary signal', () => {
    expect(
      detectOverdisclosure({
        disclosureCalibration: 'calibrated',
        moment4WordCount: 450,
        moment5WordCount: 100,
        moment4Concreteness: 'high',
        moment5Concreteness: 'low',
        vocabDensity: 1.2,
      }),
    ).toBe(false);

    expect(
      detectOverdisclosure({
        disclosureCalibration: 'overdisclosure',
        moment4WordCount: 450,
        moment5WordCount: 100,
        moment4Concreteness: 'high',
        moment5Concreteness: 'low',
        vocabDensity: 1.2,
      }),
    ).toBe(true);

    expect(
      detectOverdisclosure({
        disclosureCalibration: 'overdisclosure',
        moment4WordCount: 200,
        moment5WordCount: 180,
        moment4Concreteness: 'moderate',
        moment5Concreteness: 'moderate',
        vocabDensity: 1.0,
      }),
    ).toBe(false);
  });
});
