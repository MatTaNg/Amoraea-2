import type { MutableRefObject } from 'react';

import { buildInterviewResponseTimingEntry } from '@features/aria/buildInterviewResponseTimingEntry';
import {
  countSpokenWords,
  isSimpleYesNoInterviewMoment,
} from '@features/aria/interviewLanguageGate';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { supabase } from '@data/supabase/client';
import {
  persistResponseTimingsToAttempt,
  type InterviewResponseTimingEntry,
} from '@utilities/persistResponseTimingsIncremental';
import {
  markLastAudioSessionEventType,
  writeAudioSessionLog,
} from '@utilities/sessionLogging/audioSessionLogEnvelope';
import { getSessionLogRuntime, logTouchActivityForPause, touchActivity, writeSessionLog } from '@utilities/sessionLogging';

export type LogPreClaudeTurnSessionTelemetryInput = {
  trimmed: string;
  participantFirstNameForSpoken: string;
  reentryTypeForLogging: 'repeat_requested' | 'continue_requested' | 'direct_answer' | null;
  routeChangedDuringRecordingSnap: boolean;
  metaClassSnapshotPrePipeline: MetaCommentClassification | null | undefined;
};

/** Name-source debug, response_received, short-response audio, and response timing telemetry. */
export function logPreClaudeTurnSessionTelemetry(
  deps: PreClaudeTurnGateDeps,
  input: LogPreClaudeTurnSessionTelemetryInput,
): void {
  const {
    trimmed,
    participantFirstNameForSpoken,
    reentryTypeForLogging,
    routeChangedDuringRecordingSnap,
    metaClassSnapshotPrePipeline,
  } = input;

  if (deps.userId) {
    const rtd = getSessionLogRuntime();
    writeSessionLog({
      userId: deps.userId,
      attemptId: rtd.attemptId,
      eventType: 'name_source_debug',
      eventData: {
        stage: 'process_user_speech',
        resume_gate_pending: deps.resumeRepeatChoicePendingRef.current,
        profile_has_basic_info_first_name: false,
        profile_has_name: false,
        participant_first_name_present: !!participantFirstNameForSpoken,
        participant_first_name_length: participantFirstNameForSpoken.length,
      },
      platform: rtd.platform,
    });
  }
}

export function logPreClaudeTurnResponseTelemetry(
  deps: PreClaudeTurnGateDeps,
  input: LogPreClaudeTurnSessionTelemetryInput,
): void {
  const {
    trimmed,
    reentryTypeForLogging,
    routeChangedDuringRecordingSnap,
    metaClassSnapshotPrePipeline,
  } = input;

  if (!deps.userId) {
    return;
  }

  logTouchActivityForPause(
    {
      userId: deps.userId,
      attemptId: getSessionLogRuntime().attemptId,
      platform: getSessionLogRuntime().platform,
    },
    deps.currentInterviewMomentRef.current,
  );
  touchActivity();
  const r = getSessionLogRuntime();
  const deliveredAt = r.lastQuestionDeliveredAt;
  let latencyMs: number | null = null;
  if (deliveredAt) {
    const t = Date.parse(deliveredAt);
    if (!Number.isNaN(t)) latencyMs = Math.max(0, Date.now() - t);
  }
  writeSessionLog({
    userId: deps.userId,
    attemptId: r.attemptId,
    eventType: 'response_received',
    eventData: {
      moment_number: deps.currentInterviewMomentRef.current,
      word_count: countSpokenWords(trimmed),
      response_latency_ms: latencyMs,
      detected_language: deps.lastVoiceTurnLanguageRef.current,
      transcription_confidence: deps.lastVoiceTurnConfidenceRef.current,
      reentry_type: reentryTypeForLogging,
      route_changed_during_recording: routeChangedDuringRecordingSnap,
    },
    platform: r.platform,
  });
  const wcAll = countSpokenWords(trimmed);
  if (
    wcAll < 10 &&
    !isSimpleYesNoInterviewMoment(deps.lastQuestionTextRef.current) &&
    metaClassSnapshotPrePipeline == null
  ) {
    markLastAudioSessionEventType('short_response_detected');
    writeAudioSessionLog({
      userId: deps.userId,
      attemptId: r.attemptId,
      eventType: 'short_response_detected',
      eventData: {
        word_count: wcAll,
        transcript_text: trimmed.slice(0, 2000),
        moment_number: deps.currentInterviewMomentRef.current,
        is_repeat_turn: false,
      },
      platform: r.platform,
    });
  }
}

export function logPreClaudeTurnResponseTiming(
  deps: PreClaudeTurnGateDeps,
  trimmed: string,
): void {
  if (!deps.isInterviewAppRoute || deps.isAdmin || !deps.userId) {
    return;
  }

  try {
    const timingEntry = buildInterviewResponseTimingEntry(deps, trimmed);
    if (!timingEntry) return;

    const ref = deps.responseTimingsRef as MutableRefObject<InterviewResponseTimingEntry[]>;
    ref.current.push(timingEntry);

    const attemptId = deps.interviewSessionAttemptIdRef.current;
    if (attemptId) {
      void persistResponseTimingsToAttempt(supabase, attemptId, deps.userId, ref.current);
    }
  } catch (err) {
    console.error(
      `[Amoraea] response timing capture failed for attempt ${deps.interviewSessionAttemptIdRef.current ?? 'pending'}:`,
      err,
    );
  }
}
