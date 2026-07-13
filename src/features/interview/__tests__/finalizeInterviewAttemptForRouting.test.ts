import { describe, expect, it } from '@jest/globals';
import {
  attemptCompletedAtReflectsScoredInterview,
  attemptHasPersistedScoringForRoutingFinalize,
  attemptIndicatesInterviewSessionFinished,
  attemptTranscriptInterviewContentComplete,
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

const MOMENT_4_SCORES = {
  pillarScores: { commitment: 4 },
  keyEvidence: { commitment: 'User described working through conflict.' },
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

  it('treats transcript content as complete when scenario bundles are saved', () => {
    expect(
      attemptTranscriptInterviewContentComplete({
        completed_at: null,
        transcript: MATT_SESSION_TRANSCRIPT,
        scenario_1_scores: SCENARIO_SCORES,
        scenario_2_scores: SCENARIO_SCORES,
        scenario_3_scores: SCENARIO_SCORES,
      }),
    ).toBe(true);
  });

  it('does not treat transcript-only progress as routing-finished without scoring rollup', () => {
    expect(
      attemptIndicatesInterviewSessionFinished({
        completed_at: null,
        transcript: MATT_SESSION_TRANSCRIPT,
        scenario_1_scores: SCENARIO_SCORES,
        scenario_2_scores: SCENARIO_SCORES,
        scenario_3_scores: SCENARIO_SCORES,
      }),
    ).toBe(false);
  });

  it('allows routing finalize when weighted_score is persisted', () => {
    expect(
      attemptIndicatesInterviewSessionFinished({
        completed_at: null,
        transcript: MATT_SESSION_TRANSCRIPT,
        scenario_1_scores: SCENARIO_SCORES,
        scenario_2_scores: SCENARIO_SCORES,
        scenario_3_scores: SCENARIO_SCORES,
        weighted_score: 6.8,
      }),
    ).toBe(true);
  });

  it('allows routing finalize when moment_4_scores are persisted', () => {
    expect(
      attemptIndicatesInterviewSessionFinished({
        completed_at: null,
        transcript: MATT_SESSION_TRANSCRIPT,
        scenario_1_scores: SCENARIO_SCORES,
        scenario_2_scores: SCENARIO_SCORES,
        scenario_3_scores: SCENARIO_SCORES,
        scenario_specific_patterns: { moment_4_scores: MOMENT_4_SCORES },
      }),
    ).toBe(true);
  });

  it('does not treat completed_at without rollup as scored for routing', () => {
    expect(
      attemptCompletedAtReflectsScoredInterview({
        completed_at: '2026-07-07T06:09:09.616+00:00',
        transcript: MATT_SESSION_TRANSCRIPT,
        scenario_1_scores: SCENARIO_SCORES,
        scenario_2_scores: SCENARIO_SCORES,
        scenario_3_scores: SCENARIO_SCORES,
      }),
    ).toBe(false);
    expect(
      attemptHasPersistedScoringForRoutingFinalize({
        completed_at: '2026-07-07T06:09:09.616+00:00',
        weighted_score: 7.1,
      }),
    ).toBe(true);
  });

  it('does not treat mid-interview Scenario A-only progress as finished', () => {
    expect(
      attemptTranscriptInterviewContentComplete({
        completed_at: null,
        transcript: [MATT_SESSION_TRANSCRIPT[0], MATT_SESSION_TRANSCRIPT[1]],
        scenario_1_scores: SCENARIO_SCORES,
        scenario_2_scores: null,
        scenario_3_scores: null,
      }),
    ).toBe(false);
  });

  it('ignores truncated stream-cutoff closings for transcript completion', () => {
    const truncatedClosingTranscript = [
      ...MATT_SESSION_TRANSCRIPT.slice(0, 3),
      {
        role: 'assistant',
        content:
          'That makes a lot of sense. Good work getting through all of this. What you said about. Thank you for being so open with me, Matt.',
        scenarioNumber: 3,
        interviewMoment: 5,
      },
    ];
    expect(
      attemptTranscriptInterviewContentComplete({
        completed_at: null,
        transcript: truncatedClosingTranscript,
        scenario_1_scores: SCENARIO_SCORES,
        scenario_2_scores: SCENARIO_SCORES,
        scenario_3_scores: SCENARIO_SCORES,
      }),
    ).toBe(false);
  });
});
