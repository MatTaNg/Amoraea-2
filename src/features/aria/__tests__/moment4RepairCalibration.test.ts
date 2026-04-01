import { applyMoment4RepairCalibrationRule } from '../moment4RepairCalibration';

describe('moment4RepairCalibration', () => {
  it('floors distancing-without-confrontation repair score into 4.0-5.0 range', () => {
    const scored = {
      momentNumber: 4 as const,
      pillarScores: { repair: 2.0, accountability: 4.0, contempt: 5.0, mentalizing: 3.0, commitment_threshold: 4.0 },
    };
    const userAnswer = 'I just stepped back and never really confronted them directly.';
    const calibrated = applyMoment4RepairCalibrationRule(scored, userAnswer);
    expect(calibrated.pillarScores.repair).toBeGreaterThanOrEqual(4.0);
    expect(calibrated.pillarScores.repair).toBeLessThanOrEqual(5.0);
  });

  it('keeps low repair score when active anti-repair behavior is explicit', () => {
    const scored = {
      momentNumber: 4 as const,
      pillarScores: { repair: 2.0 },
    };
    const userAnswer = 'I escalated it on purpose and refused to reconcile when they tried.';
    const calibrated = applyMoment4RepairCalibrationRule(scored, userAnswer);
    expect(calibrated.pillarScores.repair).toBe(2.0);
  });
});

