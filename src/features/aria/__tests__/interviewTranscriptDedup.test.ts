import { describe, expect, it } from '@jest/globals';

import {
  classifyScriptedFollowUpKind,
  compactInterviewTranscriptTurns,
  resolveStagedAssistantPersistContent,
  shouldReplaceLastUserTurnWithRefinedTranscript,
  shouldSkipRedundantAssistantPersist,
  upsertAssistantTranscriptTurn,
} from '@features/aria/interviewTranscriptDedup';
import { SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY } from '@features/aria/probeAndScoringUtils';
import { SCENARIO_C_REPAIR_QUESTION_CANONICAL } from '@features/aria/scenarioCPromptDetection';

describe('interviewTranscriptDedup', () => {
  it('classifies scripted follow-up kinds', () => {
    expect(classifyScriptedFollowUpKind(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY)).toBe('s1_contempt');
    expect(classifyScriptedFollowUpKind(SCENARIO_C_REPAIR_QUESTION_CANONICAL)).toBe('s3_repair');
  });

  it('skips assistant persist when the same follow-up type is already in transcript', () => {
    const transcript = [
      { role: 'assistant', content: SCENARIO_C_REPAIR_QUESTION_CANONICAL },
    ];
    const paraphrase =
      'Got it. How do you think Daniel and Sophie could repair this situation between them?';
    expect(shouldSkipRedundantAssistantPersist(transcript, SCENARIO_C_REPAIR_QUESTION_CANONICAL)).toBe(
      true,
    );
    expect(shouldSkipRedundantAssistantPersist(transcript, paraphrase)).toBe(true);
  });

  it('uses staged bootstrap assistant content instead of model paraphrase', () => {
    const live = [
      { role: 'assistant', content: 'Scenario A opening' },
      { role: 'user', content: 'Emma should talk to Ryan calmly.' },
    ];
    const staged = [
      ...live,
      { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
    ];
    expect(
      resolveStagedAssistantPersistContent(live, staged, 'What specific line from Emma felt contemptuous?'),
    ).toBe(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY);
  });

  it('replaces near-duplicate back-to-back user transcriptions', () => {
    const first =
      'I think that was not an agreement and her tone sounded snide when she said it.';
    const second =
      "I think that's not an agreement and her tone sounded sad when she said it.";
    expect(shouldReplaceLastUserTurnWithRefinedTranscript(first, second)).toBe(true);
    expect(shouldReplaceLastUserTurnWithRefinedTranscript(first, 'Completely different answer.')).toBe(
      false,
    );
  });

  it('skips assistant persist when follow-up kind already exists anywhere in transcript', () => {
    const transcript = [
      { role: 'assistant', content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
    ];
    const paraphrase =
      "When Emma says you've made that very clear, what do you make of that line?";
    expect(
      shouldSkipRedundantAssistantPersist(transcript, SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY),
    ).toBe(true);
    expect(shouldSkipRedundantAssistantPersist(transcript, paraphrase)).toBe(true);
  });

  it('upsert replaces paraphrase with canonical scripted follow-up in-place', () => {
    const paraphrase =
      "When Emma says you've made that very clear, what do you make of that line?";
    const transcript = [
      { role: 'user', content: 'Emma was harsh.' },
      { role: 'assistant', content: paraphrase },
    ];
    const { transcript: next, action } = upsertAssistantTranscriptTurn(
      transcript,
      transcript,
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
      { scenarioNumber: 1 },
    );
    expect(action).toBe('replace');
    expect(next).toHaveLength(2);
    expect(next[1]?.content).toBe(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY);
  });

  it('skips back-to-back assistant questions with overlapping tokens', () => {
    const a =
      'How would you repair this if you were Ryan — what would you say to Emma?';
    const b =
      'If you were Ryan, how would you repair things with Emma after that line?';
    expect(shouldSkipRedundantAssistantPersist([{ role: 'assistant', content: a }], b)).toBe(true);
  });

  it('skips S3 Q1 Daniel paraphrase when canonical Q1 already in transcript', () => {
    const canonical =
      "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?";
    const paraphrase =
      "When Daniel walks back in and says he didn't know what to say, what do you make of that line?";
    const transcript = [{ role: 'assistant', content: canonical }];
    expect(shouldSkipRedundantAssistantPersist(transcript, paraphrase)).toBe(true);
    expect(classifyScriptedFollowUpKind(paraphrase)).toBe('s3_q1_daniel');
  });

  it('compactInterviewTranscriptTurns collapses back-to-back duplicate users and assistants', () => {
    const firstUser =
      'I think that was not an agreement and her tone sounded snide when she said it.';
    const secondUser =
      "I think that's not an agreement and her tone sounded sad when she said it.";
    const canonical =
      "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?";
    const paraphrase =
      "When Daniel walks back in and says he didn't know what to say, what do you make of that line?";
    const compacted = compactInterviewTranscriptTurns([
      { role: 'assistant', content: 'Opening' },
      { role: 'user', content: firstUser },
      { role: 'user', content: secondUser },
      { role: 'assistant', content: canonical },
      { role: 'assistant', content: paraphrase },
    ]);
    expect(compacted).toHaveLength(3);
    expect(compacted[1]?.content).toBe(secondUser);
    expect(compacted[2]?.content).toBe(paraphrase);
  });
});
