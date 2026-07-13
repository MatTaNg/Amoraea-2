import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('@features/aria/interviewClosingTtsSession', () => ({
  markInterviewClosingTtsDelivered: jest.fn(),
}));

jest.mock('@features/aria/runSpeakTextSafeImmediateWebGreeting', () => ({
  markSpeakTextSafeSuccessfulDelivery: jest.fn(),
}));

import { markInterviewClosingTtsDelivered } from '@features/aria/interviewClosingTtsSession';
import { SCENARIO_1_OPENING } from '@features/aria/interviewScenarioOpeningStreamGate';
import { SCENARIO_1_VIGNETTE } from '@features/aria/interviewScenarioVignetteCopy';
import { applySpeakTextSafePostPlaybackSuccess } from '@features/aria/applySpeakTextSafePostPlaybackSuccess';
import { markSpeakTextSafeSuccessfulDelivery } from '@features/aria/runSpeakTextSafeImmediateWebGreeting';

describe('applySpeakTextSafePostPlaybackSuccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('advances interview speech and records successful delivery', () => {
    const applyInterviewSpeechComplete = jest.fn();
    const refs = {
      lastSuccessfulTtsTextNormalizedRef: { current: null as string | null },
      lastSuccessfulTtsDeliveredPreviewRef: { current: '' },
      scenarioAContemptProbeTtsDeliveredSessionRef: { current: false },
      scenarioAContemptProbePlaybackConfirmedRef: { current: false },
      showScenarioCardCanonicalPlaybackConfirmedKindsRef: { current: {} },
    };

    applySpeakTextSafePostPlaybackSuccess({
      text: 'What is going on between these two?',
      silent: false,
      skipDeliveryForTabInterrupt: false,
      interviewSpeechRole: 'assistant_response',
      skipInterviewSpeechAdvance: false,
      applyInterviewSpeechComplete,
      ...refs,
      closingTtsSessionKey: 'session-test',
    });

    expect(applyInterviewSpeechComplete).toHaveBeenCalledWith('What is going on between these two?');
    expect(markSpeakTextSafeSuccessfulDelivery).toHaveBeenCalled();
    expect(markInterviewClosingTtsDelivered).not.toHaveBeenCalled();
  });

  it('skips delivery bookkeeping when tab interrupt suppressed playback', () => {
    const applyInterviewSpeechComplete = jest.fn();

    applySpeakTextSafePostPlaybackSuccess({
      text: 'What is going on between these two?',
      silent: false,
      skipDeliveryForTabInterrupt: true,
      interviewSpeechRole: 'assistant_response',
      skipInterviewSpeechAdvance: false,
      applyInterviewSpeechComplete,
      lastSuccessfulTtsTextNormalizedRef: { current: null },
      lastSuccessfulTtsDeliveredPreviewRef: { current: '' },
      scenarioAContemptProbeTtsDeliveredSessionRef: { current: false },
      scenarioAContemptProbePlaybackConfirmedRef: { current: false },
      showScenarioCardCanonicalPlaybackConfirmedKindsRef: { current: {} },
      closingTtsSessionKey: 'session-test',
    });

    expect(applyInterviewSpeechComplete).not.toHaveBeenCalled();
    expect(markSpeakTextSafeSuccessfulDelivery).not.toHaveBeenCalled();
  });

  it('skips transcript advance for unconfirmed show-scenario-card canonical delivery', () => {
    const applyInterviewSpeechComplete = jest.fn();
    const canonical = `${SCENARIO_1_VIGNETTE}\n\n${SCENARIO_1_OPENING}`;

    applySpeakTextSafePostPlaybackSuccess({
      text: canonical,
      silent: false,
      skipDeliveryForTabInterrupt: false,
      interviewSpeechRole: 'assistant_response',
      skipInterviewSpeechAdvance: false,
      applyInterviewSpeechComplete,
      lastSuccessfulTtsTextNormalizedRef: { current: null },
      lastSuccessfulTtsDeliveredPreviewRef: { current: '' },
      scenarioAContemptProbeTtsDeliveredSessionRef: { current: false },
      scenarioAContemptProbePlaybackConfirmedRef: { current: false },
      showScenarioCardCanonicalPlaybackConfirmedKindsRef: { current: {} },
      closingTtsSessionKey: 'session-test',
    });

    expect(applyInterviewSpeechComplete).not.toHaveBeenCalled();
    expect(markSpeakTextSafeSuccessfulDelivery).not.toHaveBeenCalled();
  });
});
