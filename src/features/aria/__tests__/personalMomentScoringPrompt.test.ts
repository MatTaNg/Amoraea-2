import {
  buildPersonalMomentScoringPrompt,
  truncateTranscriptTurnsForMoment4Scoring,
  MOMENT4_MAX_USER_TURN_CHARS_FOR_SCORING,
} from '../personalMomentScoringPrompt';

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
    expect(prompt).toContain('MENTALIZING OVERCERTAINTY FLAG');
    expect(prompt).toContain('Ryan clearly doesn\'t care about Emma');
    expect(prompt).toContain('mentalizing score must not exceed 7');
    expect(prompt).toContain('emotional_vocab_count');
    expect(prompt).toContain('user_slice_word_count');
  });

  it('truncates very long user turns before embedding in the prompt', () => {
    const long = 'word '.repeat(MOMENT4_MAX_USER_TURN_CHARS_FOR_SCORING + 500);
    const truncated = truncateTranscriptTurnsForMoment4Scoring([
      { role: 'assistant', content: 'Short setup.' },
      { role: 'user', content: long },
    ]);
    expect(truncated[1]!.content.length).toBeLessThan(long.length);
    expect(truncated[1]!.content).toContain('[truncated for Moment 4 scoring context length]');
  });
});
