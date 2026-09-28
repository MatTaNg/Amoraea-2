import {
  isValidScenarioBoundaryLead,
  parseScenarioBoundaryLeadFromLlm,
} from '@features/aria/interviewScenarioBoundaryLlmValidation';

describe('parseScenarioBoundaryLeadFromLlm', () => {
  it('returns trimmed plain text', () => {
    expect(parseScenarioBoundaryLeadFromLlm('  Good work — on to the next one.  ')).toBe(
      'Good work — on to the next one.',
    );
  });

  it('parses JSON lead field when present', () => {
    expect(parseScenarioBoundaryLeadFromLlm('{"lead":"Nice — next situation."}')).toBe(
      'Nice — next situation.',
    );
  });
});

describe('isValidScenarioBoundaryLead', () => {
  it('accepts short grounded transition without vignette body', () => {
    expect(
      isValidScenarioBoundaryLead(
        "Good work — you picked up on Ryan shutting Emma down. Here's the next situation.",
        1,
      ),
    ).toBe(true);
  });

  it('rejects vignette fiction in the lead', () => {
    expect(
      isValidScenarioBoundaryLead(
        "Good work. Sarah has been job hunting for four months. Here's the next situation.",
        1,
      ),
    ).toBe(false);
  });

  it('rejects control tokens and overly long output', () => {
    expect(isValidScenarioBoundaryLead('[SHOW_SCENARIO_CARD] Next.', 1)).toBe(false);
    expect(isValidScenarioBoundaryLead('x'.repeat(400), 1)).toBe(false);
  });

  it('rejects banned openers', () => {
    expect(isValidScenarioBoundaryLead('Sure — next situation.', 1)).toBe(false);
  });
});
