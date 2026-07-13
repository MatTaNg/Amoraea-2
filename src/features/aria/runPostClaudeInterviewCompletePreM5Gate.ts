import { sanitizeAssistantInterviewerCharacterNames } from '@/constants/interviewCharacterNames';
import {
  isMoment5ReadyForInterviewClose,
} from '@features/aria/elongatingProbe';
import {
  dedupeAdjacentBoundaryValidationsBeforeParticipantName,
  ensureSpokenTextIncludesParticipantFirstName,
} from '@features/aria/interviewerFrameworkPrompt';
import { buildMoment4ThresholdAnswerToMoment5Bundle } from '@features/aria/interviewTransitionBundles';
import {
  extractLeadingReflectionFromMoment5HandoffBundle,
  registerDeliveredReflection,
} from '@features/aria/deliveredReflectionRegistry';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
} from '@features/aria/postClaudeAssistantTurnTypes';
import {
  MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
  combineMoment5UserTurnText,
  evaluateMoment5AccountabilityProbe,
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
} from '@features/aria/probeAndScoringUtils';
import {
  computeMoment5ResolutionFollowUpGateState,
  countUserTurnsAfterLastMoment5PrimaryAnchor,
} from '@features/aria/interviewProgressSync';
import { remoteLog } from '@utilities/remoteLog';

export type PostClaudeInterviewCompletePreM5GateResult = {
  text: string;
  rawApiHadInterviewComplete: boolean;
};

/**
 * Strip or recover premature `[INTERVIEW_COMPLETE]` before Moment 5 close gates pass.
 */
export async function runPostClaudeInterviewCompletePreM5Gate(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  rawText: string,
): Promise<PostClaudeInterviewCompletePreM5GateResult> {
  let text = rawText.trim();
  const rawApiHadInterviewComplete = text.includes('[INTERVIEW_COMPLETE]');
  if (
    !text.includes('[INTERVIEW_COMPLETE]') ||
    !deps.isInterviewAppRoute ||
    deps.isAdmin ||
    deps.status !== 'active'
  ) {
    return { text, rawApiHadInterviewComplete };
  }

  const transcriptSlice = params.messagesToUse.map((m) => ({
    role: m.role,
    content: (m as { content?: string }).content ?? '',
    isWelcomeBack: (m as { isWelcomeBack?: boolean }).isWelcomeBack,
  }));
  const postM5UserTurnsFromTranscript = countUserTurnsAfterLastMoment5PrimaryAnchor(
    transcriptSlice,
    deps.moment5PrimaryAnchorDeliveredSessionRef.current,
  );
  const hasMoment5PrimaryAnchorInTranscript =
    deps.moment5PrimaryAnchorDeliveredSessionRef.current ||
    transcriptSlice.some(
      (m) =>
        m.role === 'assistant' &&
        !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
        transcriptAssistantContainsMoment5PrimaryConflictQuestion(m.content),
    ) ||
    transcriptAssistantContainsMoment5PrimaryConflictQuestion(text);
  const postM5UserTurns = Math.max(deps.moment5PostPromptUserTurnCountRef.current, postM5UserTurnsFromTranscript);
  const moment5CombinedForCloseGate = combineMoment5UserTurnText(
    params.messagesToUse.filter((m) => !(m as { isWelcomeBack?: boolean }).isWelcomeBack) as Array<{
      role: string;
      content?: string;
    }>,
  );
  const accountabilityProbeStillRequired =
    (deps.moment5QuestionDeliveredRef.current || hasMoment5PrimaryAnchorInTranscript) &&
    !deps.moment5AccountabilityProbeFiredRef.current &&
    evaluateMoment5AccountabilityProbe(moment5CombinedForCloseGate).shouldProbe;
  const {
    resolutionFollowUpStillRequired,
  } = computeMoment5ResolutionFollowUpGateState({
    transcriptSlice,
    moment5CombinedForCloseGate,
    hasMoment5PrimaryAnchorInTranscript,
    moment5ResolutionDelivered: deps.moment5ResolutionDeliveredRef.current,
  });
  const moment5CloseAllowed = isMoment5ReadyForInterviewClose({
    currentInterviewMoment: deps.currentInterviewMomentRef.current,
    moment5QuestionDelivered: deps.moment5QuestionDeliveredRef.current,
    postM5UserTurns,
    accountabilityProbeFired: deps.moment5AccountabilityProbeFiredRef.current,
    hasMoment5PrimaryAnchorInTranscript,
    moment5CombinedUserText: moment5CombinedForCloseGate,
    accountabilityProbeStillRequired,
    resolutionFollowUpStillRequired,
  });
  if (moment5CloseAllowed) {
    return { text, rawApiHadInterviewComplete };
  }

  void remoteLog('[INTERVIEW_COMPLETE_STRIPPED_PRE_M5_GATE]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    moment: deps.currentInterviewMomentRef.current,
    m5Delivered: deps.moment5QuestionDeliveredRef.current,
    m5PrimaryAnchorSession: deps.moment5PrimaryAnchorDeliveredSessionRef.current,
    postM5UserTurnsRef: deps.moment5PostPromptUserTurnCountRef.current,
    postM5UserTurnsFromTranscript,
    postM5UserTurnsEffective: postM5UserTurns,
    accountabilityProbeFired: deps.moment5AccountabilityProbeFiredRef.current,
    accountabilityProbeStillRequired,
    resolutionFollowUpStillRequired,
    hasMoment5PrimaryAnchorInTranscript,
  });
  text = text.replace(/\[INTERVIEW_COMPLETE\]/gi, '').trim();
  if (
    deps.moment4ThresholdProbeAskedRef.current &&
    !deps.moment5QuestionDeliveredRef.current &&
    !deps.moment5QuestionDeliveryInFlightRef.current &&
    !hasMoment5PrimaryAnchorInTranscript
  ) {
    deps.moment5QuestionDeliveryInFlightRef.current = true;
    const lastUserAnswer = [...params.messagesToUse].reverse().find((m) => m.role === 'user')?.content ?? null;
    const m5Raw = buildMoment4ThresholdAnswerToMoment5Bundle(
      params.participantFirstNameForSpoken,
      MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
      typeof lastUserAnswer === 'string' ? lastUserAnswer : null,
      { deliveredRegistry: deps.deliveredReflectionRegistryRef.current },
    );
    const m5Display = dedupeAdjacentBoundaryValidationsBeforeParticipantName(
      sanitizeAssistantInterviewerCharacterNames(m5Raw),
      params.participantFirstNameForSpoken,
    );
    const m5Spoken = ensureSpokenTextIncludesParticipantFirstName(m5Display, params.participantFirstNameForSpoken, {
      allowAppendWhenMissing: true,
    });
    const lead = text.trim();
    text = lead ? `${lead}\n\n${m5Spoken}` : m5Spoken;
    deps.currentInterviewMomentRef.current = 5;
    deps.moment5QuestionDeliveredRef.current = true;
    deps.moment5PrimaryAnchorDeliveredSessionRef.current = true;
    try {
      if (params.textToParallelStream.spokenStarted) {
        await deps.speakTextSafe(m5Spoken, ASSISTANT_INTERVIEW_SPEECH);
        const deliveredReflection = extractLeadingReflectionFromMoment5HandoffBundle(m5Spoken);
        if (deliveredReflection) {
          registerDeliveredReflection(
            deps.deliveredReflectionRegistryRef,
            'm4_threshold_to_m5',
            deliveredReflection,
            {
              interviewSessionId: deps.interviewSessionIdRef.current,
              source: 'post_claude_interview_complete_pre_m5',
            },
          );
        }
      }
    } finally {
      deps.moment5QuestionDeliveryInFlightRef.current = false;
    }
  }

  return { text, rawApiHadInterviewComplete };
}
