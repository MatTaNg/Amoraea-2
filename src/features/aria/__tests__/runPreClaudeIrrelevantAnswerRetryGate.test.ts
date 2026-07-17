import { IRRELEVANT_ANSWER_RETRY_LINE } from '@features/aria/interviewAnswerRelevance';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { runPreClaudeIrrelevantAnswerRetryGate } from '@features/aria/runPreClaudeIrrelevantAnswerRetryGate';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from '@features/aria/scenarioAContemptProbeTtsStrip';

function buildDeps(overrides: Partial<PreClaudeTurnGateDeps> = {}): PreClaudeTurnGateDeps {
  return {
    currentScenarioRef: { current: 1 },
    currentInterviewMomentRef: { current: 1 },
    currentMessagesRef: { current: [] },
    lastQuestionTextRef: { current: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
    interviewSessionIdRef: { current: 'session-1' },
    setMessages: jest.fn(),
    speakTextSafe: jest.fn().mockResolvedValue(undefined),
    setVoiceState: jest.fn(),
    setIsWaiting: jest.fn(),
    messages: [],
    ...overrides,
  } as unknown as PreClaudeTurnGateDeps;
}

describe('runPreClaudeIrrelevantAnswerRetryGate', () => {
  it('speaks inability-to-score only for "Are you an alien?" — no ack, no question repeat', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
        scenarioNumber: 1 as const,
      },
      {
        role: 'user' as const,
        content: 'Are you an alien?',
        scenarioNumber: 1 as const,
      },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      'Are you an alien?',
      messages,
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
    );

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      IRRELEVANT_ANSWER_RETRY_LINE,
      expect.objectContaining({
        skipLastQuestionRef: true,
        allowDuplicateConsecutiveTts: true,
      }),
    );
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      expect.not.stringContaining(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY),
      expect.anything(),
    );
    expect(deps.lastQuestionTextRef.current).toBe(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY);
  });

  it('on repair question, still speaks inability-to-score only — no Got it, no re-ask', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
        scenarioNumber: 1 as const,
      },
      {
        role: 'user' as const,
        content: 'Are you an alien?',
        scenarioNumber: 1 as const,
      },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      lastQuestionTextRef: { current: SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      'Are you an alien?',
      messages,
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    );

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledTimes(1);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      IRRELEVANT_ANSWER_RETRY_LINE,
      expect.objectContaining({
        skipLastQuestionRef: true,
        allowDuplicateConsecutiveTts: true,
      }),
    );
    const spoken = (deps.speakTextSafe as jest.Mock).mock.calls[0][0] as string;
    expect(spoken).not.toMatch(/got it|makes sense|if you were ryan|repair this/i);
  });

  it('still handles when last assistant was the prior inability-to-score line', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
        scenarioNumber: 1 as const,
      },
      { role: 'user' as const, content: 'Are you an alien?', scenarioNumber: 1 as const },
      {
        role: 'assistant' as const,
        content: IRRELEVANT_ANSWER_RETRY_LINE,
        scenarioNumber: 1 as const,
      },
      { role: 'user' as const, content: 'Are you a robot?', scenarioNumber: 1 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      lastQuestionTextRef: { current: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      'Are you a robot?',
      messages,
      IRRELEVANT_ANSWER_RETRY_LINE,
    );

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      IRRELEVANT_ANSWER_RETRY_LINE,
      expect.objectContaining({
        skipLastQuestionRef: true,
        allowDuplicateConsecutiveTts: true,
      }),
    );
  });

  it('speaks again when the user repeats the same off-topic ask', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
        scenarioNumber: 1 as const,
      },
      { role: 'user' as const, content: 'Are you an alien?', scenarioNumber: 1 as const },
      {
        role: 'assistant' as const,
        content: IRRELEVANT_ANSWER_RETRY_LINE,
        scenarioNumber: 1 as const,
      },
      { role: 'user' as const, content: 'Are you an alien?', scenarioNumber: 1 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      lastQuestionTextRef: { current: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      'Are you an alien?',
      messages,
      IRRELEVANT_ANSWER_RETRY_LINE,
    );

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      IRRELEVANT_ANSWER_RETRY_LINE,
      expect.objectContaining({ allowDuplicateConsecutiveTts: true }),
    );
  });

  it('does not intercept an on-topic contempt answer', async () => {
    const onTopic =
      "Emma's tone is contemptuous — that 'very clear' line is pure disdain toward Ryan.";
    const messages = [
      {
        role: 'assistant' as const,
        content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
        scenarioNumber: 1 as const,
      },
      { role: 'user' as const, content: onTopic, scenarioNumber: 1 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      onTopic,
      messages,
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
    );

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });

  it('retries incomplete cut-off answers that only name a character', async () => {
    const opening = "What's going on between these two?";
    const incomplete = 'If I were Ryan, I would';
    const messages = [
      { role: 'assistant' as const, content: opening, scenarioNumber: 1 as const },
      { role: 'user' as const, content: incomplete, scenarioNumber: 1 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
      lastQuestionTextRef: { current: opening },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      incomplete,
      messages,
      opening,
    );

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      IRRELEVANT_ANSWER_RETRY_LINE,
      expect.objectContaining({ skipLastQuestionRef: true }),
    );
  });

  it('retries incomplete cut-offs after resume welcome-back when last assistant is not the question', async () => {
    const opening = "What's going on between these two?";
    const incomplete = 'If I were Ryan, I would';
    const welcomeBack = 'Welcome back — whenever you are ready, we can continue.';
    const messages = [
      { role: 'assistant' as const, content: opening, scenarioNumber: 1 as const },
      { role: 'assistant' as const, content: welcomeBack, scenarioNumber: 1 as const },
      { role: 'user' as const, content: incomplete, scenarioNumber: 1 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
      lastQuestionTextRef: { current: opening },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      incomplete,
      messages,
      welcomeBack,
    );

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      IRRELEVANT_ANSWER_RETRY_LINE,
      expect.anything(),
    );
  });

  it('does not intercept skip-confirmation affirmatives', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: 'Are you sure you want to skip this one? We can, but it may affect your score.',
        scenarioNumber: 1 as const,
      },
      { role: 'user' as const, content: 'Yes.', scenarioNumber: 1 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      skipContinuationSystemSuffixRef: { current: 'SKIP ACCEPTED' },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      'Yes.',
      messages,
      messages[0].content,
    );

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });
});
