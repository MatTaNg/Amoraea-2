import {
  classifyPriorAnswerMetaKind,
  looksLikeAlreadyAnsweredClaim,
  looksLikeCheckingInSufficiencyAsk,
  looksLikeInterviewStillOpenCheck,
  looksLikePriorAnswerMetaComment,
  looksLikeVerifyPriorAnswerShape,
} from '@features/aria/interviewPriorAnswerMetaDetection';
import { classifyUserMetaComment } from '@features/aria/metaCommentClassifierCore';

describe('interviewPriorAnswerMetaDetection', () => {
  const sufficiencyExamples = [
    'Was that enough?',
    "Wasn't that enough?",
    'Did you get that?',
    'Is that sufficient?',
  ];

  const alreadyAnsweredExamples = [
    "Didn't I answer that already",
    'I already answered that',
    'I told you already',
    'I answered this question already.',
    "Didn't I already answer that?",
    'I thought I already answered this question',
    'Then I answer that already',
  ];

  const verifyPriorExamples = ['Check my answer', 'Check my last answer'];

  it.each(sufficiencyExamples)('classifies sufficiency check-in: %s', (phrase) => {
    expect(classifyPriorAnswerMetaKind(phrase)).toBe('sufficiency_check_in');
    expect(looksLikeCheckingInSufficiencyAsk(phrase)).toBe(true);
    expect(looksLikePriorAnswerMetaComment(phrase)).toBe(true);
  });

  it.each(alreadyAnsweredExamples)('classifies already-answered claim: %s', (phrase) => {
    expect(classifyPriorAnswerMetaKind(phrase)).toBe('already_answered_claim');
    expect(looksLikeAlreadyAnsweredClaim(phrase)).toBe(true);
    expect(looksLikePriorAnswerMetaComment(phrase)).toBe(true);
  });

  it.each(verifyPriorExamples)('classifies verify-prior as checking-in: %s', (phrase) => {
    expect(looksLikeVerifyPriorAnswerShape(phrase)).toBe(true);
    expect(classifyPriorAnswerMetaKind(phrase)).toBe('sufficiency_check_in');
  });

  it.each(['Is that it?', 'Is that all?', "That's it.", 'Are we done?'])(
    'treats a finished-check as a sufficiency check-in, not an answer: %s',
    (phrase) => {
      expect(looksLikeInterviewStillOpenCheck(phrase)).toBe(true);
      expect(classifyPriorAnswerMetaKind(phrase)).toBe('sufficiency_check_in');
      expect(looksLikeCheckingInSufficiencyAsk(phrase)).toBe(true);
      expect(classifyUserMetaComment(phrase)?.type).toBe('checking_in');
    },
  );

  it('does not classify substantive scenario answers as prior-answer meta', () => {
    expect(
      looksLikePriorAnswerMetaComment(
        'If I were James I would apologize and ask what would help her feel appreciated.',
      ),
    ).toBe(false);
  });

  it.each([
    ...alreadyAnsweredExamples,
    ...sufficiencyExamples,
  ])('meta classifier avoids ambiguous_short for: %s', (phrase) => {
    const result = classifyUserMetaComment(phrase);
    expect(result?.type).not.toBe('ambiguous_short');
  });
});
