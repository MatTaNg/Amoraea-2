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

  it('underdisclosure requires low ratio and no substantive concreteness on either moment', () => {
    // af88b820-like: low concreteness + ratio 33.5/134 < 0.4
    expect(
      computeDisclosureCalibration('low', 'low', 36, 31, 134, []),
    ).toBe('underdisclosure');
  });

  it('does not flag underdisclosure when either moment is substantive despite low ratio (Jordan case)', () => {
    expect(
      computeDisclosureCalibration('valid_non_applicable', 'high', 131, 148, 460, []),
    ).toBe('calibrated');
  });

  it('substantive M5 alone overrides low ratio even when M4 is thin', () => {
    expect(
      computeDisclosureCalibration('low', 'high', 36, 148, 460, []),
    ).toBe('calibrated');
  });

  it('low concreteness with high word ratio stays calibrated (verbose but vague)', () => {
    expect(
      computeDisclosureCalibration('low', 'low', 400, 380, 200, []),
    ).toBe('calibrated');
  });

  it('returns calibrated when word counts are unavailable (no default underdisclosure)', () => {
    expect(
      computeDisclosureCalibration('low', 'low', null, null, null, []),
    ).toBe('calibrated');
    expect(
      computeDisclosureCalibration('low', 'low', null, null, 134, []),
    ).toBe('calibrated');
  });

  it('detectOverdisclosure requires calibration plus length and secondary signal', () => {
    expect(
      detectOverdisclosure({
        disclosureCalibration: 'calibrated',
        moment4WordCount: 450,
        moment5WordCount: 100,
        moment4Concreteness: 'high',
        moment5Concreteness: 'low',
      }),
    ).toBe(false);

    expect(
      detectOverdisclosure({
        disclosureCalibration: 'overdisclosure',
        moment4WordCount: 450,
        moment5WordCount: 100,
        moment4Concreteness: 'high',
        moment5Concreteness: 'low',
      }),
    ).toBe(true);

    expect(
      detectOverdisclosure({
        disclosureCalibration: 'overdisclosure',
        moment4WordCount: 200,
        moment5WordCount: 180,
        moment4Concreteness: 'moderate',
        moment5Concreteness: 'moderate',
      }),
    ).toBe(false);
  });
});
