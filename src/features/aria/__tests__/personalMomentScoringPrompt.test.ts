import { buildPersonalMomentScoringPrompt } from '../personalMomentScoringPrompt';

describe('buildPersonalMomentScoringPrompt', () => {
  it('calibrates ambiguous "moved on" phrasing by surrounding context', () => {
    const prompt = buildPersonalMomentScoringPrompt([
      {
        role: 'assistant',
        content:
          "Have you ever held a grudge against someone, or had someone in your life you really didn't like? How did that happen, and where are you with it now?",
      },
      { role: 'user', content: "I moved on and don't think about it anymore." },
    ]);

    expect(prompt).toContain('RESOLUTION ORIENTATION / "MOVED ON" HANDLING');
    expect(prompt).toContain('standalone evidence of resolution orientation or its absence');
    expect(prompt).toContain('The phrase alone is insufficient evidence of genuine release');
    expect(prompt).toContain('dismissive, contemptuous, or frames the other person as entirely at fault');
    expect(prompt).toContain('explicit forgiveness, perspective-taking, acknowledgment of personal growth');
    expect(prompt).toContain('Do not include "neutral acceptance without ongoing hostility"');
  });
});
