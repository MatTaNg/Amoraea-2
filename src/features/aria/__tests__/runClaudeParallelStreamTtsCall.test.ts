import { runClaudeParallelStreamTtsCall } from '@features/aria/runClaudeParallelStreamTtsCall';
import type { ClaudeParallelStreamTtsCallDeps } from '@features/aria/claudeParallelStreamTtsCallTypes';

jest.mock('expo/fetch', () => ({
  fetch: (...args: unknown[]) =>
    (globalThis as { fetch: typeof fetch }).fetch(...(args as [RequestInfo, RequestInit?])),
}));

function createDeps(): ClaudeParallelStreamTtsCallDeps {
  return {
    parallelStreamingTtsRef: {
      current: { active: false, cancelRequested: false, accumulatedFullText: '', spokenCompleteText: '' },
    },
    ttsLineInFlightRef: { current: false },
    ttsSpeakGenerationRef: { current: 0 },
    ttsUtteranceInFlightRef: { current: null },
    ttsUtteranceInFlightOptionsRef: { current: null },
    userId: 'user-1',
    recordingJustFinishedBeforeNextTtsRef: { current: false },
    postRecordingParallelStreamSettleRef: { current: false },
    pendingScenarioAContemptProbeStreamMuteRef: { current: false },
    pendingS3ToM4HandoffStreamMuteRef: { current: false },
    scenarioAContemptProbeAskedRef: { current: false },
    scenarioAContemptProbePlaybackConfirmedRef: { current: false },
    scenarioAContemptProbeTtsDeliveredSessionRef: { current: false },
    scenarioARepairQuestionAskedRef: { current: false },
    showScenarioCardCanonicalPlaybackConfirmedKindsRef: { current: {} },
    currentScenarioRef: { current: 1 },
    currentInterviewMomentRef: { current: 1 },
    interviewMomentsCompleteRef: { current: {} },
    interviewSessionIdRef: { current: 'sess-1' },
    interviewSessionAttemptIdRef: { current: null },
    interviewNameRef: { current: 'Alex' },
    resumeActiveScenarioRef: { current: null },
    s2RepairProbeDeliveredRef: { current: false },
    s3RepairProbeDeliveredRef: { current: false },
    moment5PostPromptUserTurnCountRef: { current: 0 },
    moment5QuestionDeliveredRef: { current: false },
    moment5PrimaryAnchorDeliveredSessionRef: { current: false },
    moment5AccountabilityProbeFiredRef: { current: false },
    moment5ResolutionDeliveredRef: { current: false },
    scenarioScoresRef: { current: {} },
    lastQuestionTextRef: { current: '' },
    prepareInterviewTtsPlayback: jest.fn(async () => undefined),
    stopElevenLabsPlayback: jest.fn(async () => undefined),
    speakTextSafe: jest.fn(async () => undefined),
    setVoiceState: jest.fn(),
  } as unknown as ClaudeParallelStreamTtsCallDeps;
}

function baseParams(textToParallelStream = { full: '', spokenStarted: false, closingSpoken: false }) {
  return {
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
    shouldForceScenarioCSophiePerspectiveProbe: false,
    shouldForceMoment4ThresholdProbe: false,
    userScenarioTag: 1,
    hadPriorSubstantiveAnswerForFrustrationOffer: false,
    textToParallelStream,
  };
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

    await expect(runClaudeParallelStreamTtsCall(createDeps(), baseParams())).rejects.toMatchObject({
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

    await expect(runClaudeParallelStreamTtsCall(createDeps(), baseParams())).rejects.toMatchObject({
      message: 'Conversation must end with a user message.',
      status: 400,
    });
  });

  it('consumes buffered SSE when Response.body is null instead of throwing Invalid response stream', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      body: null,
      text: async () => 'data: [DONE]\n\n',
    })) as typeof fetch;

    await expect(runClaudeParallelStreamTtsCall(createDeps(), baseParams())).resolves.toEqual({
      content: [{ text: '' }],
    });
  });

  it('throws Invalid response stream only when body is null and response text is empty', async () => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      status: 200,
      body: null,
      text: async () => '',
    })) as typeof fetch;

    await expect(runClaudeParallelStreamTtsCall(createDeps(), baseParams())).rejects.toMatchObject({
      message: 'Invalid response stream',
      status: 200,
    });
  });
});
