import { buildMoment5AccountabilityScoringPrompt } from '../moment5AccountabilityScoringPrompt';

describe('buildMoment5AccountabilityScoringPrompt', () => {
  it('includes personal-moment scoring JSON fields', () => {
    const prompt = buildMoment5AccountabilityScoringPrompt(
      [
        { role: 'assistant', content: 'Tell me about a conflict with someone important.' },
        { role: 'user', content: 'We argued and I felt hurt.' },
      ],
      null,
    );
    expect(prompt).toContain('user_slice_word_count');
    expect(prompt).toContain('KEY EVIDENCE — ANALYTICAL NARRATIVE');
    expect(prompt).not.toContain('quote or paraphrase the response that most informed the score');
  });
});
