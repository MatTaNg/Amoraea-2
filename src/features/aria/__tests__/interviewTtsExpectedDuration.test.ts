import {
  computeExpectedTtsWallClockMs,
  MAX_TTS_PLAYBACK_COMPLETION_ATTEMPTS,
} from '../interviewTtsExpectedDuration';
import { setInterviewTtsSessionEmail } from '../utils/interviewTtsDevAccount';

jest.mock('../utils/interviewTtsPlaybackRate', () => ({
  getLocalDevPlaybackRateMultiplier: jest.fn(() => 1),
}));

import { getLocalDevPlaybackRateMultiplier } from '../utils/interviewTtsPlaybackRate';

describe('interviewTtsExpectedDuration', () => {
  afterEach(() => {
    setInterviewTtsSessionEmail(null);
    jest.mocked(getLocalDevPlaybackRateMultiplier).mockReturnValue(1);
  });

  it('uses split segment durations when scenario split delivery is present', () => {
    const result = computeExpectedTtsWallClockMs(100, {
      scenarioSplitDelivery: {
        segment1_expected_duration_ms: 10_000,
        segment2_expected_duration_ms: 5_000,
      },
    });
    expect(result.calculationMethod).toBe('split_segments_plus_gap');
    expect(result.expectedMs).toBe(15_200);
  });

  it('exports playback retry attempt cap', () => {
    expect(MAX_TTS_PLAYBACK_COMPLETION_ATTEMPTS).toBe(3);
  });

  it('scales expected wall clock down for fast playback rate', () => {
    jest.mocked(getLocalDevPlaybackRateMultiplier).mockReturnValue(2);
    const result = computeExpectedTtsWallClockMs(71, null);
    expect(result.expectedMs).toBe(Math.round((71 * 85) / 2));
    expect(result.calculationMethod).toContain('divided_by_playback_rate_2');
  });
});
