import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import {
  isAnsweringFirstUserTurnAfterMoment4Orientation,
  isAnsweringFirstUserTurnAfterMoment4Threshold,
  looksLikeAssessableOrientationAnswer,
  looksLikeAssessableSupportAnswer,
  looksLikeMoment4GrudgePrompt,
  looksLikeMoment4OrientationQuestion,
  looksLikeMoment4ThresholdQuestion,
  looksLikeMomentSupportConditionalProbe,
  looksLikeMomentSupportNoSituationHypothetical,
  looksLikeMomentSupportQuestion,
  looksLikeNeedRecognitionInSupportAnswer,
  looksLikeUnassessableMoment4ThresholdAnswer,
  shouldForceMoment4OrientationProbe,
  transcriptIncludesAssistantMatch,
  transcriptIncludesMoment4ThresholdAssistant,
} from '@features/aria/moment4ProbeLogic';
import {
  evaluateMoment4SpecificityProbe,
  looksLikeMoment4SpecificityFollowUpEcho,
  shouldAskCommitmentHypotheticalFallback,
} from '@features/aria/moment4SpecificityFollowUp';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { InterviewTurnStateSnapshot } from '@features/aria/interviewTurnOrchestratorTypes';
import { transcriptAssistantContainsMoment5PrimaryConflictQuestion } from '@features/aria/probeAndScoringUtils';

/**
 * Pending M4/support/M5 canonical probes — mirrors pre-Claude inject gate eligibility using transcript signals.
 * Flow: grudge → keep-investing orientation → walk-away fallback only when they have no relationship → support (+ conditional) → M5 conflict.
 */
export function resolvePendingPersonalMomentProbe(args: {
  snapshot: InterviewTurnStateSnapshot;
  messages: readonly MessageWithScenario[];
  lastAssistantContent: string;
}): InterviewCanonicalProbeId | null {
  const { snapshot, messages, lastAssistantContent } = args;
  const { currentInterviewMoment, userText } = snapshot;

  if (currentInterviewMoment !== 4 && currentInterviewMoment !== 5) {
    return null;
  }

  const priorTranscript = messages.slice(0, -1);
  const orientationInTranscript = transcriptIncludesAssistantMatch(
    priorTranscript,
    looksLikeMoment4OrientationQuestion,
  );
  const thresholdInTranscript = transcriptIncludesMoment4ThresholdAssistant(priorTranscript);
  const supportInTranscript = transcriptIncludesAssistantMatch(priorTranscript, looksLikeMomentSupportQuestion);
  const supportConditionalInTranscript = transcriptIncludesAssistantMatch(
    priorTranscript,
    looksLikeMomentSupportConditionalProbe,
  );
  const m5InTranscript = priorTranscript.some(
    (m) =>
      m.role === 'assistant' &&
      transcriptAssistantContainsMoment5PrimaryConflictQuestion(m.content ?? ''),
  );

  if (
    currentInterviewMoment === 4 &&
    !orientationInTranscript &&
    shouldForceMoment4OrientationProbe({
      orientationProbeAlreadyAsked: false,
      isMoment4: true,
      lastAssistantContent,
      userAnswerText: userText,
      answeringSpecificityFollowUp: looksLikeMoment4SpecificityFollowUpEcho(lastAssistantContent),
    })
  ) {
    const specificityProbeAlreadyInTranscript = messages.some(
      (m) =>
        m.role === 'assistant' &&
        looksLikeMoment4SpecificityFollowUpEcho((m as { content?: string }).content ?? ''),
    );
    if (
      looksLikeMoment4GrudgePrompt(lastAssistantContent) &&
      !specificityProbeAlreadyInTranscript &&
      evaluateMoment4SpecificityProbe(userText).probeShouldFire
    ) {
      return null;
    }
    return 'm4_commitment_orientation';
  }

  if (m5InTranscript) {
    return null;
  }

  const answeringOrientation =
    looksLikeMoment4OrientationQuestion(lastAssistantContent) ||
    isAnsweringFirstUserTurnAfterMoment4Orientation(priorTranscript);
  if (orientationInTranscript && !thresholdInTranscript && answeringOrientation) {
    if (shouldAskCommitmentHypotheticalFallback(userText)) {
      return 'm4_commitment_threshold';
    }
  }

  const orientationAnswerLetsSupportProceed =
    orientationInTranscript &&
    !thresholdInTranscript &&
    answeringOrientation &&
    !shouldAskCommitmentHypotheticalFallback(userText) &&
    looksLikeAssessableOrientationAnswer(userText);
  const thresholdAnswerLetsSupportProceed =
    thresholdInTranscript &&
    (looksLikeMoment4ThresholdQuestion(lastAssistantContent) ||
      isAnsweringFirstUserTurnAfterMoment4Threshold(priorTranscript)) &&
    !looksLikeUnassessableMoment4ThresholdAnswer(userText);

  if (!supportInTranscript && (orientationAnswerLetsSupportProceed || thresholdAnswerLetsSupportProceed)) {
    return 'm_support';
  }

  if (supportInTranscript && !m5InTranscript) {
    const supportNeedAlreadyPresent = looksLikeNeedRecognitionInSupportAnswer(userText);
    if (
      !supportConditionalInTranscript &&
      !supportNeedAlreadyPresent &&
      (looksLikeMomentSupportQuestion(lastAssistantContent) ||
        looksLikeMomentSupportNoSituationHypothetical(lastAssistantContent)) &&
      looksLikeAssessableSupportAnswer(userText)
    ) {
      return 'm_support_need_recognition';
    }
    if (
      supportConditionalInTranscript ||
      supportNeedAlreadyPresent ||
      looksLikeMomentSupportConditionalProbe(lastAssistantContent)
    ) {
      if (
        looksLikeAssessableSupportAnswer(userText) ||
        looksLikeNeedRecognitionInSupportAnswer(userText)
      ) {
        return 'm5_conflict';
      }
    }
  }

  return null;
}
