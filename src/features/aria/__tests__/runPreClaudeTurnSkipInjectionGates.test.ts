import { describe, expect, it, jest } from '@jest/globals';

import { SCENARIO_SKIP_CONFIRMATION_PROMPT_LINE } from '@features/aria/interviewPromptInstructions';
import {
  SKIP_CONFIRMATION_GREETING_REOPEN_LINE,
  SKIP_REQUEST_CONFIRMATION_PROMPT_LINE,
} from '@features/aria/metaCommentClassification';
import { runPreClaudeTurnSkipInjectionGates } from '@features/aria/runPreClaudeTurnSkipInjectionGates';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: jest.fn().mockReturnValue({ attemptId: 'attempt-test', platform: 'web' }),
  writeSessionLog: jest.fn(),
}));

jest.mock('@data/supabase/client', () => ({
  supabase: {
    from: jest.fn(() => ({
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  },
}));

const baseMessages = [
  { role: 'assistant', content: 'What is going on between these two?', scenarioNumber: 1 },
  { role: 'user', content: 'Can we skip this?', scenarioNumber: 1 },
];

function baseSkipArgs(overrides: Partial<Parameters<typeof runPreClaudeTurnSkipInjectionGates>[1]> = {}) {
  return {
    trimmed: 'Can we skip this?',
    messagesToUse: baseMessages,
    frustrationSkipDeclinePipeline: false,
    skipConfirmationGreetingReconnectInjection: false,
    inabilityInvitationClientInjection: false,
    inabilityEscalationSkipInjection: false,
    proactiveScenarioSkipConfirmationInjection: false,
    skipRequestMetaConfirmationInjection: false,
    frustrationSkipAcceptancePipeline: false,
    skipRequestConfirmationSpeech: '',
    ...overrides,
  };
}

describe('runPreClaudeTurnSkipInjectionGates', () => {
  it('returns haltTurn:false when no skip pipeline flags are set', async () => {
    const deps = createMockPreClaudeDeps();

    const result = await runPreClaudeTurnSkipInjectionGates(deps, baseSkipArgs());

    expect(result).toEqual({ haltTurn: false });
  });

  it('injects encouragement when user declines a frustration skip offer', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setMessages = jest.fn();
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 1 },
      frustrationSkipOfferPendingRef: { current: true },
      scenarioSkipOfferSourceRef: { current: 'inability_escalation' },
      speakTextSafe,
      setMessages,
    });

    const result = await runPreClaudeTurnSkipInjectionGates(
      deps,
      baseSkipArgs({ frustrationSkipDeclinePipeline: true }),
    );

    expect(result).toEqual({ haltTurn: true });
    expect(deps.frustrationSkipOfferPendingRef.current).toBe(false);
    expect(deps.scenarioSkipOfferSourceRef.current).toBeNull();
    expect(deps.inabilityCountByMomentRef.current[2]).toBe(0);
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringMatching(/stay on this one/i),
      expect.any(Object),
    );
    expect(setMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          role: 'assistant',
          content: expect.stringMatching(/stay on this one/i),
          scenarioNumber: 1,
        }),
      ]),
    );
  });

  it('reopens skip confirmation after a greeting during skip confirmation', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({ speakTextSafe });

    const result = await runPreClaudeTurnSkipInjectionGates(
      deps,
      baseSkipArgs({ skipConfirmationGreetingReconnectInjection: true }),
    );

    expect(result).toEqual({ haltTurn: true });
    expect(speakTextSafe).toHaveBeenCalledWith(
      SKIP_CONFIRMATION_GREETING_REOPEN_LINE,
      expect.objectContaining({ allowDuplicateConsecutiveTts: true }),
    );
  });

  it('injects inability invitation on first inability signal', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      speakTextSafe,
    });

    const result = await runPreClaudeTurnSkipInjectionGates(
      deps,
      baseSkipArgs({ inabilityInvitationClientInjection: true }),
    );

    expect(result).toEqual({ haltTurn: true });
    expect(deps.inabilityCountByMomentRef.current[1]).toBe(1);
    expect(speakTextSafe).toHaveBeenCalledWith(
      expect.stringMatching(/no pressure|no right answer/i),
      expect.objectContaining({ allowDuplicateConsecutiveTts: true }),
    );
  });

  it('escalates inability to skip confirmation prompt', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      speakTextSafe,
    });

    const result = await runPreClaudeTurnSkipInjectionGates(
      deps,
      baseSkipArgs({ inabilityEscalationSkipInjection: true }),
    );

    expect(result).toEqual({ haltTurn: true });
    expect(deps.scenarioSkipOfferSourceRef.current).toBe('inability_escalation');
    expect(deps.frustrationSkipOfferPendingRef.current).toBe(true);
    expect(deps.inabilityCountByMomentRef.current[2]).toBe(2);
    expect(speakTextSafe).toHaveBeenCalledWith(
      SKIP_REQUEST_CONFIRMATION_PROMPT_LINE,
      expect.objectContaining({ allowDuplicateConsecutiveTts: true }),
    );
  });

  it('prompts proactive scenario skip confirmation', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 1 },
      currentScenarioRef: { current: 1 },
      speakTextSafe,
    });

    const result = await runPreClaudeTurnSkipInjectionGates(
      deps,
      baseSkipArgs({ proactiveScenarioSkipConfirmationInjection: true }),
    );

    expect(result).toEqual({ haltTurn: true });
    expect(deps.scenarioSkipOfferSourceRef.current).toBe('proactive_utterance');
    expect(deps.frustrationSkipAwaitingConfirmationRef.current).toBe(true);
    expect(speakTextSafe).toHaveBeenCalledWith(
      SCENARIO_SKIP_CONFIRMATION_PROMPT_LINE,
      expect.objectContaining({ allowDuplicateConsecutiveTts: true }),
    );
  });

  it('prompts meta skip-request confirmation with custom speech', async () => {
    const customSpeech = 'Just to confirm — do you want to skip this question?';
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({ speakTextSafe });

    const result = await runPreClaudeTurnSkipInjectionGates(
      deps,
      baseSkipArgs({
        skipRequestMetaConfirmationInjection: true,
        skipRequestConfirmationSpeech: customSpeech,
      }),
    );

    expect(result).toEqual({ haltTurn: true });
    expect(deps.scenarioSkipOfferSourceRef.current).toBe('skip_request_meta');
    expect(speakTextSafe).toHaveBeenCalledWith(
      customSpeech,
      expect.objectContaining({ allowDuplicateConsecutiveTts: true }),
    );
  });

  it('accepts skip confirmation, keeps moment when scripted questions remain, and falls through to the model', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      currentScenarioRef: { current: 2 },
      scenarioSkipOfferSourceRef: { current: 'skip_request_meta' },
      frustrationSkipOfferPendingRef: { current: true },
      frustrationSkipAwaitingConfirmationRef: { current: true },
      scenarioSkipConfirmedCountRef: { current: 0 },
      scenarioSkipPenaltySumRef: { current: 0 },
      interviewSessionAttemptIdRef: { current: 'attempt-1' },
      speakTextSafe,
    });

    const result = await runPreClaudeTurnSkipInjectionGates(
      deps,
      baseSkipArgs({ frustrationSkipAcceptancePipeline: true }),
    );

    expect(result).toEqual({ haltTurn: false });
    expect(deps.frustrationSkipOfferPendingRef.current).toBe(false);
    expect(deps.currentInterviewMomentRef.current).toBe(2);
    expect(deps.interviewMomentsCompleteRef.current[2]).toBeFalsy();
    expect(deps.scenarioSkipConfirmedCountRef.current).toBe(1);
    expect(deps.skipContinuationSystemSuffixRef.current).toContain('NEXT QUESTION IN SAME SCENARIO');
    expect(speakTextSafe).not.toHaveBeenCalled();
  });
});
