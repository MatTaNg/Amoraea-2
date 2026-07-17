import {
  ASSISTANT_INTERVIEW_SPEECH,
  SCENARIO_SPLIT_INTER_SEGMENT_GAP_MS,
  SHOW_SCENARIO_CARD_CANONICAL_SPEECH,
  TAB_RESTORE_PENDING_SPEAK_OPTIONS,
} from '../interviewTtsSpeakOptions';

describe('interviewTtsSpeakOptions', () => {
  it('ASSISTANT_INTERVIEW_SPEECH marks turn assistant responses', () => {
    expect(ASSISTANT_INTERVIEW_SPEECH.interviewSpeechRole).toBe('assistant_response');
    expect(ASSISTANT_INTERVIEW_SPEECH.telemetrySource).toBe('turn');
  });

  it('TAB_RESTORE_PENDING_SPEAK_OPTIONS skips interview advance and gesture gate', () => {
    expect(TAB_RESTORE_PENDING_SPEAK_OPTIONS.skipInterviewSpeechAdvance).toBe(true);
    expect(TAB_RESTORE_PENDING_SPEAK_OPTIONS.skipGestureGate).toBe(true);
    expect(TAB_RESTORE_PENDING_SPEAK_OPTIONS.skipPcmStream).toBe(true);
  });

  it('SHOW_SCENARIO_CARD_CANONICAL_SPEECH allows consecutive dedup retry and skips gesture gate', () => {
    expect(SHOW_SCENARIO_CARD_CANONICAL_SPEECH).toMatchObject(ASSISTANT_INTERVIEW_SPEECH);
    expect(SHOW_SCENARIO_CARD_CANONICAL_SPEECH.allowDuplicateConsecutiveTts).toBe(true);
    expect(SHOW_SCENARIO_CARD_CANONICAL_SPEECH.skipGestureGate).toBe(true);
    expect(SHOW_SCENARIO_CARD_CANONICAL_SPEECH.skipPcmStream).toBe(true);
  });

  it('exports scenario split gap constant', () => {
    expect(SCENARIO_SPLIT_INTER_SEGMENT_GAP_MS).toBe(200);
  });
});
