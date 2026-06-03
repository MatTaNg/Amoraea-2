import { buildMoment5AccountabilityScoringPrompt } from '../moment5AccountabilityScoringPrompt';

describe('buildMoment5AccountabilityScoringPrompt', () => {
  it('includes personal-moment emotional vocabulary JSON fields', () => {
    const prompt = buildMoment5AccountabilityScoringPrompt(
      [
        { role: 'assistant', content: 'Tell me about a conflict with someone important.' },
        { role: 'user', content: 'We argued and I felt hurt.' },
      ],
      null,
    );
    expect(prompt).toContain('emotional_vocab_count');
    expect(prompt).toContain('emotional_vocab_words');
    expect(prompt).toContain('user_slice_word_count');
  });
});
