import {
  resolveStreamEndHandoffSpeechAfterPartialBoundaryLead,
  shouldSpeakMissedScenarioBoundaryLeadAtStreamEnd,
} from '@features/aria/parallelStreamScenarioBoundaryHandoff';
import { buildScenario2To3BundleForInterview } from '@features/aria/interviewTransitionBundles';
import { SCENARIO_3_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import { SCENARIO_2_TO_3_TRANSITION } from '@features/aria/interviewTransitionBundles';

describe('parallelStreamScenarioBoundaryHandoff', () => {
  it('shouldSpeakMissedScenarioBoundaryLeadAtStreamEnd allows moment 1–3 boundary recovery', () => {
    expect(
      shouldSpeakMissedScenarioBoundaryLeadAtStreamEnd({
        interviewMoment: 1,
        bufferAllStreamTtsForMoment5Close: false,
        moment5StickyCloseBufferAll: false,
        moment5ClosingStreamBuffer: '',
        streamFull: "That's a wrap on that one. Nice work, Matt.",
      }),
    ).toBe(true);
  });

  it('resolveStreamEndHandoffSpeechAfterPartialBoundaryLead returns only vignette when wrap already spoken', () => {
    const bundle = buildScenario2To3BundleForInterview('Matt', SCENARIO_3_TEXT, null);
    const resolved = resolveStreamEndHandoffSpeechAfterPartialBoundaryLead(
      bundle,
      SCENARIO_2_TO_3_TRANSITION,
      2,
    );
    expect(resolved).toMatch(/Sophie and Daniel/i);
    expect(resolved).not.toMatch(/That'?s the second one done/i);
  });

  it('shouldSpeakMissedScenarioBoundaryLeadAtStreamEnd skips moment 5 close buffering', () => {
    expect(
      shouldSpeakMissedScenarioBoundaryLeadAtStreamEnd({
        interviewMoment: 5,
        bufferAllStreamTtsForMoment5Close: true,
        moment5StickyCloseBufferAll: false,
        moment5ClosingStreamBuffer: '',
        streamFull: "That's a wrap on that one.",
      }),
    ).toBe(false);
  });
});
