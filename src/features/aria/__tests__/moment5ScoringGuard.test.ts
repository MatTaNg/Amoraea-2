import { describe, expect, it } from '@jest/globals';
import {
  MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
  MOMENT_5_RESOLUTION_FOLLOWUP_TEXT,
} from '@features/aria/moment5ProbeCopy';
import {
  applyMoment5PostParseCoercionAndSalvage,
  backfillMoment5KeyEvidenceIfScoresOtherwiseUnpersistable,
  fillMoment5KeyEvidenceWhenNumericScoreButMissingQuote,
  MOMENT5_SCORE_RECOVERED_EVIDENCE_LINE,
} from '../moment5ScoringParse';
import {
  moment5ScoringAllowed,
  scoringSliceHasAssessableMoment5UserResponse,
  transcriptEligibleForMoment5Scoring,
} from '../moment5ScoringGuard';
import { inferPersonalMomentSlices, trimMoment5SliceForScoring } from '../personalMomentSlices';

const SUBSTANTIVE_M5_ANSWER =
  'I had a serious conflict with my close friend Alex after I missed an important event. We stopped talking for weeks until I called to apologize and explain how ashamed I felt.';

describe('moment5ScoringGuard', () => {
  it('rejects transcript that ends on resolution follow-up with no user answer', () => {
    const transcript = [
      { role: 'assistant' as const, content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      { role: 'assistant' as const, content: MOMENT_5_RESOLUTION_FOLLOWUP_TEXT },
    ];
    expect(transcriptEligibleForMoment5Scoring(transcript)).toBe(false);
    expect(scoringSliceHasAssessableMoment5UserResponse(transcript)).toBe(false);
    expect(moment5ScoringAllowed(transcript, transcript)).toBe(false);
  });

  it('trimMoment5SliceForScoring returns empty slice when no user turn exists', () => {
    const { moment5 } = inferPersonalMomentSlices([
      { role: 'assistant', content: 'Scenario wrap' },
      { role: 'assistant', content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      { role: 'assistant', content: MOMENT_5_RESOLUTION_FOLLOWUP_TEXT },
    ]);
    expect(trimMoment5SliceForScoring(moment5)).toEqual([]);
  });

  it('recovery path does not add scores when guard fails', () => {
    const transcript = [
      { role: 'assistant' as const, content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      { role: 'assistant' as const, content: MOMENT_5_RESOLUTION_FOLLOWUP_TEXT },
    ];
    const guard = { transcript, scoringSlice: trimMoment5SliceForScoring(transcript) };
    const raw = '{"pillar_scores":{"accountability":null},"key_evidence":{},"accountability":7}';
    const parsed: Record<string, unknown> = {
      pillarScores: { accountability: null },
      keyEvidence: {},
    };

    applyMoment5PostParseCoercionAndSalvage(raw, parsed, guard);
    expect(parsed.pillarScores).toEqual({ accountability: null });

    const fillRow = {
      pillarScores: { accountability: 7 } as Record<string, number | null>,
      keyEvidence: {} as Record<string, string>,
    };
    fillMoment5KeyEvidenceWhenNumericScoreButMissingQuote(fillRow, guard);
    expect(fillRow.keyEvidence.accountability).toBeUndefined();

    const backfillRow = {
      pillarScores: { accountability: null, mentalizing: null, repair: null, regulation: null, contempt_expression: null },
      keyEvidence: {} as Record<string, string>,
    };
    backfillMoment5KeyEvidenceIfScoresOtherwiseUnpersistable(backfillRow, { attemptId: 'test-attempt' }, guard);
    expect(backfillRow.keyEvidence.accountability).toBeUndefined();
  });

  it('allows recovery when substantive user answer exists', () => {
    const transcript = [
      { role: 'assistant' as const, content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      { role: 'user' as const, content: SUBSTANTIVE_M5_ANSWER, interviewMoment: 5 },
    ];
    const guard = { transcript, scoringSlice: transcript };
    const row = {
      pillarScores: { accountability: 8 } as Record<string, number | null>,
      keyEvidence: {} as Record<string, string>,
    };
    fillMoment5KeyEvidenceWhenNumericScoreButMissingQuote(row, guard);
    expect(row.keyEvidence.accountability).toMatch(/^User: "/);
  });

  it('rejects empty or too-brief user turns in scoring slice', () => {
    const slice = [
      { role: 'assistant' as const, content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      { role: 'user' as const, content: '   ' },
      { role: 'user' as const, content: 'ok' },
    ];
    expect(scoringSliceHasAssessableMoment5UserResponse(slice)).toBe(false);
  });

  it('stays eligible when a brief user turn precedes a substantive answer', () => {
    const transcript = [
      { role: 'assistant' as const, content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      { role: 'user' as const, content: 'ok' },
      { role: 'user' as const, content: SUBSTANTIVE_M5_ANSWER },
    ];
    expect(transcriptEligibleForMoment5Scoring(transcript)).toBe(true);
    expect(moment5ScoringAllowed(transcript, transcript)).toBe(true);
  });

  it('stays eligible for paraphrased primary conflict question with later probe answer', () => {
    const paraphrase =
      'Think of a time when you had a conflict with someone important in your life. What happened, and how did things get resolved?';
    const transcript = [
      { role: 'assistant' as const, content: paraphrase },
      { role: 'user' as const, content: SUBSTANTIVE_M5_ANSWER },
      {
        role: 'assistant' as const,
        content: 'What do you think you did or said that contributed to the conflict?',
      },
      {
        role: 'user' as const,
        content:
          'I got defensive and shut down instead of listening, which made the argument worse before we repaired.',
      },
    ];
    expect(transcriptEligibleForMoment5Scoring(transcript)).toBe(true);
  });

  it('recognizes interview_moment snake_case tags on user turns', () => {
    const transcript = [
      { role: 'assistant' as const, content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      {
        role: 'user' as const,
        content: SUBSTANTIVE_M5_ANSWER,
        interview_moment: 5,
      },
    ];
    expect(transcriptEligibleForMoment5Scoring(transcript)).toBe(true);
    expect(moment5ScoringAllowed(transcript, transcript)).toBe(true);
  });

  it('recognizes interviewMoment stored as a string', () => {
    const transcript = [
      { role: 'assistant' as const, content: MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT },
      {
        role: 'user' as const,
        content: SUBSTANTIVE_M5_ANSWER,
        interviewMoment: '5' as unknown as number,
      },
    ];
    expect(transcriptEligibleForMoment5Scoring(transcript)).toBe(true);
  });
});
