import { shouldSpeakMissedScenarioBoundaryLeadAtStreamEnd } from '@features/aria/parallelStreamScenarioBoundaryHandoff';

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
