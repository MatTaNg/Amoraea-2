import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import { runPreClaudeResumeRepeatGate } from '@features/aria/runPreClaudeResumeRepeatGate';
import { createMockPreClaudeDeps } from './preClaudeGateTestHelpers';

jest.mock('@utilities/sessionLogging', () => ({
  getSessionLogRuntime: jest.fn(() => ({
    attemptId: 'attempt-test',
    platform: 'web',
    lastQuestionDeliveredAt: null,
  })),
  writeSessionLog: jest.fn(),
}));

jest.mock('@features/aria/utils/elevenLabsTtsFetch', () => ({
  fetchElevenLabsMpegArrayBuffer: jest.fn().mockResolvedValue(null),
}));

const REPEAT_REQUEST_META: MetaCommentClassification = {
  type: 'confusion',
  confidence: 1.0,
  confusion_subtype: 'repeat_request',
};

const LAST_QUESTION = 'What is going on between James and Emma in this scene?';

function resumeDeps(overrides: Parameters<typeof createMockPreClaudeDeps>[0] = {}) {
  return createMockPreClaudeDeps({
    resumeRepeatChoicePendingRef: { current: true },
    resumeLastAssistantTextRef: { current: LAST_QUESTION },
    lastQuestionTextRef: { current: LAST_QUESTION },
    messages: [{ role: 'assistant', content: LAST_QUESTION }],
    ...overrides,
  });
}

function gateArgs(
  overrides: Partial<Parameters<typeof runPreClaudeResumeRepeatGate>[1]> = {},
) {
  return {
    trimmed: 'repeat',
    spokenText: 'repeat',
    routeChangedDuringRecordingSnap: false,
    metaCommentClassification: null,
    proactiveScenarioSkipConfirmationInjection: false,
    skipRequestMetaConfirmationInjection: false,
    ...overrides,
  };
}

describe('runPreClaudeResumeRepeatGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns haltTurn:false when resume choice is not pending', async () => {
    const deps = createMockPreClaudeDeps({
      resumeRepeatChoicePendingRef: { current: false },
    });

    const result = await runPreClaudeResumeRepeatGate(deps, gateArgs());

    expect(result).toEqual({ haltTurn: false, reentryTypeForLogging: null });
  });

  it('defers repeat requests to the meta verbatim replay handler', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = resumeDeps({ speakTextSafe });

    const result = await runPreClaudeResumeRepeatGate(
      deps,
      gateArgs({
        trimmed: 'Can you repeat the question?',
        spokenText: 'Can you repeat the question?',
        metaCommentClassification: REPEAT_REQUEST_META,
      }),
    );

    expect(result).toEqual({ haltTurn: false, reentryTypeForLogging: 'repeat_requested' });
    expect(deps.resumeRepeatChoicePendingRef.current).toBe(false);
    expect(deps.resumeLastAssistantTextRef.current).toBe(LAST_QUESTION);
    expect(speakTextSafe).not.toHaveBeenCalled();
  });

  it('replays the last question when user asks to repeat', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setVoiceState = jest.fn();
    const deps = resumeDeps({ speakTextSafe, setVoiceState });

    const result = await runPreClaudeResumeRepeatGate(
      deps,
      gateArgs({ trimmed: 'recap please', spokenText: 'recap please' }),
    );

    expect(result).toEqual({ haltTurn: true, reentryTypeForLogging: 'repeat_requested' });
    expect(speakTextSafe).toHaveBeenCalledWith(
      `Sure. ${LAST_QUESTION}`,
      expect.objectContaining({
        skipQuestionDeliveredTelemetry: true,
        skipInterviewSpeechAdvance: true,
        allowDuplicateConsecutiveTts: true,
      }),
    );
    expect(setVoiceState).toHaveBeenCalledWith('idle');
  });

  it('halts without replay when user chooses to continue', async () => {
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const setVoiceState = jest.fn();
    const deps = resumeDeps({ speakTextSafe, setVoiceState });

    const result = await runPreClaudeResumeRepeatGate(
      deps,
      gateArgs({ trimmed: 'yes', spokenText: 'yes' }),
    );

    expect(result).toEqual({ haltTurn: true, reentryTypeForLogging: 'continue_requested' });
    expect(speakTextSafe).not.toHaveBeenCalled();
    expect(setVoiceState).toHaveBeenCalledWith('idle');
  });

  it('treats long answers as direct answers instead of resume cues', async () => {
    const longAnswer =
      'I think James was frustrated because Emma dismissed his feelings during dinner and he shut down instead of explaining what he needed from her in that moment.';
    const speakTextSafe = jest.fn().mockResolvedValue(undefined);
    const deps = resumeDeps({ speakTextSafe });

    const result = await runPreClaudeResumeRepeatGate(
      deps,
      gateArgs({ trimmed: longAnswer, spokenText: longAnswer }),
    );

    expect(result).toEqual({ haltTurn: false, reentryTypeForLogging: 'direct_answer' });
    expect(speakTextSafe).not.toHaveBeenCalled();
    expect(deps.resumeLastAssistantTextRef.current).toBeNull();
  });
});
