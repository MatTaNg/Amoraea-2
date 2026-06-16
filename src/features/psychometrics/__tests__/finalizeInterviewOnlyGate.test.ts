const GATE_PASS_WEIGHTED_MIN = 6.5;

const PSYCHOMETRIC_FLOOR_SUFFIX = '_floor_fail';

function isPsychometricGateFailFloorCode(id: string): boolean {
  return id.endsWith(PSYCHOMETRIC_FLOOR_SUFFIX) || id === 'brs_floor_fail';
}

function interviewOnlyGatePass(input: {
  modified_weighted_score: number | null;
  weighted_score: number | null;
  gate_fail_reasons: string[];
}): { pass: boolean; reasons: string[] } {
  const depthSignalModifiedScore = input.modified_weighted_score ?? input.weighted_score;
  if (depthSignalModifiedScore == null) {
    return { pass: false, reasons: [] };
  }
  const interviewFailReasons = input.gate_fail_reasons.filter((code) => !isPsychometricGateFailFloorCode(code));
  const pass = interviewFailReasons.length === 0 && depthSignalModifiedScore >= GATE_PASS_WEIGHTED_MIN;
  return { pass, reasons: interviewFailReasons };
}

describe('interview-only gate (psychometrics pending)', () => {
  it('passes when interview score meets threshold and no interview fail reasons', () => {
    const score = GATE_PASS_WEIGHTED_MIN + 0.5;
    expect(
      interviewOnlyGatePass({
        modified_weighted_score: score,
        weighted_score: score - 1,
        gate_fail_reasons: [],
      }).pass,
    ).toBe(true);
  });

  it('strips psychometric floor codes from fail reasons when psychometrics absent', () => {
    const result = interviewOnlyGatePass({
      modified_weighted_score: GATE_PASS_WEIGHTED_MIN + 2,
      weighted_score: null,
      gate_fail_reasons: ['mentalizing_floor', 'brs_floor_fail'],
    });
    expect(result.pass).toBe(false);
    expect(result.reasons).toEqual(['mentalizing_floor']);
  });

  it('does not treat missing scores as pass with empty fail reasons', () => {
    const result = interviewOnlyGatePass({
      modified_weighted_score: null,
      weighted_score: null,
      gate_fail_reasons: [],
    });
    expect(result.pass).toBe(false);
    expect(result.reasons).toEqual([]);
  });
});
