import { useCallback } from 'react';

import { isNonRepeatableAssistantLineForVerbatimReplay } from '@features/aria/interviewDisengagementProbes';
import {
  SCENARIO_SPLIT_INTER_SEGMENT_GAP_MS,
  type InterviewTtsSpeakOpts,
  type InterviewTtsSpeakOutcome,
  type TrySplitFictionalScenarioIntro,
} from '@features/aria/interviewTtsSpeakOptions';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';
import { prepareInterviewTtsPlayback, setPlaybackMode } from '@features/aria/utils/audioModeHelpers';
import { fetchElevenLabsMpegArrayBuffer } from '@features/aria/utils/elevenLabsTtsFetch';
import { speakWithElevenLabs } from '@features/aria/utils/speakWithElevenLabsCore';
import { stopElevenLabsPlayback } from '@features/aria/utils/elevenLabsTtsPlaybackStop';
import type { PreInitTriggerDuring } from '@features/aria/utils/interviewMicPreInitTypes';
import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';
import { markQuestionDelivered } from '@utilities/sessionLogging';

export type UseInterviewTtsSpeakDeps = {
  awaitTtsScreenReadyGate: (reason: string) => Promise<void>;
  setVoiceState: (state: VoiceState) => void;
  userIdRef: React.MutableRefObject<string>;
  lastQuestionTextRef: React.MutableRefObject<string>;
  isSpeakingRef: React.MutableRefObject<boolean>;
  timingRef: React.MutableRefObject<{
    questionEndTime: number | null;
    recordingStartTime: number | null;
    recordingEndTime: number | null;
  }>;
  recordingJustFinishedBeforeNextTtsRef: React.MutableRefObject<boolean>;
  trySplitFictionalScenarioIntroLongDelivery: TrySplitFictionalScenarioIntro;
};

export function useInterviewTtsSpeak(deps: UseInterviewTtsSpeakDeps) {
  const {
    awaitTtsScreenReadyGate,
    setVoiceState,
    userIdRef: _userIdRef,
    lastQuestionTextRef,
    isSpeakingRef,
    timingRef,
    recordingJustFinishedBeforeNextTtsRef,
    trySplitFictionalScenarioIntroLongDelivery,
  } = deps;

  const speak = useCallback(
    async (text: string, speakOpts?: InterviewTtsSpeakOpts): Promise<InterviewTtsSpeakOutcome> => {
      await awaitTtsScreenReadyGate('speak');
      if (!speakOpts?.prefetchedMpegArrayBuffer?.byteLength) {
        await stopElevenLabsPlayback();
      }
      if (
        !speakOpts?.skipLastQuestionRef &&
        !isNonRepeatableAssistantLineForVerbatimReplay(text)
      ) {
        lastQuestionTextRef.current = text;
      }
      setVoiceState('processing');
      isSpeakingRef.current = true;
      const telemetrySource: TtsTelemetrySource = speakOpts?.telemetrySource ?? 'other';
      const preInitTriggerDuring: PreInitTriggerDuring =
        speakOpts?.preInitTriggerDuring ??
        (telemetrySource === 'greeting' ? 'greeting' : 'tts_playback');
      const split = trySplitFictionalScenarioIntroLongDelivery(text);
      const firePlaybackStarted = () => {
        setVoiceState('speaking');
        speakOpts?.onPlaybackStarted?.();
      };
      try {
        await setPlaybackMode();
        if (split) {
          const seg2PrefetchPromise = fetchElevenLabsMpegArrayBuffer(split.seg2).catch(() => null);
          await speakWithElevenLabs(split.seg1, undefined, {
            onPlaybackStarted: firePlaybackStarted,
            telemetry: { source: telemetrySource },
            skipStopElevenLabsPlaybackBeforeStart: true,
            chainHtmlAudioPlayback: true,
            preInitTriggerDuring,
            skipPcmStream: speakOpts?.skipPcmStream,
          });
          const prefetchedSeg2 = await seg2PrefetchPromise;
          if (!prefetchedSeg2 && SCENARIO_SPLIT_INTER_SEGMENT_GAP_MS > 0) {
            await new Promise<void>((r) => setTimeout(r, SCENARIO_SPLIT_INTER_SEGMENT_GAP_MS));
          }
          recordingJustFinishedBeforeNextTtsRef.current = false;
          await prepareInterviewTtsPlayback('speak:scenario_split_seg2', {
            afterRecording: false,
            parallelStreamContinuation: true,
          });
          await speakWithElevenLabs(split.seg2, undefined, {
            onPlaybackStarted: firePlaybackStarted,
            telemetry: { source: telemetrySource },
            skipStopElevenLabsPlaybackBeforeStart: true,
            skipWebPlaybackPriming: true,
            skipSilentWebPlaybackReprime: true,
            skipMicPreInitDuringPlayback: true,
            chainHtmlAudioPlayback: true,
            preInitTriggerDuring,
            skipPcmStream: speakOpts?.skipPcmStream,
            prefetchedMpegArrayBuffer: prefetchedSeg2 ?? undefined,
          });
          return {
            scenarioSplitDelivery: {
              segment1_expected_duration_ms: split.segment1_expected_duration_ms,
              segment2_expected_duration_ms: split.segment2_expected_duration_ms,
            },
          };
        }
        await speakWithElevenLabs(text, undefined, {
          onPlaybackStarted: firePlaybackStarted,
          telemetry: { source: telemetrySource },
          preInitTriggerDuring,
          skipPcmStream: speakOpts?.skipPcmStream,
          prefetchedMpegArrayBuffer: speakOpts?.prefetchedMpegArrayBuffer,
          skipMicPreInitDuringPlayback: speakOpts?.skipMicPreInitDuringPlayback,
          skipStopElevenLabsPlaybackBeforeStart: (speakOpts?.prefetchedMpegArrayBuffer?.byteLength ?? 0) > 0,
        });
      } finally {
        isSpeakingRef.current = false;
        if (!speakOpts?.skipQuestionTiming) {
          timingRef.current.questionEndTime = Date.now();
          markQuestionDelivered(new Date().toISOString());
        }
        setVoiceState('idle');
      }
    },
    [
      awaitTtsScreenReadyGate,
      isSpeakingRef,
      lastQuestionTextRef,
      recordingJustFinishedBeforeNextTtsRef,
      setVoiceState,
      timingRef,
      trySplitFictionalScenarioIntroLongDelivery,
    ],
  );

  return { speak };
}
