import { describe, expect, it, jest } from '@jest/globals';

import { runPreClaudePostCommitGates } from '@features/aria/runPreClaudePostCommitGates';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

describe('runPreClaudePostCommitGates', () => {
  const baseMessages = [
    { role: 'assistant', content: 'What is going on between these two?', scenarioNumber: 1 },
    { role: 'user', content: 'They seemed tense.', scenarioNumber: 1 },
  ];

  it('returns handled:false when intro, post-closing, and skip gates do not fire', async () => {
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
    });

    const result = await runPreClaudePostCommitGates(
      deps,
      'They seemed tense.',
      baseMessages,
      'Alex',
      {
        frustrationSkipDeclinePipeline: false,
        skipConfirmationGreetingReconnectInjection: false,
        inabilityInvitationClientInjection: false,
        inabilityEscalationSkipInjection: false,
        proactiveScenarioSkipConfirmationInjection: false,
        skipRequestMetaConfirmationInjection: false,
        frustrationSkipAcceptancePipeline: false,
        skipRequestConfirmationSpeech: '',
      },
    );

    expect(result).toEqual({ handled: false });
  });

  it('returns handled:true when skip injection halts the turn', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = createMockPreClaudeDeps({
      currentInterviewMomentRef: { current: 2 },
      speakTextSafe,
    });

    const result = await runPreClaudePostCommitGates(
      deps,
      "I don't know",
      baseMessages,
      'Alex',
      {
        frustrationSkipDeclinePipeline: false,
        skipConfirmationGreetingReconnectInjection: false,
        inabilityInvitationClientInjection: true,
        inabilityEscalationSkipInjection: false,
        proactiveScenarioSkipConfirmationInjection: false,
        skipRequestMetaConfirmationInjection: false,
        frustrationSkipAcceptancePipeline: false,
        skipRequestConfirmationSpeech: '',
      },
    );

    expect(result).toEqual({ handled: true });
    expect(speakTextSafe).toHaveBeenCalled();
  });
});
