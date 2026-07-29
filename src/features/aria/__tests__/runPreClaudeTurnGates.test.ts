import { describe, expect, it, jest } from '@jest/globals';

import { runPreClaudeTurnGates } from '@features/aria/runPreClaudeTurnGates';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

jest.mock('@features/aria/runPreClaudeTurnOpeningPipeline', () => ({
  runPreClaudeTurnOpeningPipeline: jest.fn(),
}));

jest.mock('@features/aria/runPreClaudePreCommitGates', () => ({
  runPreClaudePreCommitGates: jest.fn(),
}));

jest.mock('@features/aria/commitPreClaudeUserTurn', () => ({
  commitPreClaudeUserTurn: jest.fn(),
}));

jest.mock('@features/aria/runPreClaudePostCommitGates', () => ({
  runPreClaudePostCommitGates: jest.fn(),
  runPreClaudePostCommitIntroGatesOnly: jest.fn(),
  runPreClaudePostCommitHandoffAndSkipGates: jest.fn(),
}));

jest.mock('@features/aria/runPreClaudeLateInterceptGates', () => ({
  runPreClaudeLateInterceptGates: jest.fn(),
}));

jest.mock('@features/aria/assertPreClaudeAnthropicConfigured', () => ({
  assertPreClaudeAnthropicConfigured: jest.fn(),
}));

jest.mock('@features/aria/buildPreClaudeTurnApiParams', () => ({
  buildPreClaudeTurnApiParams: jest.fn(),
}));

import { assertPreClaudeAnthropicConfigured } from '@features/aria/assertPreClaudeAnthropicConfigured';
import { buildPreClaudeTurnApiParams } from '@features/aria/buildPreClaudeTurnApiParams';
import { commitPreClaudeUserTurn } from '@features/aria/commitPreClaudeUserTurn';
import { runPreClaudeLateInterceptGates } from '@features/aria/runPreClaudeLateInterceptGates';
import { runPreClaudePostCommitHandoffAndSkipGates, runPreClaudePostCommitIntroGatesOnly } from '@features/aria/runPreClaudePostCommitGates';
import { runPreClaudePreCommitGates } from '@features/aria/runPreClaudePreCommitGates';
import { runPreClaudeTurnOpeningPipeline } from '@features/aria/runPreClaudeTurnOpeningPipeline';

const baseParams = {
  trimmed: 'They were dismissive about my feelings.',
  spokenText: 'They were dismissive about my feelings.',
  resumeGatePendingEarly: false,
} as Parameters<typeof runPreClaudeTurnGates>[1];

const baseSkipMeta = {
  frustrationSkipAcceptancePipeline: false,
  frustrationSkipDeclinePipeline: false,
  proactiveScenarioSkipConfirmationInjection: false,
  skipRequestMetaConfirmationInjection: false,
  skipConfirmationGreetingReconnectInjection: false,
  inabilityInvitationClientInjection: false,
  inabilityEscalationSkipInjection: false,
  skipRequestConfirmationSpeech: '',
  metaCommentClassification: null,
  repeatedFrustrationInMoment: false,
  alreadyAnsweredPriorSubstantiveVerified: undefined,
  checkingInFrustrationAdjacent: false,
  suppressForcedConstructProbesForMetaFrustration: false,
};

describe('runPreClaudeTurnGates', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns false when the opening pipeline halts', async () => {
    jest.mocked(runPreClaudeTurnOpeningPipeline).mockResolvedValue({ continue: false });

    const result = await runPreClaudeTurnGates(createMockPreClaudeDeps(), baseParams);

    expect(result).toBe(false);
    expect(runPreClaudePreCommitGates).not.toHaveBeenCalled();
  });

  it('returns false when pre-commit gates handle the turn', async () => {
    jest.mocked(runPreClaudeTurnOpeningPipeline).mockResolvedValue({
      continue: true,
      participantFirstNameForSpoken: 'Alex',
      skipMeta: baseSkipMeta,
    });
    jest.mocked(runPreClaudePreCommitGates).mockResolvedValue({
      handled: true,
      participantFirstNameForSpoken: 'Alex',
      isNameEntryTurn: true,
    });

    const result = await runPreClaudeTurnGates(createMockPreClaudeDeps(), baseParams);

    expect(result).toBe(false);
    expect(commitPreClaudeUserTurn).not.toHaveBeenCalled();
  });

  it('returns false when post-commit handoff gates handle the turn before Claude', async () => {
    jest.mocked(runPreClaudeTurnOpeningPipeline).mockResolvedValue({
      continue: true,
      participantFirstNameForSpoken: 'Alex',
      skipMeta: baseSkipMeta,
    });
    jest.mocked(runPreClaudePreCommitGates).mockResolvedValue({
      handled: false,
      participantFirstNameForSpoken: 'Alex',
      isNameEntryTurn: false,
    });
    jest.mocked(commitPreClaudeUserTurn).mockResolvedValue({
      messagesToUse: [{ role: 'user', content: baseParams.trimmed, scenarioNumber: 1 }],
      userScenarioTag: 1,
    });
    jest.mocked(runPreClaudePostCommitIntroGatesOnly).mockResolvedValue({ handled: false });
    jest.mocked(runPreClaudeLateInterceptGates).mockResolvedValue({
      handled: false,
      isPersonalOpening: false,
      lastAssistantContent: 'What is going on between these two?',
      lastInterviewerContent: 'What is going on between these two?',
      shouldForceMoment4ThresholdProbe: false,
      moment4ThresholdHintInAnswer: false,
      moment5CombinedUserText: baseParams.trimmed,
      constructProbeFlags: {},
    });
    jest.mocked(runPreClaudePostCommitHandoffAndSkipGates).mockResolvedValue({ handled: true });

    const result = await runPreClaudeTurnGates(createMockPreClaudeDeps(), baseParams);

    expect(result).toBe(false);
    expect(buildPreClaudeTurnApiParams).not.toHaveBeenCalled();
  });

  it('returns false when post-commit intro gates handle the turn', async () => {
    jest.mocked(runPreClaudeTurnOpeningPipeline).mockResolvedValue({
      continue: true,
      participantFirstNameForSpoken: 'Alex',
      skipMeta: baseSkipMeta,
    });
    jest.mocked(runPreClaudePreCommitGates).mockResolvedValue({
      handled: false,
      participantFirstNameForSpoken: 'Alex',
      isNameEntryTurn: false,
    });
    jest.mocked(commitPreClaudeUserTurn).mockResolvedValue({
      messagesToUse: [{ role: 'user', content: baseParams.trimmed, scenarioNumber: 1 }],
      userScenarioTag: 1,
    });
    jest.mocked(runPreClaudePostCommitIntroGatesOnly).mockResolvedValue({ handled: true });

    const result = await runPreClaudeTurnGates(createMockPreClaudeDeps(), baseParams);

    expect(result).toBe(false);
    expect(runPreClaudeLateInterceptGates).not.toHaveBeenCalled();
  });

  it('runs late intercept before post-commit handoff gates', async () => {
    jest.mocked(runPreClaudeTurnOpeningPipeline).mockResolvedValue({
      continue: true,
      participantFirstNameForSpoken: 'Alex',
      skipMeta: baseSkipMeta,
    });
    jest.mocked(runPreClaudePreCommitGates).mockResolvedValue({
      handled: false,
      participantFirstNameForSpoken: 'Alex',
      isNameEntryTurn: false,
    });
    jest.mocked(commitPreClaudeUserTurn).mockResolvedValue({
      messagesToUse: [{ role: 'user', content: baseParams.trimmed, scenarioNumber: 1 }],
      userScenarioTag: 1,
    });
    jest.mocked(runPreClaudePostCommitIntroGatesOnly).mockResolvedValue({ handled: false });
    jest.mocked(runPreClaudeLateInterceptGates).mockResolvedValue({ handled: true });
    jest.mocked(runPreClaudePostCommitHandoffAndSkipGates).mockResolvedValue({ handled: false });

    const result = await runPreClaudeTurnGates(createMockPreClaudeDeps(), baseParams);

    expect(result).toBe(false);
    expect(runPreClaudeLateInterceptGates).toHaveBeenCalled();
    expect(runPreClaudePostCommitHandoffAndSkipGates).not.toHaveBeenCalled();
  });

  it('returns false when late intercept gates handle the turn', async () => {
    jest.mocked(runPreClaudeTurnOpeningPipeline).mockResolvedValue({
      continue: true,
      participantFirstNameForSpoken: 'Alex',
      skipMeta: baseSkipMeta,
    });
    jest.mocked(runPreClaudePreCommitGates).mockResolvedValue({
      handled: false,
      participantFirstNameForSpoken: 'Alex',
      isNameEntryTurn: false,
    });
    jest.mocked(commitPreClaudeUserTurn).mockResolvedValue({
      messagesToUse: [{ role: 'user', content: baseParams.trimmed, scenarioNumber: 1 }],
      userScenarioTag: 1,
    });
    jest.mocked(runPreClaudePostCommitIntroGatesOnly).mockResolvedValue({ handled: false });
    jest.mocked(runPreClaudeLateInterceptGates).mockResolvedValue({
      handled: true,
      isPersonalOpening: false,
      lastAssistantContent: 'What is going on between these two?',
      lastInterviewerContent: 'What is going on between these two?',
      shouldForceMoment4ThresholdProbe: false,
      moment4ThresholdHintInAnswer: false,
      moment5CombinedUserText: baseParams.trimmed,
      constructProbeFlags: {},
    });
    jest.mocked(runPreClaudePostCommitHandoffAndSkipGates).mockResolvedValue({ handled: false });

    const result = await runPreClaudeTurnGates(createMockPreClaudeDeps(), baseParams);

    expect(result).toBe(false);
    expect(buildPreClaudeTurnApiParams).not.toHaveBeenCalled();
  });

  it('returns false when Anthropic is not configured', async () => {
    jest.mocked(runPreClaudeTurnOpeningPipeline).mockResolvedValue({
      continue: true,
      participantFirstNameForSpoken: 'Alex',
      skipMeta: baseSkipMeta,
    });
    jest.mocked(runPreClaudePreCommitGates).mockResolvedValue({
      handled: false,
      participantFirstNameForSpoken: 'Alex',
      isNameEntryTurn: false,
    });
    jest.mocked(commitPreClaudeUserTurn).mockResolvedValue({
      messagesToUse: [{ role: 'user', content: baseParams.trimmed, scenarioNumber: 1 }],
      userScenarioTag: 1,
    });
    jest.mocked(runPreClaudePostCommitIntroGatesOnly).mockResolvedValue({ handled: false });
    jest.mocked(runPreClaudeLateInterceptGates).mockResolvedValue({
      handled: false,
      isPersonalOpening: false,
      lastAssistantContent: 'What is going on between these two?',
      lastInterviewerContent: 'What is going on between these two?',
      shouldForceMoment4ThresholdProbe: false,
      moment4ThresholdHintInAnswer: false,
      moment5CombinedUserText: baseParams.trimmed,
      constructProbeFlags: {},
    });
    jest.mocked(runPreClaudePostCommitHandoffAndSkipGates).mockResolvedValue({ handled: false });
    jest.mocked(assertPreClaudeAnthropicConfigured).mockReturnValue(false);

    const result = await runPreClaudeTurnGates(createMockPreClaudeDeps(), baseParams);

    expect(result).toBe(false);
    expect(buildPreClaudeTurnApiParams).not.toHaveBeenCalled();
  });

  it('builds API params and returns true on the happy path', async () => {
    jest.mocked(runPreClaudeTurnOpeningPipeline).mockResolvedValue({
      continue: true,
      participantFirstNameForSpoken: 'Alex',
      skipMeta: baseSkipMeta,
    });
    jest.mocked(runPreClaudePreCommitGates).mockResolvedValue({
      handled: false,
      participantFirstNameForSpoken: 'Alex',
      isNameEntryTurn: false,
    });
    jest.mocked(commitPreClaudeUserTurn).mockResolvedValue({
      messagesToUse: [{ role: 'user', content: baseParams.trimmed, scenarioNumber: 1 }],
      userScenarioTag: 1,
    });
    jest.mocked(runPreClaudePostCommitIntroGatesOnly).mockResolvedValue({ handled: false });
    jest.mocked(runPreClaudeLateInterceptGates).mockResolvedValue({
      handled: false,
      isPersonalOpening: false,
      lastAssistantContent: 'What is going on between these two?',
      lastInterviewerContent: 'What is going on between these two?',
      shouldForceMoment4ThresholdProbe: false,
      moment4ThresholdHintInAnswer: false,
      moment5CombinedUserText: baseParams.trimmed,
      constructProbeFlags: { shouldForceScenarioAContemptProbe: false },
    });
    jest.mocked(runPreClaudePostCommitHandoffAndSkipGates).mockResolvedValue({ handled: false });
    jest.mocked(assertPreClaudeAnthropicConfigured).mockReturnValue(true);

    const deps = createMockPreClaudeDeps();
    const result = await runPreClaudeTurnGates(deps, baseParams);

    expect(result).toBe(true);
    expect(buildPreClaudeTurnApiParams).toHaveBeenCalledWith(
      deps,
      baseParams,
      expect.objectContaining({
        messagesToUse: expect.any(Array),
        userScenarioTag: 1,
        participantFirstNameForSpoken: 'Alex',
        isNameEntryTurn: false,
      }),
    );
  });
});
