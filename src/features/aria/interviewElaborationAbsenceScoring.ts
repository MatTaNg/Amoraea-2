import {
  applyElaborationAbsencePenaltiesMoment4,
  applyElaborationAbsencePenaltiesMoment5,
  computeAvgUserWordsPerTurnForInterviewMoment,
  computeAvgUserWordsPerTurnPersonalSlice,
} from '@features/aria/elaborationAbsencePenaltiesHeuristic';
import { applyMoment4AccountabilitySituationalExemptToScoreResult } from '@features/aria/moment4AccountabilitySituationalExempt';
import type { Moment4ClientScoringMetadata, Moment5ClientScoringMetadata } from '@features/aria/personalMomentScoringPrompt';
import type { PersonalMomentScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import { userTextFromTranscriptTurns } from '@features/aria/moment4AccountabilitySituationalExempt';

export function applyElaborationAbsenceAfterNormalizeMoment4(
  result: PersonalMomentScoreResult,
  sliceForAvg: Array<{ role: string; content: string }>,
  moment4Meta: Moment4ClientScoringMetadata | null,
  fullTranscriptForAvg?: Array<{ role?: string; content?: string; interviewMoment?: number }>,
) {
  const taggedAvg = fullTranscriptForAvg
    ? computeAvgUserWordsPerTurnForInterviewMoment(fullTranscriptForAvg, 4)
    : 0;
  const avg = taggedAvg > 0 ? taggedAvg : computeAvgUserWordsPerTurnPersonalSlice(sliceForAvg);
  const communicationAvgResponseLength = fullTranscriptForAvg
    ? computeAvgUserWordsPerTurnPersonalSlice(fullTranscriptForAvg)
    : null;
  const out = applyElaborationAbsencePenaltiesMoment4(
    result.pillarScores,
    result.keyEvidence,
    moment4Meta,
    avg,
    {
      wordCountSource: 'live_transcript',
      communicationAvgResponseLength,
      userSliceText: userTextFromTranscriptTurns(sliceForAvg),
    },
  );
  result.pillarScores = out.pillarScores as PersonalMomentScoreResult['pillarScores'];
  result.keyEvidence = out.keyEvidence;
  applyMoment4AccountabilitySituationalExemptToScoreResult(
    result,
    userTextFromTranscriptTurns(sliceForAvg),
  );
  return out.depthModifierMeta;
}

export function applyMoment5ConflictValidityScoreAdjustments(
  result: PersonalMomentScoreResult,
  moment5Meta?: Moment5ClientScoringMetadata | null,
) {
  const conflictState =
    moment5Meta?.conflictValidity ??
    (moment5Meta?.conflictValidityLow === true ? 'no_conflict' : null);
  if (conflictState !== 'no_conflict') return;

  const ceiling = 6;
  const floor = 5;
  const cappedMarkers = ['repair', 'regulation', 'accountability', 'mentalizing'] as const;
  for (const marker of cappedMarkers) {
    const score = result.pillarScores?.[marker];
    if (typeof score === 'number' && Number.isFinite(score)) {
      if (score > ceiling) {
        result.pillarScores[marker] = ceiling;
      } else if (score < floor) {
        result.pillarScores[marker] = floor;
      }
    }
    const existingEvidence = result.keyEvidence?.[marker]?.trim();
    const capEvidence =
      'Conflict validity no_conflict (TYPE A): repair/regulation/accountability/mentalizing capped at 6 with floor 5 unless actively harmful behavior was described.';
    result.keyEvidence = {
      ...(result.keyEvidence ?? {}),
      [marker]: existingEvidence ? `${existingEvidence} ${capEvidence}` : capEvidence,
    };
  }
}

export function applyElaborationAbsenceAfterNormalizeMoment5(
  result: PersonalMomentScoreResult,
  sliceForAvg: Array<{ role: string; content: string }>,
  fullTranscriptForAvg?: Array<{ role?: string; content?: string; interviewMoment?: number }>,
  moment5Meta?: Moment5ClientScoringMetadata | null,
) {
  const userText = sliceForAvg
    .filter((m) => m.role === 'user')
    .map((m) => m.content)
    .join('\n');
  const taggedAvg = fullTranscriptForAvg
    ? computeAvgUserWordsPerTurnForInterviewMoment(fullTranscriptForAvg, 5)
    : 0;
  const avg = taggedAvg > 0 ? taggedAvg : computeAvgUserWordsPerTurnPersonalSlice(sliceForAvg);
  const communicationAvgResponseLength = fullTranscriptForAvg
    ? computeAvgUserWordsPerTurnPersonalSlice(fullTranscriptForAvg)
    : null;
  const out = applyElaborationAbsencePenaltiesMoment5(
    userText,
    result.pillarScores,
    result.keyEvidence,
    avg,
    { wordCountSource: 'live_transcript', communicationAvgResponseLength },
  );
  result.pillarScores = out.pillarScores as PersonalMomentScoreResult['pillarScores'];
  result.keyEvidence = out.keyEvidence;
  applyMoment5ConflictValidityScoreAdjustments(result, moment5Meta);
  if (
    moment5Meta?.conflictValidity !== 'no_conflict' &&
    moment5Meta?.conflictValidityLow !== true &&
    moment5Meta?.accountabilityProbeFiredOnAbstractFollowup === true &&
    moment5Meta?.conflictValiditySecondResponseAbstract === true
  ) {
    const caps: Record<string, number> = { repair: 4, mentalizing: 5, regulation: 5 };
    Object.entries(caps).forEach(([marker, cap]) => {
      const score = result.pillarScores?.[marker];
      if (typeof score === 'number' && Number.isFinite(score) && score > cap) {
        result.pillarScores[marker] = cap;
      }
      const existingEvidence = result.keyEvidence?.[marker]?.trim();
      const capEvidence =
        'Moment 5 abstract follow-up after specificity redirect: low episodic specificity ceiling applies unless the post-probe answer adds clear rupture/repair evidence.';
      result.keyEvidence = {
        ...(result.keyEvidence ?? {}),
        [marker]: existingEvidence ? `${existingEvidence} ${capEvidence}` : capEvidence,
      };
    });
  }
  return out.depthModifierMeta;
}
