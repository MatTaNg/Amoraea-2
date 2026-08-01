import { IRRELEVANT_ANSWER_RETRY_LINE } from '@features/aria/interviewAnswerRelevance';
import {
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT,
  MOMENT_4_GRUDGE_QUESTION_TEXT,
} from '@features/aria/moment4ProbeLogic';
import { moment4UserDeclinesSpecificityReask } from '@features/aria/moment4SpecificityFollowUp';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/probeAndScoringUtils';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { runPreClaudeIrrelevantAnswerRetryGate } from '@features/aria/runPreClaudeIrrelevantAnswerRetryGate';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from '@features/aria/scenarioAContemptProbeTtsStrip';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';
import { SCENARIO_B_JAMES_REPAIR_CANONICAL } from '@features/aria/scenarioBProbeLogic';

function buildDeps(overrides: Partial<PreClaudeTurnGateDeps> = {}): PreClaudeTurnGateDeps {
  return {
    currentScenarioRef: { current: 1 },
    currentInterviewMomentRef: { current: 1 },
    currentMessagesRef: { current: [] },
    lastQuestionTextRef: { current: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY },
    interviewSessionIdRef: { current: 'session-1' },
    setMessages: jest.fn(),
    setReferenceCardPrompt: jest.fn(),
    setReferenceCardScenario: jest.fn(),
    setInterviewUiPhase: jest.fn(),
    speakTextSafe: jest.fn().mockResolvedValue(undefined),
    setVoiceState: jest.fn(),
    setIsWaiting: jest.fn(),
    messages: [],
    ...overrides,
  } as unknown as PreClaudeTurnGateDeps;
}

describe('runPreClaudeIrrelevantAnswerRetryGate', () => {
  it('does not retry score-status asks (handled by score-request gate)', async () => {
    const deps = buildDeps();
    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      'Can I see my school',
      [],
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
    );
    expect(result).toEqual({ handled: false });
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });

  it('defers checking-in sufficiency asks to the checking-in gate (not "Can you try again?")', async () => {
    const repairQ = SCENARIO_B_JAMES_REPAIR_CANONICAL;
    const answer = "Wasn't that enough?";
    const messages = [
      { role: 'assistant' as const, content: repairQ, scenarioNumber: 2 as const },
      { role: 'user' as const, content: answer, scenarioNumber: 2 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 2 },
      currentInterviewMomentRef: { current: 2 },
      lastQuestionTextRef: { current: repairQ },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(deps, answer, messages, repairQ);

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });

  it('retries "I think that James could have" cut-off on Scenario B James differently Q2', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content:
          'What do you think James could have done differently to help Sarah feel appreciated?',
        scenarioNumber: 2 as const,
      },
      { role: 'user' as const, content: 'I think that James could have', scenarioNumber: 2 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 2 },
      currentInterviewMomentRef: { current: 2 },
      lastQuestionTextRef: {
        current:
          'What do you think James could have done differently to help Sarah feel appreciated?',
      },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      'I think that James could have',
      messages,
      messages[0].content,
    );

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      IRRELEVANT_ANSWER_RETRY_LINE,
      expect.objectContaining({ skipLastQuestionRef: true, skipInterviewSpeechAdvance: true }),
    );
  });

  it('restores Show scenario modal to the assessable question on cut-off retry', async () => {
    const repairQ = SCENARIO_B_JAMES_REPAIR_CANONICAL;
    const messages = [
      { role: 'assistant' as const, content: repairQ, scenarioNumber: 2 as const },
      { role: 'user' as const, content: 'I think that James could have', scenarioNumber: 2 as const },
    ];
    const setReferenceCardPrompt = jest.fn();
    const setReferenceCardScenario = jest.fn();
    const setInterviewUiPhase = jest.fn();
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 2 },
      currentInterviewMomentRef: { current: 2 },
      lastQuestionTextRef: { current: repairQ },
      setReferenceCardPrompt,
      setReferenceCardScenario,
      setInterviewUiPhase,
      committedScenarioRef: { current: { label: 'Situation 2', text: 'vignette' } },
    });

    await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      'I think that James could have',
      messages,
      repairQ,
    );

    expect(setReferenceCardPrompt).toHaveBeenCalledWith(repairQ);
  });

  it('retries "I think that Daniel" cut-off on scenario Q1', async () => {
    const scenarioCQ1 =
      "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?";
    const cutOff = 'I think that Daniel';
    const messages = [
      { role: 'assistant' as const, content: scenarioCQ1, scenarioNumber: 3 as const },
      { role: 'user' as const, content: cutOff, scenarioNumber: 3 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 3 },
      currentInterviewMomentRef: { current: 3 },
      lastQuestionTextRef: { current: scenarioCQ1 },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      cutOff,
      messages,
      scenarioCQ1,
    );

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      IRRELEVANT_ANSWER_RETRY_LINE,
      expect.objectContaining({ skipLastQuestionRef: true }),
    );
  });

  it('defers identity/off-topic asks to Claude when Phase 2 is enabled', async () => {
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

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
    expect(deps.lastQuestionTextRef.current).toBe(SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY);
  });

  it('defers identity ask on repair question to Claude when Phase 2 is enabled', async () => {
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

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });

  it('defers repeated identity ask after prior inability line to Claude when Phase 2 is enabled', async () => {
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

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });

  it('defers when the user repeats the same off-topic ask (Phase 2)', async () => {
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

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
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

  it('retries "I think Daniel" style cut-offs on Scenario 3', async () => {
    const opening =
      "When Daniel comes back and says 'I didn't know what to say,' what do you make of that?";
    const incomplete = 'I think Daniel';
    const messages = [
      { role: 'assistant' as const, content: opening, scenarioNumber: 3 as const },
      { role: 'user' as const, content: incomplete, scenarioNumber: 3 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 3 },
      currentInterviewMomentRef: { current: 3 },
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

  it('retries repair-echo answers on Scenario C repair Q2', async () => {
    const repairQ = 'Got it. How do you think this situation could be repaired?';
    const echo = 'This situation can be repaired.';
    const messages = [
      { role: 'assistant' as const, content: repairQ, scenarioNumber: 3 as const },
      { role: 'user' as const, content: echo, scenarioNumber: 3 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 3 },
      currentInterviewMomentRef: { current: 3 },
      lastQuestionTextRef: { current: repairQ },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      echo,
      messages,
      repairQ,
    );

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      IRRELEVANT_ANSWER_RETRY_LINE,
      expect.objectContaining({ skipLastQuestionRef: true }),
    );
  });

  it('retries "Daniel felt genuinely" style cut-offs on Scenario 3', async () => {
    const opening =
      "When Daniel comes back and says 'I didn't know what to say,' what do you make of that?";
    const incomplete = 'Daniel felt genuinely';
    const messages = [
      { role: 'assistant' as const, content: opening, scenarioNumber: 3 as const },
      { role: 'user' as const, content: incomplete, scenarioNumber: 3 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 3 },
      currentInterviewMomentRef: { current: 3 },
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

  it('retries bare "I think" cut-offs on Moment 4 grudge question', async () => {
    const incomplete = 'I think';
    const messages = [
      { role: 'assistant' as const, content: MOMENT_4_GRUDGE_QUESTION_TEXT, scenarioNumber: 3 as const },
      { role: 'user' as const, content: incomplete, scenarioNumber: 3 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 3 },
      currentInterviewMomentRef: { current: 4 },
      lastQuestionTextRef: { current: MOMENT_4_GRUDGE_QUESTION_TEXT },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      incomplete,
      messages,
      MOMENT_4_GRUDGE_QUESTION_TEXT,
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

  it('does not retry skip/advance asks on the commitment threshold (defer to skip gates)', async () => {
    const thresholdQuestion = MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT;
    const deps = buildDeps({
      currentInterviewMomentRef: { current: 4 },
      currentScenarioRef: { current: 3 },
      lastQuestionTextRef: { current: thresholdQuestion },
    });
    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      "What's the next one?",
      [{ role: 'assistant', content: thresholdQuestion, scenarioNumber: 3 as const }],
      thresholdQuestion,
      { type: 'skip_request', confidence: 0.89 },
    );
    expect(result).toEqual({ handled: false });
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });

  it('does not retry specificity pushback on the commitment threshold', async () => {
    const thresholdQuestion = MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT;
    const deps = buildDeps({
      currentInterviewMomentRef: { current: 4 },
      currentScenarioRef: { current: 3 },
      lastQuestionTextRef: { current: thresholdQuestion },
    });
    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      'I just gave you one.',
      [{ role: 'assistant', content: thresholdQuestion, scenarioNumber: 3 as const }],
      thresholdQuestion,
    );
    expect(result).toEqual({ handled: false });
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
    expect(moment4UserDeclinesSpecificityReask('I just gave you one.')).toBe(true);
  });

  it('retries incomplete threshold answers on Moment 4 before advancing to Moment 5', async () => {
    const thresholdQuestion = MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT;
    const incomplete = 'It depends on';
    const messages = [
      { role: 'assistant' as const, content: thresholdQuestion, scenarioNumber: 3 as const },
      { role: 'user' as const, content: incomplete, scenarioNumber: 3 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 3 },
      currentInterviewMomentRef: { current: 4 },
      lastQuestionTextRef: { current: thresholdQuestion },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      incomplete,
      messages,
      thresholdQuestion,
    );

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      IRRELEVANT_ANSWER_RETRY_LINE,
      expect.objectContaining({ skipLastQuestionRef: true }),
    );
    expect(deps.lastQuestionTextRef.current).toBe(thresholdQuestion);
  });

  it('retries "If someone is willing" cut-off on the commitment threshold question', async () => {
    const thresholdQuestion = MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT;
    const incomplete = 'If someone is willing';
    const messages = [
      { role: 'assistant' as const, content: thresholdQuestion, scenarioNumber: 3 as const },
      { role: 'user' as const, content: incomplete, scenarioNumber: 3 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 3 },
      currentInterviewMomentRef: { current: 4 },
      lastQuestionTextRef: { current: thresholdQuestion },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      incomplete,
      messages,
      thresholdQuestion,
    );

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      IRRELEVANT_ANSWER_RETRY_LINE,
      expect.anything(),
    );
  });

  it('accepts work-through commitment threshold answers without cut-off retry', async () => {
    const thresholdQuestion = MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT;
    const answer =
      "I think if two partners are willing to do the work, no matter how hard it gets, it's worth saving if you really love each other.";
    const messages = [
      { role: 'assistant' as const, content: thresholdQuestion, scenarioNumber: 3 as const },
      { role: 'user' as const, content: answer, scenarioNumber: 3 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 3 },
      currentInterviewMomentRef: { current: 4 },
      lastQuestionTextRef: { current: thresholdQuestion },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      answer,
      messages,
      thresholdQuestion,
    );

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });

  it('accepts mutual-commitment stay-side threshold answers from production logs', async () => {
    const thresholdQuestion = MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT;
    const answers = [
      "I think it depends. I think if you're both committed to the relationship, then you should do your best to make it work.",
      "If you're both committed to making it work and committed to growth then I think you should do whatever it takes.",
    ];
    for (const answer of answers) {
      const messages = [
        { role: 'assistant' as const, content: thresholdQuestion, scenarioNumber: 3 as const },
        { role: 'user' as const, content: answer, scenarioNumber: 3 as const },
      ];
      const deps = buildDeps({
        messages,
        currentMessagesRef: { current: messages },
        currentScenarioRef: { current: 3 },
        currentInterviewMomentRef: { current: 4 },
        lastQuestionTextRef: { current: thresholdQuestion },
      });

      const result = await runPreClaudeIrrelevantAnswerRetryGate(
        deps,
        answer,
        messages,
        thresholdQuestion,
      );

      expect(result.handled).toBe(false);
    }
  });

  it('accepts short Emma affect reads on the contempt probe without retry', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
        scenarioNumber: 1 as const,
      },
      {
        role: 'user' as const,
        content: "So, I think she's very frustrated and disappointed.",
        scenarioNumber: 1 as const,
      },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      "So, I think she's very frustrated and disappointed.",
      messages,
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
    );

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });

  it('accepts five-word Emma frustration read on the contempt probe without retry', async () => {
    const answer = "I think she's very frustrated";
    const messages = [
      {
        role: 'assistant' as const,
        content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
        scenarioNumber: 1 as const,
      },
      { role: 'user' as const, content: answer, scenarioNumber: 1 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      answer,
      messages,
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
    );

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });

  it('accepts bare short contempt-probe answers naming Emma', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
        scenarioNumber: 1 as const,
      },
      {
        role: 'user' as const,
        content: 'Emma is being condescending.',
        scenarioNumber: 1 as const,
      },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      'Emma is being condescending.',
      messages,
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
    );

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });

  it('accepts thin Sophie affect reads on the perspective probe without retry', async () => {
    const answer = 'Probably annoying.';
    const messages = [
      {
        role: 'assistant' as const,
        content: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
        scenarioNumber: 3 as const,
      },
      { role: 'user' as const, content: answer, scenarioNumber: 3 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 3 },
      currentInterviewMomentRef: { current: 3 },
      lastQuestionTextRef: { current: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      answer,
      messages,
      SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
    );

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });

  it('accepts Sophie affect answer cut off on "for so" without retry', async () => {
    const answer = 'I think it was probably very frustrating for so';
    const messages = [
      {
        role: 'assistant' as const,
        content: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
        scenarioNumber: 3 as const,
      },
      { role: 'user' as const, content: answer, scenarioNumber: 3 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 3 },
      currentInterviewMomentRef: { current: 3 },
      lastQuestionTextRef: { current: SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      answer,
      messages,
      SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE,
    );

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });

  it('retries Moment 5 narrative opener cut-offs like "This one time"', async () => {
    const answer = 'This one time';
    const messages = [
      {
        role: 'assistant' as const,
        content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
        interviewMoment: 5,
        scenarioNumber: 3 as const,
      },
      { role: 'user' as const, content: answer, interviewMoment: 5, scenarioNumber: 3 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 3 },
      currentInterviewMomentRef: { current: 5 },
      lastQuestionTextRef: { current: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      answer,
      messages,
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
    );

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      IRRELEVANT_ANSWER_RETRY_LINE,
      expect.objectContaining({ skipLastQuestionRef: true, allowDuplicateConsecutiveTts: true }),
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

  it('accepts complete short replies after a recovery prompt already fired for the same question', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
        scenarioNumber: 1 as const,
      },
      { role: 'user' as const, content: 'Um.', scenarioNumber: 1 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      substantiveInterviewQuestionDeliveredSeqRef: { current: 3 },
      recoveryAssistantSpokenAtSubstantiveSeqRef: { current: 3 },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      'I did.',
      messages,
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
    );

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });

  it('still retries cut-off fragments after a recovery prompt on the same question', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
        scenarioNumber: 1 as const,
      },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      substantiveInterviewQuestionDeliveredSeqRef: { current: 3 },
      recoveryAssistantSpokenAtSubstantiveSeqRef: { current: 3 },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      'Yeah, me and my partner.',
      messages,
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
    );

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalled();
  });

  it('does not retry interview-process question requests like "Give a question."', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: 'What do you think is going on here?',
        scenarioNumber: 2 as const,
      },
      { role: 'user' as const, content: 'Give a question.', scenarioNumber: 2 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 2 },
      currentInterviewMomentRef: { current: 2 },
      lastQuestionTextRef: { current: 'What do you think is going on here?' },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      'Give a question.',
      messages,
      'What do you think is going on here?',
      null,
    );

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });

  it('does not retry cut-off process question asks like "Give a ques-"', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: 'What do you think is going on here?',
        scenarioNumber: 2 as const,
      },
      { role: 'user' as const, content: 'Give a ques-', scenarioNumber: 2 as const },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      currentScenarioRef: { current: 2 },
      currentInterviewMomentRef: { current: 2 },
      lastQuestionTextRef: { current: 'What do you think is going on here?' },
      lastUserTurnMicStopTelemetryRef: {
        current: {
          audioDurationMs: 0,
          wordCount: 3,
          wordsPerSecond: 0,
          ratioFlag: true,
        },
      },
    });

    const result = await runPreClaudeIrrelevantAnswerRetryGate(
      deps,
      'Give a ques-',
      messages,
      'What do you think is going on here?',
      null,
    );

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });
});
