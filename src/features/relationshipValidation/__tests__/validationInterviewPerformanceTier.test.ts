import {
  buildInterviewToneCalibrationInstructions,
  deriveValidationInterviewPerformanceTier,
} from '../validationInterviewPerformanceTier';

describe('deriveValidationInterviewPerformanceTier', () => {
  it('returns needs_development when final_gate_pass is false', () => {
    expect(deriveValidationInterviewPerformanceTier(false, 5.45)).toBe('needs_development');
    expect(deriveValidationInterviewPerformanceTier(false, 8)).toBe('needs_development');
  });

  it('returns strong_demonstration when pass is true and score is comfortably above threshold', () => {
    expect(deriveValidationInterviewPerformanceTier(true, 7.0)).toBe('strong_demonstration');
    expect(deriveValidationInterviewPerformanceTier(true, 7.5)).toBe('strong_demonstration');
  });

  it('returns balanced_demonstration when pass is true but score is close to threshold', () => {
    expect(deriveValidationInterviewPerformanceTier(true, 6.5)).toBe('balanced_demonstration');
    expect(deriveValidationInterviewPerformanceTier(true, 6.9)).toBe('balanced_demonstration');
  });

  it('returns null when gate outcome is unknown', () => {
    expect(deriveValidationInterviewPerformanceTier(null, 6.8)).toBeNull();
    expect(deriveValidationInterviewPerformanceTier(undefined, null)).toBeNull();
  });
});

describe('buildInterviewToneCalibrationInstructions', () => {
  it('includes no-reframing guidance for failing tier', () => {
    const text = buildInterviewToneCalibrationInstructions('needs_development', true);
    expect(text).toContain('do NOT use unqualified strength language');
    expect(text).toContain('false reassurance is not');
    expect(text).not.toContain('mentalizing score');
  });

  it('allows warm tone for strong pass tier', () => {
    const text = buildInterviewToneCalibrationInstructions('strong_demonstration', true);
    expect(text).toContain('genuine relational strengths warmly');
  });

  it('returns empty string when there is no interview', () => {
    expect(buildInterviewToneCalibrationInstructions('needs_development', false)).toBe('');
  });
});
