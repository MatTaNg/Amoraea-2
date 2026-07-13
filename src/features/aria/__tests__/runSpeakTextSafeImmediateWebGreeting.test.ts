import { describe, expect, it, jest } from '@jest/globals';

import {
  markSpeakTextSafeSuccessfulDelivery,
  resolveImmediateWebGreetingTtsTriggerSource,
} from '@features/aria/runSpeakTextSafeImmediateWebGreeting';
import { normalizeTtsTextForConsecutiveDedup } from '@features/aria/interviewControlTokens';

jest.mock('@features/aria/utils/webPreAuthorizedTtsAudio', () => ({
  isPreAuthorizedAudioPendingForNextTts: jest.fn(() => false),
}));

import { isPreAuthorizedAudioPendingForNextTts } from '@features/aria/utils/webPreAuthorizedTtsAudio';

describe('resolveImmediateWebGreetingTtsTriggerSource', () => {
  it('uses preauthorized_element when preauthorized audio is pending', () => {
    jest.mocked(isPreAuthorizedAudioPendingForNextTts).mockReturnValue(true);
    expect(resolveImmediateWebGreetingTtsTriggerSource('callback')).toBe('preauthorized_element');
  });

  it('keeps the caller trigger when preauthorized audio is not pending', () => {
    jest.mocked(isPreAuthorizedAudioPendingForNextTts).mockReturnValue(false);
    expect(resolveImmediateWebGreetingTtsTriggerSource('gesture_handler')).toBe('gesture_handler');
  });
});

describe('markSpeakTextSafeSuccessfulDelivery', () => {
  it('records normalized dedup state and contempt probe session flags', () => {
    const text = "What do you make of Emma saying you've made that very clear?";
    const lastSuccessfulTtsTextNormalizedRef = { current: null as string | null };
    const lastSuccessfulTtsDeliveredPreviewRef = { current: '' };
    const scenarioAContemptProbeTtsDeliveredSessionRef = { current: false };
    const scenarioAContemptProbePlaybackConfirmedRef = { current: false };

    markSpeakTextSafeSuccessfulDelivery({
      text,
      silent: false,
      lastSuccessfulTtsTextNormalizedRef,
      lastSuccessfulTtsDeliveredPreviewRef,
      scenarioAContemptProbeTtsDeliveredSessionRef,
      scenarioAContemptProbePlaybackConfirmedRef,
    });

    expect(lastSuccessfulTtsTextNormalizedRef.current).toBe(
      normalizeTtsTextForConsecutiveDedup(text),
    );
    expect(lastSuccessfulTtsDeliveredPreviewRef.current.length).toBeGreaterThan(10);
    expect(scenarioAContemptProbeTtsDeliveredSessionRef.current).toBe(true);
    expect(scenarioAContemptProbePlaybackConfirmedRef.current).toBe(true);
  });

  it('no-ops when silent', () => {
    const lastSuccessfulTtsTextNormalizedRef = { current: 'prior' };
    markSpeakTextSafeSuccessfulDelivery({
      text: 'hello',
      silent: true,
      lastSuccessfulTtsTextNormalizedRef,
      lastSuccessfulTtsDeliveredPreviewRef: { current: '' },
      scenarioAContemptProbeTtsDeliveredSessionRef: { current: false },
      scenarioAContemptProbePlaybackConfirmedRef: { current: false },
    });
    expect(lastSuccessfulTtsTextNormalizedRef.current).toBe('prior');
  });
});
