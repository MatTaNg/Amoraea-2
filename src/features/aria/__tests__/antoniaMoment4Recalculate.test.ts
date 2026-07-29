import { describe, expect, it } from '@jest/globals';
import { mergeMoment4ConcretenessForGate } from '../moment4ConcretenessClassification';
import { resolveMoment4UserTextForGate } from '../personalMomentSliceEnrichment';
import { recalculateAttemptScoresFromStoredSlices } from '../recalculateAttemptScoresFromStoredSlices';

const ANTONIA_M4_QUESTION =
  "Now we'll shift to something more personal. Have you ever held a grudge against someone, or had someone in your life you really didn't like? How did that happen, and where are you with it now?";

const ANTONIA_M4_ANSWER =
  "Yes, I held grudges when I was younger and I learned to reflect and look into that, forgive and move on because mostly the grudges were not based on reality but based on perceived filter through childhood traumas and when I was way younger I wasn't able to trust people, I thought they just want to hurt me.";

describe('Antonia ea8005bc M4 recalculate concreteness', () => {
  it('resolves grudge answer from pre-rewrite handoff question without interviewMoment tags', () => {
    const transcript = [
      { role: 'assistant', content: ANTONIA_M4_QUESTION },
      { role: 'user', content: ANTONIA_M4_ANSWER },
    ];
    const text = resolveMoment4UserTextForGate(transcript);
    expect(text).toContain('held grudges when I was younger');
    expect(
      mergeMoment4ConcretenessForGate({ response_concreteness: 'low' }, 'low', text),
    ).toBe('valid_non_applicable');
  });

  it('recalculate gate uses valid_non_applicable when transcript includes grudge Q/A', () => {
    const transcript = [
      { role: 'assistant', content: 'Scenario 3 wrap up.' },
      { role: 'user', content: 'Daniel needs therapy.' },
      { role: 'assistant', content: ANTONIA_M4_QUESTION },
      { role: 'user', content: ANTONIA_M4_ANSWER },
      { role: 'assistant', content: 'At what point do you decide when a relationship is something to work through?' },
      { role: 'user', content: 'When effort is one-sided for too long I step back.' },
    ];
    const patterns = {
      moment_4_scores: {
        pillarScores: { mentalizing: 8, accountability: 8, contempt_expression: 9, commitment_threshold: 7 },
        keyEvidence: { mentalizing: 'm4' },
        response_concreteness: 'low',
      },
      moment_5_scores: {
        pillarScores: { repair: 6, regulation: 6, mentalizing: 6, accountability: 6, contempt_expression: 6 },
        keyEvidence: { repair: 'm5' },
        response_concreteness: 'low',
      },
    };
    const result = recalculateAttemptScoresFromStoredSlices({
      transcript,
      scenario_1_scores: {
        pillarScores: { repair: 7, attunement: 7, mentalizing: 7, accountability: 6, contempt_expression: 7, contempt_recognition: 8 },
      },
      scenario_2_scores: {
        pillarScores: { repair: 7, attunement: 7, mentalizing: 7, appreciation: 8, accountability: 6, contempt_expression: 8 },
      },
      scenario_3_scores: {
        pillarScores: { repair: 7, attunement: 6, regulation: 7, mentalizing: 6, accountability: 6, contempt_expression: 6 },
      },
      scenario_specific_patterns: patterns,
      ego_development_level: 4,
      moment_4_concreteness: 'low',
      moment_5_concreteness: 'low',
    });
    expect(result.kind).toBe('success');
    if (result.kind !== 'success') return;
    expect(result.moment_4_concreteness).toBe('valid_non_applicable');
    expect(result.gate.moment4Concreteness).toBe('valid_non_applicable');
  });
});
