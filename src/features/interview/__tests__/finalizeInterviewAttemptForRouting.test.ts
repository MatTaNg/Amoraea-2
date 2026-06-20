import { describe, expect, it } from '@jest/globals';
import {
  attemptIndicatesInterviewSessionFinished,
  attemptTranscriptHasSubstantiveMoment5UserAnswer,
} from '../finalizeInterviewAttemptForRouting';

const MATT_SESSION_TRANSCRIPT = [
  { role: 'assistant', content: "What's going on between these two?", scenarioNumber: 1, interviewMoment: 1 },
  {
    role: 'user',
    content:
      "Ryan should not have taken a 25-minute call during their date. That was very disrespectful. He should have set proper boundaries with his mother, told his mother he'll call her back, and committed to it. And Emma was being a bit condescending with her statement. You made that really clear. She's clearly really frustrated and is hiding it. So maybe this has happened before and she's kind of resigned. That's what I'm getting from Emma.",
    scenarioNumber: 1,
    interviewMoment: 1,
  },
  {
    role: 'assistant',
    content:
      "Think of a time when you had a conflict with someone important to you. What happened, and how did things get resolved between you two?",
    scenarioNumber: 3,
  },
  {
    role: 'user',
    content:
      "Well, I had a conflict with my friend Devanshu and he called me a bad coach and I didn't like that because I was just starting to coach and he kind of left me my feelings and ended up getting facilitated because it was during a spiritual retreat and I did end up raising my voice at him but at the same time I think that's okay. It's good to express your anger and emotions if it's real for you and we took some time to listen to each other and the group also chimed in and we understood each other. I don't necessarily agree where he's coming from but I understand which is good enough. We're cool now and I think I had a lot to learn there.",
    scenarioNumber: 3,
    interviewMoment: 5,
  },
] as const;

const SCENARIO_SCORES = {
  pillarScores: { repair: 5, attunement: 5 },
};

describe('finalizeInterviewAttemptForRouting', () => {
  it('detects substantive Moment 5 user answer in transcript', () => {
    expect(attemptTranscriptHasSubstantiveMoment5UserAnswer([])).toBe(false);
    expect(attemptTranscriptHasSubstantiveMoment5UserAnswer(MATT_SESSION_TRANSCRIPT)).toBe(true);
  });

  it('detects Moment 5 completion when interviewMoment is missing on the saved user turn', () => {
    const transcriptWithoutMomentTag = [
      MATT_SESSION_TRANSCRIPT[2],
      { ...MATT_SESSION_TRANSCRIPT[3], interviewMoment: undefined },
    ];
    expect(attemptTranscriptHasSubstantiveMoment5UserAnswer(transcriptWithoutMomentTag)).toBe(true);
  });

  it('treats Matt session as finished when scenario bundles are saved but completed_at is null', () => {
    expect(
      attemptIndicatesInterviewSessionFinished({
        completed_at: null,
        transcript: MATT_SESSION_TRANSCRIPT,
        scenario_1_scores: SCENARIO_SCORES,
        scenario_2_scores: SCENARIO_SCORES,
        scenario_3_scores: SCENARIO_SCORES,
      }),
    ).toBe(true);
  });

  it('does not treat mid-interview Scenario A-only progress as finished', () => {
    expect(
      attemptIndicatesInterviewSessionFinished({
        completed_at: null,
        transcript: [MATT_SESSION_TRANSCRIPT[0], MATT_SESSION_TRANSCRIPT[1]],
        scenario_1_scores: SCENARIO_SCORES,
        scenario_2_scores: null,
        scenario_3_scores: null,
      }),
    ).toBe(false);
  });
});
