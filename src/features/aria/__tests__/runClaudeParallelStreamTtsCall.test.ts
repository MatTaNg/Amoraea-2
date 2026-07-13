import { runClaudeParallelStreamTtsCall } from '@features/aria/runClaudeParallelStreamTtsCall';
import type { ClaudeParallelStreamTtsCallDeps } from '@features/aria/claudeParallelStreamTtsCallTypes';

function createDeps(): ClaudeParallelStreamTtsCallDeps {
  return {
    parallelStreamingTtsRef: { current: { active: false, cancelRequested: false, accumulatedFullText: '', spokenCompleteText: '' } },
    ttsLineInFlightRef: { current: false },
    userId: 'user-1',
    recordingJustFinishedBeforeNextTtsRef: { current: false },
    postRecordingParallelStreamSettleRef: { current: false },
    pendingScenarioAContemptProbeStreamMuteRef: { current: false },
    pendingS3ToM4HandoffStreamMuteRef: { current: false },
    prepareInterviewTtsPlayback: jest.fn(async () => undefined),
    stopElevenLabsPlayback: jest.fn(async () => undefined),
    setVoiceState: jest.fn(),
  } as unknown as ClaudeParallelStreamTtsCallDeps;
}

describe('runClaudeParallelStreamTtsCall', () => {
  it('throws HTTP errors instead of returning empty success', async () => {
    global.fetch = jest.fn(async () => ({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          error: { message: 'This model does not support assistant message prefill.' },
        }),
    })) as typeof fetch;

    await expect(
      runClaudeParallelStreamTtsCall(createDeps(), {
        apiUrl: 'https://example.test/v1/messages',
        headers: {},
        requestBody: { model: 'claude', messages: [] },
        participantFirstNameForSpoken: 'Alex',
        muteParallelTtsForScenarioAContemptProbeStream: false,
        muteParallelTtsForS3ToM4HandoffStream: false,
        metaFrustrationFirstSignalBuffered: false,
        bufferAllStreamTtsForMoment5Close: false,
        messagesToUse: [],
        trimmed: 'hello',
        elongatingSuppressedForUserTurn: false,
        specificEmmaLineAlreadyAddressed: false,
        shouldForceScenarioAContemptProbe: false,
        allowScenarioARepairAfterContemptAnswer: false,
        shouldForceScenarioBJamesRepairProbe: false,
        shouldForceScenarioCRepairProbe: false,
        shouldForceMoment4ThresholdProbe: false,
        userScenarioTag: 1,
        hadPriorSubstantiveAnswerForFrustrationOffer: false,
        textToParallelStream: { full: '', spokenStarted: false, closingSpoken: false },
      }),
    ).rejects.toMatchObject({
      message: 'This model does not support assistant message prefill.',
      status: 400,
    });
  });

  it('throws SSE error events from a 200 stream', async () => {
    const encoder = new TextEncoder();
    const body = {
      getReader: () => {
        let sent = false;
        return {
          read: async () => {
            if (sent) return { done: true, value: undefined };
            sent = true;
            return {
              done: false,
              value: encoder.encode(
                'data: {"type":"error","error":{"message":"Conversation must end with a user message."}}\n\n',
              ),
            };
          },
        };
      },
    };

    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      body,
    })) as typeof fetch;

    await expect(
      runClaudeParallelStreamTtsCall(createDeps(), {
        apiUrl: 'https://example.test/v1/messages',
        headers: {},
        requestBody: { model: 'claude', messages: [] },
        participantFirstNameForSpoken: 'Alex',
        muteParallelTtsForScenarioAContemptProbeStream: false,
        muteParallelTtsForS3ToM4HandoffStream: false,
        metaFrustrationFirstSignalBuffered: false,
        bufferAllStreamTtsForMoment5Close: false,
        messagesToUse: [],
        trimmed: 'hello',
        elongatingSuppressedForUserTurn: false,
        specificEmmaLineAlreadyAddressed: false,
        shouldForceScenarioAContemptProbe: false,
        allowScenarioARepairAfterContemptAnswer: false,
        shouldForceScenarioBJamesRepairProbe: false,
        shouldForceScenarioCRepairProbe: false,
        shouldForceMoment4ThresholdProbe: false,
        userScenarioTag: 1,
        hadPriorSubstantiveAnswerForFrustrationOffer: false,
        textToParallelStream: { full: '', spokenStarted: false, closingSpoken: false },
      }),
    ).rejects.toMatchObject({
      message: 'Conversation must end with a user message.',
      status: 400,
    });
  });
});
