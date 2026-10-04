import { describe, expect, it } from '@jest/globals';

import { aggregatePillarScoresWithCommitmentMergeDetailed } from '@features/aria/aggregateMarkerScoresFromSlices';
import { buildMoment5AccountabilityScoringPrompt } from '@features/aria/moment5AccountabilityScoringPrompt';
import { shouldAskCommitmentHypotheticalFallback } from '@features/aria/moment4SpecificityFollowUp';
import {
  MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
  MOMENT_4_COMMITMENT_THRESHOLD_NO_RELATIONSHIP_SPOKEN,
  MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT,
  MOMENT_4_GRUDGE_QUESTION_TEXT,
  resolveCommitmentResponseSource,
} from '@features/aria/moment4ProbeLogic';
import { buildPersonalMomentScoringPrompt } from '@features/aria/personalMomentScoringPrompt';
import { mergeMoment5PillarScoresAfterEvidenceNormalize } from '@features/aria/moment5ScoringParse';
import { resolvePendingPersonalMomentProbe } from '@features/aria/resolvePendingPersonalMomentProbe';
import { buildMoment4ScoresRecord } from '@utilities/persistPersonalMomentScoresIncremental';

const SUBSTANTIVE_KEEP_INVESTING =
  'We kept going because we had built so much together and I still believed we could repair things if we both showed up.';

const THIN_DEFLECT =
  'Yeah I just try to be better.';

function pendingAfterOrientation(userText: string) {
  return resolvePendingPersonalMomentProbe({
    snapshot: {
      currentInterviewMoment: 4,
      currentScenario: 3,
      lastAssistantContent: MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
      lastQuestionText: MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
      userText,
      transcriptTurnCount: 6,
    },
    messages: [
      { role: 'assistant', content: MOMENT_4_GRUDGE_QUESTION_TEXT, interviewMoment: 4 },
      {
        role: 'user',
        content: 'My close friend betrayed my confidence and we have not spoken in a year.',
        interviewMoment: 4,
      },
      { role: 'assistant', content: MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT, interviewMoment: 4 },
      { role: 'user', content: userText, interviewMoment: 4 },
    ],
    lastAssistantContent: MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT,
  });
}

describe('commitment hypothetical fallback', () => {
  it('primary question invites investment reasoning only', () => {
    expect(MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT).toBe(
      'Think of a relationship you had in the past. When things got difficult, what made you keep investing in it?',
    );
    expect(MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT).not.toMatch(
      /walking away|rather than ending|rather than pulling|vs\.?\s*walk/i,
    );
  });

  it('fallback question has no thanks-for-sharing lead-in', () => {
    expect(MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT).toBe(
      'At what point do you decide when a relationship is something to work through versus something you need to walk away from?',
    );
    expect(MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT.startsWith('Thanks for sharing')).toBe(false);
  });

  it('acknowledges a missing relationship before the general commitment question', () => {
    expect(MOMENT_4_COMMITMENT_THRESHOLD_NO_RELATIONSHIP_SPOKEN).toBe(
      'No problem. What about in general, at what point do you decide when a relationship is something to work through versus something you need to walk away from?',
    );
  });

  it('does not fire the fallback when the keep-investing answer is substantive', () => {
    expect(shouldAskCommitmentHypotheticalFallback(SUBSTANTIVE_KEEP_INVESTING)).toBe(false);
    expect(pendingAfterOrientation(SUBSTANTIVE_KEEP_INVESTING)).toBe('m_support');
  });

  it('fires the fallback when they cannot think of a relationship', () => {
    expect(shouldAskCommitmentHypotheticalFallback("I can't think of one.")).toBe(true);
    expect(pendingAfterOrientation("I can't think of one.")).toBe('m4_commitment_threshold');
  });

  it('fires the fallback when they have never been in a relationship', () => {
    for (const answer of [
      "I've never been in a relationship before.",
      'I have never dated anyone.',
      "I've never had a boyfriend or girlfriend.",
      "I don't have any relationship experience.",
      "I've never been in a serious relationship, so I don't have one to draw on.",
    ]) {
      expect(shouldAskCommitmentHypotheticalFallback(answer)).toBe(true);
      expect(pendingAfterOrientation(answer)).toBe('m4_commitment_threshold');
    }
  });

  it('does not treat a real past relationship as never having been in one', () => {
    const story =
      "I've never been in a relationship that was easy. My partner and I stayed because we kept working through it after we broke up and got back together.";
    expect(shouldAskCommitmentHypotheticalFallback(story)).toBe(false);
  });

  it('does not fire the walk-away question after a developed keep-investing answer', () => {
    const developed =
      "I think it depends on if the two people are aligned, they love each other and care enough about each other to work through the issues. If there's space, there's peace, or if there's nothing but pain, then it's, you know, there's peace and obviously something to continue to work through. If there's only pain, you might want to break up.";
    expect(shouldAskCommitmentHypotheticalFallback(developed)).toBe(false);
    expect(pendingAfterOrientation(developed)).toBe('m_support');
  });

  it('does not fire the walk-away question for a short keep-investing answer', () => {
    expect(shouldAskCommitmentHypotheticalFallback(THIN_DEFLECT)).toBe(false);
    expect(shouldAskCommitmentHypotheticalFallback('I asked her.')).toBe(false);
    expect(pendingAfterOrientation(THIN_DEFLECT)).not.toBe('m4_commitment_threshold');
    expect(pendingAfterOrientation('I asked her.')).not.toBe('m4_commitment_threshold');
  });

  it('tags commitment_source from which question was actually asked', () => {
    const autobiographical = [
      { role: 'assistant', content: MOMENT_4_COMMITMENT_ORIENTATION_QUESTION_TEXT },
      { role: 'user', content: SUBSTANTIVE_KEEP_INVESTING },
    ];
    const fallback = [
      ...autobiographical,
      { role: 'assistant', content: MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT },
      { role: 'user', content: 'I walk away when trust is gone and we have already tried to repair it.' },
    ];
    expect(resolveCommitmentResponseSource(autobiographical)).toBe('autobiographical');
    expect(resolveCommitmentResponseSource(fallback)).toBe('hypothetical_fallback');

    const slice = {
      pillarScores: { commitment_orientation: 6 },
      keyEvidence: { commitment_orientation: 'kept investing' },
      summary: '',
      specificity: null,
      momentName: 'moment_4',
    };
    expect(buildMoment4ScoresRecord(slice as never, null, 'autobiographical').commitment_source).toBe(
      'autobiographical',
    );
    expect(buildMoment4ScoresRecord(slice as never, null, 'hypothetical_fallback').commitment_source).toBe(
      'hypothetical_fallback',
    );
  });

  it('rolls commitment_persistence up with or without the fallback slice', () => {
    const empty = { pillarScores: {}, keyEvidence: {} };
    const orientationOnly = aggregatePillarScoresWithCommitmentMergeDetailed([
      empty,
      empty,
      empty,
      {
        pillarScores: { commitment_orientation: 6 },
        keyEvidence: { commitment_orientation: 'kept investing because we still respected each other' },
      },
      empty,
      empty,
    ]);
    expect(orientationOnly.scores.commitment_persistence).toBe(6);

    const both = aggregatePillarScoresWithCommitmentMergeDetailed([
      empty,
      empty,
      empty,
      {
        pillarScores: { persistence_exit_judgment: 8, commitment_orientation: 6, commitment_threshold: 8 },
        keyEvidence: {
          persistence_exit_judgment: 'walk-away criteria',
          commitment_orientation: 'kept investing',
          commitment_threshold: 'walk-away criteria',
        },
      },
      empty,
      empty,
    ]);
    expect(both.scores.commitment_persistence).toBe(7);
  });

  it('scores spontaneous exit-judgment on Moment 5 on either commitment path', () => {
    const m4Prompt = buildPersonalMomentScoringPrompt([
      { role: 'user', content: 'We kept going because we had built so much together.' },
    ]);
    expect(m4Prompt).toMatch(/spontaneous exit-judgment/i);
    expect(m4Prompt).toMatch(/Do not require the fallback question to have been asked/);

    const m5Prompt = buildMoment5AccountabilityScoringPrompt([
      { role: 'user', content: 'I would walk away if we stopped trying.' },
    ]);
    expect(m5Prompt).toMatch(/persistence_exit_judgment/);
    expect(m5Prompt).not.toMatch(/commitment_source/);

    expect(
      mergeMoment5PillarScoresAfterEvidenceNormalize({
        accountability: 7,
        persistence_exit_judgment: 8,
      }).persistence_exit_judgment,
    ).toBe(8);

    const empty = { pillarScores: {}, keyEvidence: {} };
    const autobiographicalPlusSpontaneous = aggregatePillarScoresWithCommitmentMergeDetailed([
      empty,
      empty,
      empty,
      {
        pillarScores: { commitment_orientation: 6 },
        keyEvidence: { commitment_orientation: 'kept investing' },
      },
      {
        pillarScores: { persistence_exit_judgment: 8 },
        keyEvidence: { persistence_exit_judgment: 'I leave when trust is gone' },
      },
      empty,
    ]);
    expect(autobiographicalPlusSpontaneous.scores.commitment_persistence).toBe(7);

    const fallbackPlusSpontaneous = aggregatePillarScoresWithCommitmentMergeDetailed([
      empty,
      empty,
      empty,
      {
        pillarScores: { persistence_exit_judgment: 8, commitment_orientation: 6 },
        keyEvidence: {
          persistence_exit_judgment: 'fallback walk-away criteria',
          commitment_orientation: 'kept investing',
        },
      },
      {
        pillarScores: { persistence_exit_judgment: 4 },
        keyEvidence: { persistence_exit_judgment: 'spontaneous exit criteria in the conflict story' },
      },
      empty,
    ]);
    expect(fallbackPlusSpontaneous.scores.commitment_persistence).toBe(6);
  });
});
