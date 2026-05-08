import {
  ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST,
  REPAIR_CONDITIONAL_AND_PROMPTED_SCORING,
} from '../interviewScoringCalibration';

describe('REPAIR_CONDITIONAL_AND_PROMPTED_SCORING', () => {
  it('calibrates repair by identifiable action, not conciseness', () => {
    expect(REPAIR_CONDITIONAL_AND_PROMPTED_SCORING).toContain(
      'at least one identifiable repair action'
    );
    expect(REPAIR_CONDITIONAL_AND_PROMPTED_SCORING).toMatch(/not\** whether the answer is concise/i);
    expect(REPAIR_CONDITIONAL_AND_PROMPTED_SCORING).toContain('Repair gesturing');
    expect(REPAIR_CONDITIONAL_AND_PROMPTED_SCORING).toContain('Concrete repair direction');
    expect(REPAIR_CONDITIONAL_AND_PROMPTED_SCORING).toContain(
      "I would apologize for jumping straight to the details and ask her how she'd like to celebrate"
    );
    expect(REPAIR_CONDITIONAL_AND_PROMPTED_SCORING).not.toMatch(
      /one-sentence description|one sentence description/i
    );
  });
});

describe('ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST', () => {
  it('distinguishes deflection from boundaries, directness, and self-aware qualification', () => {
    expect(ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST).toContain('ACCOUNTABILITY DEFLECTION');
    expect(ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST).toContain('BOUNDARY EXPRESSION');
    expect(ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST).toContain('DIRECT OR BLUNT COMMUNICATION');
    expect(ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST).toContain('SELF-AWARE QUALIFICATION');
    expect(ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST).toContain(
      "I don't take criticism seriously from people who haven't experienced my work"
    );
    expect(ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST).toContain(
      "I got triggered because he hit something true"
    );
    expect(ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST).toContain(
      'Avoidance of self-examination is low accountability'
    );
  });
});
