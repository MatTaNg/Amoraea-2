import { describe, expect, it, jest } from '@jest/globals';

import { SCENARIO_1_VIGNETTE } from '@features/aria/interviewScenarioVignetteCopy';
import { runPreClaudePostCommitIntroGates } from '@features/aria/runPreClaudePostCommitIntroGates';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

jest.mock('@utilities/remoteLog', () => ({
  remoteLog: jest.fn(),
}));

const exitConfirmationCue =
  'Are you sure you want to stop? If you stop now it may affect your score.';

describe('runPreClaudePostCommitIntroGates', () => {
  it('returns handled:false outside moment 1 intro routing', async () => {
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      interviewNameRef: { current: 'Alex' },
    });

    const result = await runPreClaudePostCommitIntroGates(
      deps,
      'yes ready',
      [{ role: 'assistant', content: exitConfirmationCue, scenarioNumber: 1 }],
      'Alex',
    );

    expect(result).toEqual({ handled: false });
  });

  it('re-prompts readiness when the user declines to continue at exit confirmation', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const commitInterviewMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      interviewNameRef: { current: 'Alex' },
      lastQuestionTextRef: { current: exitConfirmationCue },
      speakTextSafe,
      commitInterviewMessages,
    });
    const messagesToUse = [
      { role: 'assistant', content: exitConfirmationCue, scenarioNumber: 1, interviewMoment: 1 },
      { role: 'user', content: 'not right now', scenarioNumber: 1, interviewMoment: 1 },
    ];

    const result = await runPreClaudePostCommitIntroGates(
      deps,
      "No, I want you to stay.",
      messagesToUse,
      'Alex',
    );

    expect(result).toEqual({ handled: true });
    expect(commitInterviewMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringMatching(/ready to start with the first situation/i),
        }),
      ]),
    );
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringMatching(/ready to start with the first situation/i),
      expect.any(Object),
    );
  });

  it('delivers Scenario 1 vignette when moment ref is stale at 2 before first vignette', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const commitInterviewMessages = jest.fn();
    const briefing =
      "Good to meet you, Matt. The way this works is I'll first give you three situations. Are you ready?";
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 1 },
      interviewNameRef: { current: null },
      lastQuestionTextRef: { current: briefing },
      speakTextSafe,
      commitInterviewMessages,
    });
    const messagesToUse = [
      { role: 'assistant', content: briefing, scenarioNumber: 1, interviewMoment: 2 },
      { role: 'user', content: 'Matt.', scenarioNumber: 1, interviewMoment: 2 },
      { role: 'user', content: 'Yes.', scenarioNumber: 1, interviewMoment: 2 },
    ];

    const result = await runPreClaudePostCommitIntroGates(deps, 'Yes.', messagesToUse, '');

    expect(result).toEqual({ handled: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining('Emma and Ryan'),
      expect.any(Object),
    );
    expect(deps.currentInterviewMomentRef.current).toBe(1);
  });

  it('delivers Scenario 1 vignette when the user affirms readiness without interviewNameRef', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const commitInterviewMessages = jest.fn();
    const briefing =
      "Good to meet you, Matt. The way this works is I'll first give you three situations. Are you ready?";
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      interviewNameRef: { current: null },
      lastQuestionTextRef: { current: briefing },
      speakTextSafe,
      commitInterviewMessages,
    });
    const messagesToUse = [
      { role: 'assistant', content: briefing, scenarioNumber: 1, interviewMoment: 1 },
      { role: 'user', content: 'Yes.', scenarioNumber: 1, interviewMoment: 1 },
    ];

    const result = await runPreClaudePostCommitIntroGates(deps, 'Yes.', messagesToUse, '');

    expect(result).toEqual({ handled: true });
    expect(commitInterviewMessages).toHaveBeenCalled();
    expect(deps.interviewNameRef.current).toBe('Matt');
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining('Emma and Ryan'),
      expect.any(Object),
    );
  });

  it('delivers Scenario 1 vignette when the user affirms readiness', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const commitInterviewMessages = jest.fn();
    const readinessPrompt = "Great, I'm here. Are you ready to start with the first situation?";
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      interviewNameRef: { current: 'Alex' },
      lastQuestionTextRef: { current: readinessPrompt },
      speakTextSafe,
      commitInterviewMessages,
    });
    const messagesToUse = [
      { role: 'assistant', content: readinessPrompt, scenarioNumber: 1, interviewMoment: 1 },
      { role: 'user', content: 'yes lets go', scenarioNumber: 1, interviewMoment: 1 },
    ];

    const result = await runPreClaudePostCommitIntroGates(
      deps,
      'yes I am ready',
      messagesToUse,
      'Alex',
    );

    expect(result).toEqual({ handled: true });
    expect(commitInterviewMessages).toHaveBeenCalled();
    const committed = commitInterviewMessages.mock.calls.at(-1)?.[0] as Array<{ content?: string }>;
    const vignetteMessage = committed.find((m) => (m.content ?? '').includes('Emma and Ryan'));
    expect(vignetteMessage?.content ?? '').toContain(SCENARIO_1_VIGNETTE.slice(0, 40));
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringContaining('Emma and Ryan'),
      expect.any(Object),
    );
  });
});
