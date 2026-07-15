import { describe, expect, it, jest } from '@jest/globals';

import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import { MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT, MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import { runPreClaudeConfusionRepeatReplayGates } from '@features/aria/runPreClaudeConfusionRepeatReplayGates';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

const REPEAT_REQUEST_META: MetaCommentClassification = {
  type: 'confusion',
  confidence: 1.0,
  confusion_subtype: 'repeat_request',
};

const M5_FRIEND_TURN =
  'I had a conflict with a close friend over something they did that I felt was being considered. I was upset about it for a while before I said anything.';

describe('runPreClaudeConfusionRepeatReplayGates', () => {
  it('returns handled:false when meta is not a repeat request', async () => {
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
    });
    const messagesToUse = [{ role: 'assistant', content: 'What is going on between these two?' }];

    const result = await runPreClaudeConfusionRepeatReplayGates(
      deps,
      { type: 'frustration', confidence: 0.9 },
      messagesToUse,
      'What is going on between these two?',
      1,
    );

    expect(result).toEqual({ handled: false });
  });

  it('replays the last M5 question sentence when user repeats after a concrete anchor', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 5 },
      speakTextSafe,
      setMessages,
    });
    const lastInterviewer = 'I hear you. How did it get resolved between you two?';
    const messagesToUse = [
      { role: 'user', content: M5_FRIEND_TURN, interviewMoment: 5 },
      { role: 'assistant', content: lastInterviewer, interviewMoment: 5 },
      { role: 'user', content: 'Can you repeat the question?', interviewMoment: 5 },
    ];

    const result = await runPreClaudeConfusionRepeatReplayGates(
      deps,
      REPEAT_REQUEST_META,
      messagesToUse,
      lastInterviewer,
      3,
    );

    expect(result).toEqual({ handled: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      'Got it — How did it get resolved between you two?',
      expect.any(Object),
    );
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: 'Got it — How did it get resolved between you two?',
          scenarioNumber: 3,
        }),
      ]),
    );
  });

  it('replays the prior scenario question verbatim outside M5 short-replay path', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      lastQuestionTextRef: { current: 'Can you say more about that?' },
      speakTextSafe,
      setMessages,
    });
    const scenarioQuestion =
      "Here's the first situation:\n\nEmma and Ryan have dinner plans. What's going on between these two?";
    const messagesToUse = [
      { role: 'assistant', content: scenarioQuestion },
      { role: 'user', content: 'Hello?' },
      { role: 'assistant', content: 'Can you say more about that?' },
      { role: 'user', content: 'What was the question again?' },
    ];

    const result = await runPreClaudeConfusionRepeatReplayGates(
      deps,
      REPEAT_REQUEST_META,
      messagesToUse,
      'Can you say more about that?',
      1,
    );

    expect(result).toEqual({ handled: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      scenarioQuestion,
      expect.objectContaining({
        allowDuplicateConsecutiveTts: true,
        skipScenarioAContemptProbeSessionDedup: true,
      }),
    );
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: scenarioQuestion,
          scenarioNumber: 1,
          interviewMoment: 1,
        }),
      ]),
    );
  });

  it('syncs currentMessagesRef when replaying so the next turn sees the repeated question', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const commitInterviewMessages = jest.fn();
    const currentMessagesRef = { current: [] as Array<{ role: string; content?: string }> };
    const lastQuestionTextRef = { current: 'If you were Ryan, how would you repair this?' };
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 2 },
      lastQuestionTextRef,
      currentMessagesRef,
      commitInterviewMessages,
      speakTextSafe,
      setMessages,
    });
    const s2Question = 'What do you think is going on here?';
    const messagesToUse = [
      { role: 'assistant', content: s2Question, interviewMoment: 2, scenarioNumber: 2 },
      { role: 'user', content: 'Can you repeat?', interviewMoment: 2, scenarioNumber: 2 },
    ];

    const result = await runPreClaudeConfusionRepeatReplayGates(
      deps,
      REPEAT_REQUEST_META,
      messagesToUse,
      s2Question,
      2,
    );

    expect(result).toEqual({ handled: true });
    expect(currentMessagesRef.current.at(-1)).toEqual(
      expect.objectContaining({ role: 'assistant', content: s2Question, scenarioNumber: 2 }),
    );
    expect(lastQuestionTextRef.current).toBe(s2Question);
    expect(commitInterviewMessages).toHaveBeenCalled();
  });

  it('maps Scenario A contempt bleed to S2 Q1 instead of replaying Emma line on Scenario 2', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const currentMessagesRef = { current: [] as Array<{ role: string; content?: string }> };
    const emmaContempt =
      "What about when Emma says 'you've made that very clear' — what do you make of that?";
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 2 },
      lastQuestionTextRef: { current: emmaContempt },
      currentMessagesRef,
      speakTextSafe,
      setMessages,
    });
    const messagesToUse = [
      {
        role: 'assistant',
        content: 'If you were Ryan, how would you repair this?',
        interviewMoment: 1,
        scenarioNumber: 1,
      },
      { role: 'user', content: 'I would own it.', interviewMoment: 1, scenarioNumber: 1 },
      { role: 'assistant', content: emmaContempt, interviewMoment: 2, scenarioNumber: 2 },
      { role: 'user', content: 'Can you repeat?', interviewMoment: 2, scenarioNumber: 2 },
    ];

    const result = await runPreClaudeConfusionRepeatReplayGates(
      deps,
      REPEAT_REQUEST_META,
      messagesToUse,
      emmaContempt,
      2,
    );

    expect(result).toEqual({ handled: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      'What do you think is going on here?',
      expect.objectContaining({ allowDuplicateConsecutiveTts: true }),
    );
    expect(currentMessagesRef.current.at(-1)).toEqual(
      expect.objectContaining({
        role: 'assistant',
        content: 'What do you think is going on here?',
        scenarioNumber: 2,
      }),
    );
  });

  it('replays the pending Scenario B James repair when stream left a truncated Scenario A Ryan repair', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 2 },
      lastQuestionTextRef: {
        current: 'Got it. If you were Ryan, how would you actually repair things with Emma in',
      },
      speakTextSafe,
      setMessages,
    });
    const truncatedRyanRepair =
      'Got it. If you were Ryan, how would you actually repair things with Emma in';
    const messagesToUse = [
      { role: 'assistant', content: truncatedRyanRepair, interviewMoment: 2, scenarioNumber: 2 },
      { role: 'user', content: 'Repeat what you said.', interviewMoment: 2, scenarioNumber: 2 },
    ];

    const result = await runPreClaudeConfusionRepeatReplayGates(
      deps,
      REPEAT_REQUEST_META,
      messagesToUse,
      truncatedRyanRepair,
      2,
    );

    expect(result).toEqual({ handled: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      'Got it. And if you were James, how would you repair?',
      expect.objectContaining({
        allowDuplicateConsecutiveTts: true,
        skipScenarioAContemptProbeSessionDedup: true,
      }),
    );
  });

  it('replays canonical Scenario C Q2 instead of invalid Sophie-respond misparaphrase', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const invalidSophieRespond =
      'Got it. How would you want Sophie to respond when Daniel comes back?';
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 3 },
      currentScenarioRef: { current: 3 },
      lastQuestionTextRef: { current: invalidSophieRespond },
      speakTextSafe,
      setMessages,
    });
    const messagesToUse = [
      { role: 'assistant', content: invalidSophieRespond, interviewMoment: 3, scenarioNumber: 3 },
      { role: 'user', content: 'Repeat what you said.', interviewMoment: 3, scenarioNumber: 3 },
    ];

    const result = await runPreClaudeConfusionRepeatReplayGates(
      deps,
      REPEAT_REQUEST_META,
      messagesToUse,
      invalidSophieRespond,
      3,
    );

    expect(result).toEqual({ handled: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      'How do you think this situation could be repaired?',
      expect.objectContaining({
        allowDuplicateConsecutiveTts: true,
        skipScenarioAContemptProbeSessionDedup: true,
      }),
    );
  });

  it('replays pending M4 commitment threshold after neutral ack instead of the useless ack line', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 4 },
      moment4ThresholdProbeAskedRef: { current: false },
      lastQuestionTextRef: { current: 'Thank you for sharing that, Matt.' },
      speakTextSafe,
      setMessages,
    });
    const messagesToUse = [
      { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT, interviewMoment: 4 },
      {
        role: 'user',
        content:
          'I had a fight with my friend Devonciu. He called me a bad coach. We talked it through and see eye to eye now.',
        interviewMoment: 4,
      },
      { role: 'assistant', content: 'Thank you for sharing that, Matt.', interviewMoment: 4 },
      { role: 'user', content: 'Yes, repeat what you said.', interviewMoment: 4 },
    ];

    const result = await runPreClaudeConfusionRepeatReplayGates(
      deps,
      REPEAT_REQUEST_META,
      messagesToUse,
      'Thank you for sharing that, Matt.',
      3,
    );

    expect(result).toEqual({ handled: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT,
      expect.objectContaining({
        allowDuplicateConsecutiveTts: true,
        skipScenarioAContemptProbeSessionDedup: true,
      }),
    );
  });
});
