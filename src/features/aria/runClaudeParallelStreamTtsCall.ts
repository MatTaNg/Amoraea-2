import {
  shouldAdvanceScenarioAAfterSatisfiedRepair,
  shouldAdvanceScenarioBAfterSatisfiedRepair,
} from '@features/aria/interviewRepairRefusalDetection';
import { scenarioBMinimumEngagementForHandoff } from '@features/aria/scenarioBProbeLogic';
import { scenarioAMinimumEngagementForHandoff } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { transcriptHasInterviewClosingSpokenFragment } from '@features/aria/elongatingProbe';
import { ensureSharedHtmlAudioElementForInterviewTts } from '@features/aria/utils/webInterviewSharedHtmlAudio';
import { setTtsPlaybackActive } from '@utilities/sessionLogging';
import { remoteLog } from '@utilities/remoteLog';
import { Platform } from 'react-native';

import type {
  ClaudeParallelStreamTtsCallDeps,
  ClaudeParallelStreamTtsCallParams,
  ClaudeParallelStreamTtsCallResult,
} from './claudeParallelStreamTtsCallTypes';
import { createParallelStreamEnqueueTtsUtterance } from './parallelStreamEnqueueTtsUtterance';
import { createParallelStreamMaybeQueueSentenceForTts } from './parallelStreamMaybeQueueSentenceForTts';
import { createParallelStreamProcessTextDelta } from './parallelStreamProcessTextDelta';
import { createParallelStreamSpeakScenarioAContemptProbe } from './parallelStreamScenarioAContemptProbeTts';
import { createParallelStreamSpeakShowScenarioCardOnce } from './parallelStreamShowScenarioCardTts';
import {
  createParallelStreamTtsRuntimeState,
  type ParallelStreamTtsPlaybackContext,
} from './parallelStreamTtsRuntimeState';
import { createParallelStreamTtsBatchController } from './parallelStreamTtsBatchController';
import {
  finalizeParallelStreamPlaybackSession,
  flushParallelStreamDeferredSentencesAtEnd,
  resetParallelStreamOnError,
} from './parallelStreamStreamEndTtsFlush';

type SseStreamEvent = {
  type?: string;
  delta?: { text?: string };
  text?: string;
  error?: { type?: string; message?: string };
};

function throwClaudeStreamError(message: string, status = 400): never {
  const err = new Error(message);
  (err as Error & { status?: number }).status = status;
  throw err;
}

function processSseChunk(
  sseBuffer: string,
  chunk: string,
  processTextDelta: (deltaText: string) => void,
): string {
  sseBuffer += chunk;
  const lines = sseBuffer.split('\n');
  sseBuffer = lines.pop() ?? '';
  for (const lineRaw of lines) {
    const line = lineRaw.trim();
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === '[DONE]') continue;
    let evt: SseStreamEvent | null = null;
    try {
      evt = JSON.parse(payload) as SseStreamEvent;
    } catch {
      evt = null;
    }
    if (evt?.type === 'error') {
      throwClaudeStreamError(evt.error?.message ?? 'Claude stream error');
    }
    const deltaText =
      evt?.type === 'content_block_delta'
        ? evt.delta?.text ?? ''
        : evt?.type === 'message_delta'
          ? evt.text ?? ''
          : '';
    processTextDelta(deltaText);
  }
  return sseBuffer;
}

export async function runClaudeParallelStreamTtsCall(
  deps: ClaudeParallelStreamTtsCallDeps,
  params: ClaudeParallelStreamTtsCallParams,
): Promise<ClaudeParallelStreamTtsCallResult> {
  const streamBody = { ...params.requestBody, stream: true };
  const res = await fetch(params.apiUrl, {
    method: 'POST',
    headers: params.headers,
    body: JSON.stringify(streamBody),
  });
  if (!res.ok) {
    const rawErr = await res.text();
    let parsedErr: { error?: { message?: string } } | null = null;
    try {
      parsedErr = JSON.parse(rawErr) as { error?: { message?: string } };
    } catch {
      parsedErr = null;
    }
    const e = new Error(parsedErr?.error?.message ?? `HTTP ${res.status}`);
    (e as Error & { status?: number }).status = res.status;
    throw e;
  }
  if (!res.body) {
    const e = new Error('Invalid response stream');
    (e as Error & { status?: number }).status = res.status;
    throw e;
  }

  deps.parallelStreamingTtsRef.current.active = true;
  if (deps.userId) {
    setTtsPlaybackActive(true);
  }
  if (Platform.OS === 'web') {
    ensureSharedHtmlAudioElementForInterviewTts();
  }

  const postRecordingSettleForThisParallelStream =
    deps.recordingJustFinishedBeforeNextTtsRef.current ||
    deps.postRecordingParallelStreamSettleRef.current;
  if (postRecordingSettleForThisParallelStream) {
    await deps.prepareInterviewTtsPlayback('parallel_stream_post_recording', { afterRecording: true });
  }

  /** Never mute an entire S1 stream for contempt once that probe was already delivered client-side. */
  const contemptAlreadyDelivered =
    deps.scenarioAContemptProbeAskedRef.current ||
    deps.scenarioARepairQuestionAskedRef.current;
  const streamContemptProbeMuteActive =
    !contemptAlreadyDelivered &&
    (deps.pendingScenarioAContemptProbeStreamMuteRef.current ||
      params.muteParallelTtsForScenarioAContemptProbeStream);
  const streamContemptProbeMuteArmedFromStart = streamContemptProbeMuteActive;
  deps.pendingScenarioAContemptProbeStreamMuteRef.current = false;

  const s3MuteArmedFromRef = deps.pendingS3ToM4HandoffStreamMuteRef.current;
  const streamS3ToM4HandoffMuteFromStart =
    s3MuteArmedFromRef || params.muteParallelTtsForS3ToM4HandoffStream;
  deps.pendingS3ToM4HandoffStreamMuteRef.current = false;
  if (streamS3ToM4HandoffMuteFromStart) {
    void remoteLog('[S3_TO_M4_HANDOFF_STREAM_MUTE_ARMED_FROM_START]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
    });
  }

  /**
   * Backup if a client-owned S2/S3 open gate was skipped: mute all vignette inventing from stream
   * start so fiction cannot speak before canonical card speak.
   */
  const playbackConfirmed = deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current ?? {};
  const scenarioOpenHandoffMuteFromStart =
    !streamS3ToM4HandoffMuteFromStart &&
    ((deps.currentScenarioRef.current === 1 &&
      deps.currentInterviewMomentRef.current === 1 &&
      !playbackConfirmed.situation_2 &&
      scenarioAMinimumEngagementForHandoff(params.messagesToUse) &&
      shouldAdvanceScenarioAAfterSatisfiedRepair(params.messagesToUse, '', 1)) ||
      (deps.currentScenarioRef.current === 2 &&
        deps.currentInterviewMomentRef.current === 2 &&
        !playbackConfirmed.situation_3 &&
        scenarioBMinimumEngagementForHandoff(params.messagesToUse) &&
        shouldAdvanceScenarioBAfterSatisfiedRepair(params.messagesToUse, '', 2)));
  if (scenarioOpenHandoffMuteFromStart) {
    void remoteLog('[SCENARIO_OPEN_HANDOFF_STREAM_MUTE_ARMED_FROM_START]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      scenario: deps.currentScenarioRef.current,
    });
  }

  const ctx: ParallelStreamTtsPlaybackContext = {
    deps,
    params,
    state: createParallelStreamTtsRuntimeState({
      streamContemptProbeMuteActive,
      moment5StickyCloseBufferAll: params.bufferAllStreamTtsForMoment5Close,
      streamShowScenarioCardMuteActive:
        streamS3ToM4HandoffMuteFromStart || scenarioOpenHandoffMuteFromStart,
    }),
    postRecordingSettleForThisParallelStream,
    closingAlreadyInTranscriptForStream: transcriptHasInterviewClosingSpokenFragment(params.messagesToUse),
    streamContemptProbeMuteArmedFromStart,
    streamS3ToM4HandoffMuteArmedFromStart: streamS3ToM4HandoffMuteFromStart,
  };

  const enqueueParallelTtsUtterance = createParallelStreamEnqueueTtsUtterance(ctx);
  const batch = createParallelStreamTtsBatchController(ctx, enqueueParallelTtsUtterance);
  const maybeQueueSentenceForTts = createParallelStreamMaybeQueueSentenceForTts(ctx, batch);
  const speakScenarioAContemptProbeStreamOnce = createParallelStreamSpeakScenarioAContemptProbe(ctx, batch);
  const speakShowScenarioCardStreamOnce = createParallelStreamSpeakShowScenarioCardOnce(ctx, batch);
  const processTextDelta = createParallelStreamProcessTextDelta(ctx, maybeQueueSentenceForTts);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let sseBuffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      const chunk = decoder.decode(value ?? new Uint8Array(), { stream: !done });
      sseBuffer = processSseChunk(sseBuffer, chunk, processTextDelta);
      if (done) break;
    }

    await flushParallelStreamDeferredSentencesAtEnd({
      ctx,
      batch,
      maybeQueueSentenceForTts,
      speakScenarioAContemptProbeStreamOnce,
      speakShowScenarioCardStreamOnce,
    });
    await finalizeParallelStreamPlaybackSession(ctx);
  } catch (err) {
    resetParallelStreamOnError(ctx);
    await deps.stopElevenLabsPlayback();
    throw err;
  }

  return { content: [{ text: params.textToParallelStream.full }] };
}
