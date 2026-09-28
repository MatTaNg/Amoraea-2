import {
  buildPersonalMomentScoringPrompt,
  truncateTranscriptTurnsForMoment4Scoring,
  MOMENT4_MAX_USER_TURN_CHARS_FOR_SCORING,
} from '../personalMomentScoringPrompt';
import { MOMENT_4_GRUDGE_QUESTION_TEXT, MOMENT_SUPPORT_QUESTION_TEXT } from '../moment4ProbeLogic';
import { buildSupportMomentScoringPrompt } from '../supportMomentScoringPrompt';

describe('buildPersonalMomentScoringPrompt', () => {
  it('calibrates ambiguous "moved on" phrasing by surrounding context', () => {
    const prompt = buildPersonalMomentScoringPrompt([
      {
        role: 'assistant',
        content: MOMENT_4_GRUDGE_QUESTION_TEXT,
      },
      { role: 'user', content: "I moved on and don't think about it anymore." },
    ]);

    expect(prompt).toContain('M4 QUESTION DESIGN AND SCORING CALIBRATION');
    expect(prompt).toContain(MOMENT_4_GRUDGE_QUESTION_TEXT);
    expect(prompt).toContain('standalone evidence of resolution orientation or its absence');
    expect(prompt).toContain('The phrase alone is insufficient evidence of genuine release');
    expect(prompt).toContain('dismissive, contemptuous, or frames the other person as entirely at fault');
    expect(prompt).toContain('explicit forgiveness, perspective-taking, acknowledgment of personal growth');
    expect(prompt).toContain('Do not include "neutral acceptance without ongoing hostility"');
    expect(prompt).toContain('MENTALIZING OVERCERTAINTY FLAG');
    expect(prompt).toContain('Ryan clearly doesn\'t care about Emma');
    expect(prompt).toContain('mentalizing score must not exceed 7');
    expect(prompt).toContain('user_slice_word_count');
  });

  it('instructs null (not floor scores) for low-concreteness M4 inner-state markers', () => {
    const prompt = buildPersonalMomentScoringPrompt([
      { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT },
      { role: 'user', content: 'Thin gaming misunderstanding example.' },
    ]);

    expect(prompt).toContain('LOW CONCRETENESS / UNASSESSED INNER-STATE MARKERS');
    expect(prompt).toContain('set **mentalizing** and **accountability** to JSON **null**');
    expect(prompt).toContain('Do **not** apply a low-specificity floor score');
    expect(prompt).toContain('gaming misunderstanding resolved amicably');
  });

  it('anchors single internal exit marker at commitment_threshold 7', () => {
    const prompt = buildPersonalMomentScoringPrompt([
      { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT },
      { role: 'user', content: 'dreading the next time' },
    ]);

    expect(prompt).toContain('7 (single internal exit marker)');
    expect(prompt).toContain('looking forward to meeting their partner every day to dreading');
    expect(prompt).toContain('Do **not** score **6** solely because a communicate step was omitted');
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

describe('buildSupportMomentScoringPrompt', () => {
  it('scores responsiveness_support as the primary pillar with experimental slices', () => {
    const prompt = buildSupportMomentScoringPrompt([
      { role: 'assistant', content: MOMENT_SUPPORT_QUESTION_TEXT },
      { role: 'user', content: 'When they were overwhelmed I asked what would actually help, then sat with them instead of fixing it.' },
    ]);
    expect(prompt).toContain('PRIMARY PILLAR: responsiveness_support');
    expect(prompt).toContain('need_recognition');
    expect(prompt).toContain(MOMENT_SUPPORT_QUESTION_TEXT);
    expect(prompt).toContain('CONTEXTUAL REASONING');
  });
});
