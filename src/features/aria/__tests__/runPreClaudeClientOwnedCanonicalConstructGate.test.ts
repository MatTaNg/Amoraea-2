import { runPreClaudeClientOwnedCanonicalConstructGate } from '@features/aria/runPreClaudeClientOwnedCanonicalConstructGate';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
} from '@features/aria/scenarioAContemptProbeTtsStrip';
import {
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import { SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE } from '@features/aria/interviewDisengagementProbeCopy';

function baseFlags(
  overrides: Partial<PreClaudeScenarioConstructProbeFlags> = {},
): PreClaudeScenarioConstructProbeFlags {
  return {
    replyingToScenarioAQ1: false,
    replyingToScenarioBQ1: false,
    replyingToScenarioCQ1: false,
    scenarioAContemptGateUserText: '',
    shouldForceScenarioAContemptProbe: false,
    shouldForceScenarioBFullAppreciationProbe: false,
    shouldForceScenarioBJamesRepairProbe: false,
    shouldForceScenarioCRepairProbe: false,
    shouldForceScenarioCSophiePerspectiveProbe: false,
    specificEmmaLineAlreadyAddressed: false,
    sidedEntirelyWithJames: false,
    scenarioBQ1Engaged: false,
    muteParallelTtsForScenarioAContemptProbeStream: false,
    muteParallelTtsForS3ToM4HandoffStream: false,
    allowScenarioARepairAfterContemptAnswer: false,
    ...overrides,
  };
}

function buildDeps(overrides: Partial<PreClaudeTurnGateDeps> = {}): PreClaudeTurnGateDeps {
  return {
    currentScenarioRef: { current: 2 },
    currentInterviewMomentRef: { current: 2 },
    currentMessagesRef: { current: [] },
    scenarioAContemptProbeAskedRef: { current: false },
    scenarioARepairQuestionAskedRef: { current: false },
    pendingScenarioAContemptProbeStreamMuteRef: { current: false },
    s2RepairProbeDeliveredRef: { current: false },
    scenarioCSophiePerspectiveProbeFiredRef: { current: false },
    lastQuestionTextRef: { current: '' },
    interviewSessionIdRef: { current: 'session-1' },
    setMessages: jest.fn(),
    speakTextSafe: jest.fn().mockResolvedValue(undefined),
    setVoiceState: jest.fn(),
    setIsWaiting: jest.fn(),
    messages: [],
    ...overrides,
  } as unknown as PreClaudeTurnGateDeps;
}

describe('runPreClaudeClientOwnedCanonicalConstructGate', () => {
  it('delivers canonical James differently after Q1 without Claude', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: 'What do you think is going on here?',
        scenarioNumber: 2 as const,
      },
      {
        role: 'user' as const,
        content: 'Sarah needed emotional celebration, not logistics questions.',
        scenarioNumber: 2 as const,
      },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
    });

    const result = await runPreClaudeClientOwnedCanonicalConstructGate(
      deps,
      messages[1].content,
      messages,
      messages[0].content,
      baseFlags({ replyingToScenarioBQ1: true, scenarioBQ1Engaged: true }),
    );

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL),
      expect.anything(),
    );
  });

  it('does not deliver James differently when user asks for the question', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: 'What do you think is going on here?',
        scenarioNumber: 2 as const,
      },
      {
        role: 'user' as const,
        content: 'Give a question.',
        scenarioNumber: 2 as const,
      },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
      lastQuestionTextRef: { current: messages[0].content },
    });

    const result = await runPreClaudeClientOwnedCanonicalConstructGate(
      deps,
      messages[1].content,
      messages,
      messages[0].content,
      baseFlags({ replyingToScenarioBQ1: true, scenarioBQ1Engaged: true }),
    );

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
  });

  it('delivers canonical James repair after differently Q2 without Claude', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
        scenarioNumber: 2 as const,
      },
      {
        role: 'user' as const,
        content:
          "I'm guessing you wanted me to comment on how James was asking detailed questions and not asking how she felt.",
        scenarioNumber: 2 as const,
      },
    ];
    const deps = buildDeps({
      messages,
      currentMessagesRef: { current: messages },
    });

    const result = await runPreClaudeClientOwnedCanonicalConstructGate(
      deps,
      messages[1].content,
      messages,
      messages[0].content,
      baseFlags({ shouldForceScenarioBJamesRepairProbe: true }),
    );

    expect(result.handled).toBe(true);
    expect(deps.s2RepairProbeDeliveredRef.current).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining(SCENARIO_B_JAMES_REPAIR_CANONICAL),
      expect.anything(),
    );
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      expect.not.stringMatching(/before the fight/i),
      expect.anything(),
    );
  });

  it('delivers canonical S1 contempt without Claude when forced', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: "What's going on between these two?",
        scenarioNumber: 1 as const,
      },
      {
        role: 'user' as const,
        content: 'Ryan put his mother above Emma.',
        scenarioNumber: 1 as const,
      },
    ];
    const deps = buildDeps({
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
      pendingScenarioAContemptProbeStreamMuteRef: { current: true },
      messages,
      currentMessagesRef: { current: messages },
    });

    const result = await runPreClaudeClientOwnedCanonicalConstructGate(
      deps,
      messages[1].content,
      messages,
      messages[0].content,
      baseFlags({ shouldForceScenarioAContemptProbe: true }),
    );

    expect(result.handled).toBe(true);
    expect(deps.scenarioAContemptProbeAskedRef.current).toBe(true);
    expect(deps.pendingScenarioAContemptProbeStreamMuteRef.current).toBe(false);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
      expect.anything(),
    );
  });

  it('does not advance S2 James repair for incomplete cut-off answers on James differently Q2', async () => {
    const incomplete = 'I think that James could have';
    const messages = [
      {
        role: 'assistant' as const,
        content: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
        scenarioNumber: 2 as const,
      },
      { role: 'user' as const, content: incomplete, scenarioNumber: 2 as const },
    ];
    const deps = buildDeps({
      currentScenarioRef: { current: 2 },
      currentInterviewMomentRef: { current: 2 },
      messages,
      currentMessagesRef: { current: messages },
      lastQuestionTextRef: { current: SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL },
    });

    const result = await runPreClaudeClientOwnedCanonicalConstructGate(
      deps,
      incomplete,
      messages,
      messages[0].content,
      baseFlags({ shouldForceScenarioBJamesRepairProbe: true }),
    );

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
    expect(deps.s2RepairProbeDeliveredRef.current).toBe(false);
  });

  it('does not advance S1 contempt for incomplete cut-off answers', async () => {
    const incomplete = 'If I were Ryan, I would';
    const messages = [
      {
        role: 'assistant' as const,
        content: "What's going on between these two?",
        scenarioNumber: 1 as const,
      },
      { role: 'user' as const, content: incomplete, scenarioNumber: 1 as const },
    ];
    const deps = buildDeps({
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
      messages,
      currentMessagesRef: { current: messages },
    });

    const result = await runPreClaudeClientOwnedCanonicalConstructGate(
      deps,
      incomplete,
      messages,
      messages[0].content,
      baseFlags({ shouldForceScenarioAContemptProbe: true, replyingToScenarioAQ1: true }),
    );

    expect(result.handled).toBe(false);
    expect(deps.speakTextSafe).not.toHaveBeenCalled();
    expect(deps.scenarioAContemptProbeAskedRef.current).toBe(false);
  });

  it('does not re-ask S1 contempt when mute was armed but user already covered Emma line', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: "What's going on between these two?",
        scenarioNumber: 1 as const,
      },
      {
        role: 'user' as const,
        content:
          'Emma is being condescending when she says you made that very clear.',
        scenarioNumber: 1 as const,
      },
    ];
    const deps = buildDeps({
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
      scenarioAContemptProbeAskedRef: { current: true },
      pendingScenarioAContemptProbeStreamMuteRef: { current: true },
      messages,
      currentMessagesRef: { current: messages },
    });

    const result = await runPreClaudeClientOwnedCanonicalConstructGate(
      deps,
      messages[1].content,
      messages,
      messages[0].content,
      baseFlags({
        shouldForceScenarioAContemptProbe: false,
        specificEmmaLineAlreadyAddressed: true,
        muteParallelTtsForScenarioAContemptProbeStream: true,
        allowScenarioARepairAfterContemptAnswer: true,
      }),
    );

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
      expect.anything(),
    );
    expect(deps.speakTextSafe).not.toHaveBeenCalledWith(
      SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
      expect.anything(),
    );
  });

  it('delivers canonical S3 Sophie perspective after substantive Q1 without Claude', async () => {
    const scenarioCQ1 =
      "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?";
    const answer =
      "Daniel felt genuinely at a loss about what to say next. He had some unresolved things that he wanted to say out loud, but he doesn't know how to say them.";
    const messages = [
      {
        role: 'assistant' as const,
        content: scenarioCQ1,
        scenarioNumber: 3 as const,
      },
      { role: 'user' as const, content: answer, scenarioNumber: 3 as const },
    ];
    const deps = buildDeps({
      currentScenarioRef: { current: 3 },
      currentInterviewMomentRef: { current: 3 },
      messages,
      currentMessagesRef: { current: messages },
    });

    const result = await runPreClaudeClientOwnedCanonicalConstructGate(
      deps,
      answer,
      messages,
      scenarioCQ1,
      baseFlags({ shouldForceScenarioCSophiePerspectiveProbe: true, replyingToScenarioCQ1: true }),
    );

    expect(result.handled).toBe(true);
    expect(deps.scenarioCSophiePerspectiveProbeFiredRef.current).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining(SCENARIO_C_SOPHIE_PERSPECTIVE_PROBE),
      expect.anything(),
    );
    expect(deps.speakTextSafe).not.toHaveBeenCalledWith(
      'Can you say more about that?',
      expect.anything(),
    );
  });

  it('delivers canonical S1 repair without Claude after contempt answer', async () => {
    const messages = [
      {
        role: 'assistant' as const,
        content: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
        scenarioNumber: 1 as const,
      },
      {
        role: 'user' as const,
        content: "She feels subordinate to his mother.",
        scenarioNumber: 1 as const,
      },
    ];
    const deps = buildDeps({
      currentScenarioRef: { current: 1 },
      currentInterviewMomentRef: { current: 1 },
      messages,
      currentMessagesRef: { current: messages },
    });

    const result = await runPreClaudeClientOwnedCanonicalConstructGate(
      deps,
      messages[1].content,
      messages,
      messages[0].content,
      baseFlags({ allowScenarioARepairAfterContemptAnswer: true }),
    );

    expect(result.handled).toBe(true);
    expect(deps.scenarioARepairQuestionAskedRef.current).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
      expect.anything(),
    );
  });
});
