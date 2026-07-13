import { getTtsExpectedDurationMsFromCharCount } from '@utilities/sessionLogging/ttsDurationCalibration';

import { getLocalDevPlaybackRateMultiplier } from '@features/aria/utils/interviewTtsPlaybackRate';
import { SCENARIO_SPLIT_INTER_SEGMENT_GAP_MS, type InterviewTtsSpeakOutcome } from './interviewTtsSpeakOptions';

export function computeExpectedTtsWallClockMs(
  charCount: number,
  speakOutcome: InterviewTtsSpeakOutcome | null,
): { expectedMs: number; calculationMethod: string } {
  let base: { expectedMs: number; calculationMethod: string };
  if (speakOutcome && 'scenarioSplitDelivery' in speakOutcome && speakOutcome.scenarioSplitDelivery) {
    const s = speakOutcome.scenarioSplitDelivery;
    base = {
      expectedMs:
        s.segment1_expected_duration_ms + s.segment2_expected_duration_ms + SCENARIO_SPLIT_INTER_SEGMENT_GAP_MS,
      calculationMethod: 'split_segments_plus_gap',
    };
  } else {
    base = getTtsExpectedDurationMsFromCharCount(charCount);
  }
  const playbackRate = getLocalDevPlaybackRateMultiplier();
  if (playbackRate <= 1) return base;
  return {
    expectedMs: Math.max(200, Math.round(base.expectedMs / playbackRate)),
    calculationMethod: `${base.calculationMethod}_divided_by_playback_rate_${playbackRate}`,
  };
}

export const MAX_TTS_PLAYBACK_COMPLETION_ATTEMPTS = 3;
export const TTS_PREMATURE_RATIO_STABILITY_EPSILON = 0.02;
export const TTS_REPLAY_PREMATURE_ACCEPT_MIN_RATIO = 0.65;
