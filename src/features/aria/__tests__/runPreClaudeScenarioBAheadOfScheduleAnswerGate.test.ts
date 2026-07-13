import { runPreClaudeScenarioBAheadOfScheduleAnswerGate } from '@features/aria/runPreClaudeScenarioBAheadOfScheduleAnswerGate';
import {
  SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL,
  SCENARIO_B_JAMES_REPAIR_CANONICAL,
} from '@features/aria/scenarioBProbeLogic';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';

function buildDeps(overrides: Partial<PreClaudeTurnGateDeps> = {}): PreClaudeTurnGateDeps {
  return {
    currentScenarioRef: { current: 2 },
    currentInterviewMomentRef: { current: 2 },
    personalHandoffInjectedRef: { current: false },
    messages: [
      {
        role: 'assistant',
        content: 'What do you think is going on here between Sarah and James?',
        scenarioNumber: 2,
      },
    ],
    setMessages: jest.fn(),
    speakTextSafe: jest.fn().mockResolvedValue(undefined),
    setVoiceState: jest.fn(),
    interviewSessionIdRef: { current: 'session-1' },
    ...overrides,
  } as unknown as PreClaudeTurnGateDeps;
}

describe('runPreClaudeScenarioBAheadOfScheduleAnswerGate', () => {
  it('accepts repair-as-James on Q1 and asks mandatory Q2 instead of redirecting to Q1', async () => {
    const deps = buildDeps();
    const answer =
      'If I were James, I would apologize and reflect on my behavior and assure her that I will try to be better in the future.';

    const result = await runPreClaudeScenarioBAheadOfScheduleAnswerGate(deps, answer);

    expect(result.handled).toBe(true);
    expect(deps.setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'user', content: answer }),
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringContaining(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL),
        }),
      ]),
    );
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL),
      expect.anything(),
    );
  });

  it('accepts James-differently content on Q1 and asks repair Q3', async () => {
    const deps = buildDeps();
    const answer =
      'James could have pushed his deadline and met her right after she told him about the offer and celebrated with her instead of leading with salary questions.';

    const result = await runPreClaudeScenarioBAheadOfScheduleAnswerGate(deps, answer);

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining(SCENARIO_B_JAMES_REPAIR_CANONICAL),
      expect.anything(),
    );
  });

  it('does not intercept on-topic Q1 mentalizing answers', async () => {
    const deps = buildDeps();
    const answer =
      'Sarah needed James to celebrate her emotionally, not just ask logistics questions about the offer.';

    const result = await runPreClaudeScenarioBAheadOfScheduleAnswerGate(deps, answer);

    expect(result.handled).toBe(false);
    expect(deps.setMessages).not.toHaveBeenCalled();
  });

  it('accepts ahead-of-schedule repair after a model Q1 redirect', async () => {
    const deps = buildDeps({
      messages: [
        {
          role: 'assistant',
          content:
            "Got it — that's a good answer for where we're heading. First though, what do you think is actually going on between Sarah and James in this situation?",
          scenarioNumber: 2,
        },
      ],
    });
    const answer =
      'If I were James, I would apologize and reflect on my behavior and assure her that I will be better in the future.';

    const result = await runPreClaudeScenarioBAheadOfScheduleAnswerGate(deps, answer);

    expect(result.handled).toBe(true);
    expect(deps.speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining(SCENARIO_B_JAMES_DIFFERENTLY_CANONICAL),
      expect.anything(),
    );
  });
});
