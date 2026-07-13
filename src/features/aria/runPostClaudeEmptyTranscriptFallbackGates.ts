import { finalizePostClaudePendingInterviewCompletion, markPostClaudeInterviewCompletionState } from '@features/aria/finalizePostClaudePendingInterviewCompletion';
import { sanitizePostClaudeClosingDisplayText } from '@features/aria/sanitizePostClaudeClosingDisplayText';
import { S1_CONTEMPT_FIX_VERSION } from '@features/aria/interviewAdminConfig';
import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import {
  buildNeutralAckAfterSuppressedElongatingProbe,
  isMoment5ReadyForInterviewClose,
  looksLikeInterviewClosingAssistantMessage,
  moment5AnswerIncludesResolutionOutcome,
  parallelStreamDeliveredMoment5ClosingAttempt,
  stripDuplicateInterviewClosingSentencesWithinDraft,
  transcriptHasInterviewClosingAssistantMessage,
} from '@features/aria/elongatingProbe';
import { hasInterviewClosingTtsDeliveredForSession } from '@features/aria/interviewClosingTtsSession';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { assistantTurnHasPersistableContent } from '@features/aria/interviewTranscriptTurns';
import { computeMoment5InterviewCloseGate, computeMoment5ResolutionFollowUpGateState, countUserTurnsAfterLastMoment5PrimaryAnchor } from '@features/aria/interviewProgressSync';
import { buildMoment5InterviewClosingBundle, enrichPersonalMomentClosingForTts } from '@features/aria/personalMomentClosingEnrichment';
import { deriveClosingPillarContextFromScenarioScores } from '@features/aria/closingReflectionGrounding';
import { extractMoment5AnswerForClosingReflection } from '@features/aria/moment5TranscriptHelpers';
import {
  isPersonalMomentInterviewTurn,
  resolveScenarioFollowUpAfterSuppressedResponse,
} from '@features/aria/personalDisclosureAckGate';
import {
  SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
  combineMoment5UserTurnText,
  evaluateMoment5AccountabilityProbe,
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
} from '@features/aria/probeAndScoringUtils';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';
import {
  looksLikeScenarioARepairQuestionLoose,
  scenarioAMinimumEngagementForHandoff,
  shouldDeliverScenarioFollowUpQuestion,
  transcriptContainsScenarioAContemptProbe,
} from '@features/aria/scenarioFollowUpTranscriptGuard';
import { MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import { SCENARIO_2_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import { buildScenario1To2BundleForInterview } from '@features/aria/interviewTransitionBundles';
import { applyPostClaudeScenarioAdvanceBundleOverride, resolveScenarioUserTextForBoundaryReflection } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import { shouldAdvanceScenarioAAfterSatisfiedRepair } from '@features/aria/interviewDisengagementProbes';
import { hasScenarioBoundaryWrapPhrase } from '@features/aria/emotionModalTransitionOrchestration';
import { textContainsScenarioBVignetteBody } from '@features/aria/emotionScenarioTransitionInference';
import { ALPHA_MODE } from '@features/aria/scoreInterviewModuleConstants';
import {
  compactInterviewTranscriptTurns,
  resolveStagedAssistantPersistContent,
} from '@features/aria/interviewTranscriptDedup';
import { resolveInterviewTranscriptForCompletionScoring } from '@features/aria/resolveInterviewTranscriptForCompletionScoring';
import { remoteLog } from '@utilities/remoteLog';

function commitStreamDeliveredScenarioAContemptProbeIfMissing(
  deps: PostClaudeAssistantTurnDeps,
  messagesToUse: PostClaudeInterviewMessage[],
): PostClaudeInterviewMessage[] | null {
  if (!deps.scenarioAContemptProbeAskedRef.current) return null;
  const live = deps.currentMessagesRef.current as PostClaudeInterviewMessage[];
  if (transcriptContainsScenarioAContemptProbe(live)) return null;
  const probePersistText = resolveStagedAssistantPersistContent(
    live,
    messagesToUse,
    SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY,
  );
  if (!shouldDeliverScenarioFollowUpQuestion(live, probePersistText)) return null;
  const updated = compactInterviewTranscriptTurns([
    ...live,
    { role: 'assistant', content: probePersistText, scenarioNumber: 1 },
  ]);
  deps.commitInterviewMessages(updated);
  return updated;
}

export type PostClaudeEmptyTranscriptFallbackContext = {
  assistantTurnIsElongatingProbeOnly: boolean;
  shouldInjectScenarioARepairAfterContemptAnswer: boolean;
  assistantIssuedScenarioAContemptProbe: boolean;
  assistantIssuedScenarioBFullProbe: boolean;
  needsScenarioBJamesDifferentlyInsert: boolean;
  parallelStreamingPlaybackUsed: boolean;
  streamFullTrimmed: string;
};

function mapTranscriptSlice(messages: PostClaudeInterviewMessage[]) {
  return messages.map((m) => ({
    role: m.role,
    content: (m as { content?: string }).content ?? '',
    isWelcomeBack: (m as { isWelcomeBack?: boolean }).isWelcomeBack,
  }));
}

function resolveLiveTranscriptForScoring(
  deps: PostClaudeAssistantTurnDeps,
  messagesToUse: PostClaudeInterviewMessage[],
  extraAssistant?: PostClaudeInterviewMessage,
): PostClaudeInterviewMessage[] {
  const base = resolveInterviewTranscriptForCompletionScoring(
    deps.currentMessagesRef.current,
    messagesToUse,
  ) as PostClaudeInterviewMessage[];
  if (!extraAssistant) return base;
  return compactInterviewTranscriptTurns([...base, extraAssistant]) as PostClaudeInterviewMessage[];
}

export type PostClaudeEmptyTranscriptFallbackResult =
  | { handled: true }
  | { handled: false; text: string; displayText: string };

/**
 * When assistant draft has no persistable content: M5 close fallback, elongating-suppressed
 * scenario follow-ups, duplicate-closing handoff, stream-only closing, or early exit.
 */
export async function runPostClaudeEmptyTranscriptFallbackGates(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  ctx: PostClaudeEmptyTranscriptFallbackContext,
  text: string,
  displayText: string,
  speakAssistantTurn: PostClaudeSpeakAssistantTurn,
): Promise<PostClaudeEmptyTranscriptFallbackResult> {
  if (assistantTurnHasPersistableContent(displayText)) {
    return { handled: false, text, displayText };
  }

  void remoteLog('[TRANSCRIPT_EMPTY_ASSISTANT_SKIPPED]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    interviewMoment: deps.currentInterviewMomentRef.current,
    elongatingSuppressedForUserTurn: params.elongatingSuppressedForUserTurn,
    assistantTurnIsElongatingProbeOnly: ctx.assistantTurnIsElongatingProbeOnly,
    streamPreview: ctx.streamFullTrimmed.slice(0, 260),
    modelPreview: text.slice(0, 260),
  });
  if (ctx.parallelStreamingPlaybackUsed) {
    deps.parallelStreamingTtsRef.current.cancelRequested = true;
  }

  const transcriptSlice = mapTranscriptSlice(params.messagesToUse);
  const postM5UserTurnsForClose = Math.max(
    deps.moment5PostPromptUserTurnCountRef.current,
    countUserTurnsAfterLastMoment5PrimaryAnchor(
      transcriptSlice,
      deps.moment5PrimaryAnchorDeliveredSessionRef.current,
    ),
  );
  const moment5CombinedForSuppressedClose = combineMoment5UserTurnText(
    params.messagesToUse.filter((m) => !(m as { isWelcomeBack?: boolean }).isWelcomeBack) as Array<{
      role: string;
      content?: string;
    }>,
  );
  const hasMoment5PrimaryAnchorForSuppressedClose =
    deps.moment5PrimaryAnchorDeliveredSessionRef.current ||
    params.messagesToUse.some(
      (m) =>
        m.role === 'assistant' &&
        !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
        transcriptAssistantContainsMoment5PrimaryConflictQuestion(
          (m as { content?: string }).content ?? '',
        ),
    );
  const accountabilityProbeStillRequiredForClose =
    (deps.moment5QuestionDeliveredRef.current || hasMoment5PrimaryAnchorForSuppressedClose) &&
    !deps.moment5AccountabilityProbeFiredRef.current &&
    evaluateMoment5AccountabilityProbe(moment5CombinedForSuppressedClose).shouldProbe;
  const {
    resolutionFollowUpStillRequired: resolutionFollowUpStillRequiredForClose,
  } = computeMoment5ResolutionFollowUpGateState({
    transcriptSlice,
    moment5CombinedForCloseGate: moment5CombinedForSuppressedClose,
    hasMoment5PrimaryAnchorInTranscript: hasMoment5PrimaryAnchorForSuppressedClose,
    moment5ResolutionDelivered: deps.moment5ResolutionDeliveredRef.current,
  });
  const moment5CloseAfterSuppressedElongating =
    params.elongatingSuppressedForUserTurn &&
    isMoment5ReadyForInterviewClose({
      currentInterviewMoment: deps.currentInterviewMomentRef.current,
      moment5QuestionDelivered: deps.moment5QuestionDeliveredRef.current,
      postM5UserTurns: postM5UserTurnsForClose,
      accountabilityProbeFired: deps.moment5AccountabilityProbeFiredRef.current,
      hasMoment5PrimaryAnchorInTranscript: hasMoment5PrimaryAnchorForSuppressedClose,
      moment5CombinedUserText: moment5CombinedForSuppressedClose,
      accountabilityProbeStillRequired: accountabilityProbeStillRequiredForClose,
      resolutionFollowUpStillRequired: resolutionFollowUpStillRequiredForClose,
    });

  let nextText = text;
  let nextDisplayText = displayText;

  if (moment5CloseAfterSuppressedElongating) {
    nextText = buildMoment5InterviewClosingBundle(
      params.participantFirstNameForSpoken,
      extractMoment5AnswerForClosingReflection(params.messagesToUse),
      deriveClosingPillarContextFromScenarioScores(deps.scenarioScoresRef.current),
      { includeCompleteToken: true },
    );
    deps.parallelStreamingTtsRef.current.cancelRequested = true;
    void remoteLog('[ELONGATING_PROBE_SUPPRESSED_M5_CLOSE_FALLBACK]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      postM5UserTurns: postM5UserTurnsForClose,
      preview: nextText.slice(0, 200),
    });
  } else if (params.elongatingSuppressedForUserTurn) {
    if (
      ctx.shouldInjectScenarioARepairAfterContemptAnswer &&
      shouldDeliverScenarioFollowUpQuestion(params.messagesToUse, SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY)
    ) {
      nextDisplayText = SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
      void remoteLog('[S1_REPAIR_FALLBACK_AFTER_EMPTY_CONTEMPT_DUPLICATE]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        preview: nextDisplayText,
        s1ContemptFixVersion: 9,
      });
    } else if (
      params.muteParallelTtsForScenarioAContemptProbeStream &&
      deps.scenarioAContemptProbeAskedRef.current &&
      !deps.scenarioARepairQuestionAskedRef.current
    ) {
      const confirmedPlaybackExists = deps.scenarioAContemptProbePlaybackConfirmedRef.current;
      void remoteLog('[S1_CONTEMPT_DELIVERY_SKIP_POST_STREAM_FALLBACK]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        s1ContemptFixVersion: S1_CONTEMPT_FIX_VERSION,
        confirmedPlaybackExists,
        skipReason: confirmedPlaybackExists ? 'confirmed_delivered' : 'fallback_state_inconsistency',
      });
      if (!confirmedPlaybackExists) {
        void remoteLog('[S1_CONTEMPT_PROBE_REQUEUED_AFTER_STATE_INCONSISTENCY]', {
          interviewSessionId: deps.interviewSessionIdRef.current,
          s1ContemptFixVersion: S1_CONTEMPT_FIX_VERSION,
          preview: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY.slice(0, 200),
        });
        deps.scenarioAContemptProbeTtsDeliveredSessionRef.current = false;
        nextDisplayText = SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY;
      } else {
        const committedContempt = commitStreamDeliveredScenarioAContemptProbeIfMissing(
          deps,
          params.messagesToUse,
        );
        if (committedContempt) {
          params.messagesToUse = committedContempt;
          void remoteLog('[S1_CONTEMPT_PROBE_COMMITTED_AFTER_STREAM_ONLY]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: SCENARIO_A_CONTEMPT_PROBE_DELIVERED_COPY.slice(0, 200),
            s1ContemptFixVersion: 25,
          });
        }
        deps.setVoiceState('idle');
        return { handled: true };
      }
    } else if (
      params.shouldForceMoment4ThresholdProbe &&
      isPersonalMomentInterviewTurn(deps.currentInterviewMomentRef.current) &&
      !deps.moment4ThresholdProbeAskedRef.current
    ) {
      nextDisplayText = MOMENT_4_COMMITMENT_THRESHOLD_QUESTION_TEXT;
      void remoteLog('[M4_THRESHOLD_FALLBACK_AFTER_SUPPRESSED_ELONGATING]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        preview: nextDisplayText.slice(0, 200),
      });
    } else if (isPersonalMomentInterviewTurn(deps.currentInterviewMomentRef.current)) {
      nextDisplayText = buildNeutralAckAfterSuppressedElongatingProbe(params.participantFirstNameForSpoken);
      void remoteLog('[ELONGATING_PROBE_SUPPRESSED_NEUTRAL_ACK_FALLBACK]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        interviewMoment: deps.currentInterviewMomentRef.current,
        preview: nextDisplayText,
      });
    } else {
      const scenarioFollowUp = resolveScenarioFollowUpAfterSuppressedResponse({
        interviewMoment: deps.currentInterviewMomentRef.current,
        currentScenario: deps.currentScenarioRef.current,
        shouldForceScenarioAContemptProbe: params.shouldForceScenarioAContemptProbe,
        assistantIssuedScenarioAContemptProbe: ctx.assistantIssuedScenarioAContemptProbe,
        shouldInjectScenarioARepairAfterContemptAnswer: ctx.shouldInjectScenarioARepairAfterContemptAnswer,
        shouldForceScenarioBFullAppreciationProbe: params.shouldForceScenarioBFullAppreciationProbe,
        assistantIssuedScenarioBFullProbe: ctx.assistantIssuedScenarioBFullProbe,
        needsScenarioBJamesDifferentlyInsert: ctx.needsScenarioBJamesDifferentlyInsert,
        scenarioAContemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
        scenarioARepairQuestionAsked: deps.scenarioARepairQuestionAskedRef.current,
        transcriptMessages: params.messagesToUse,
        contemptProbeDeliveredThisTurn: deps.scenarioAContemptProbeAskedRef.current,
      });
      if (scenarioFollowUp) {
        if (!shouldDeliverScenarioFollowUpQuestion(params.messagesToUse, scenarioFollowUp)) {
          void remoteLog('[SCENARIO_FOLLOWUP_FALLBACK_SKIPPED_TRANSCRIPT_DEDUP]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            preview: scenarioFollowUp.slice(0, 200),
          });
          void remoteLog('[SCENARIO_SUPPRESSED_ELONGATING_NO_FALLBACK]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            interviewMoment: deps.currentInterviewMomentRef.current,
          });
          deps.setVoiceState('idle');
          return { handled: true };
        }
        nextDisplayText = scenarioFollowUp;
        void remoteLog('[SCENARIO_FOLLOWUP_FALLBACK_AFTER_SUPPRESSED_ELONGATING]', {
          interviewSessionId: deps.interviewSessionIdRef.current,
          interviewMoment: deps.currentInterviewMomentRef.current,
          preview: nextDisplayText.slice(0, 200),
        });
      } else if (
        deps.currentInterviewMomentRef.current === 1 &&
        (shouldAdvanceScenarioAAfterSatisfiedRepair(
          params.messagesToUse,
          '',
          deps.currentInterviewMomentRef.current,
        ) ||
          scenarioAMinimumEngagementForHandoff(params.messagesToUse))
      ) {
        nextText = `[SCENARIO_COMPLETE:1]\n\n${buildScenario1To2BundleForInterview(
          params.participantFirstNameForSpoken,
          SCENARIO_2_TEXT,
          resolveScenarioUserTextForBoundaryReflection(params.messagesToUse, 1),
        )}`;
        nextDisplayText = stripControlTokens(nextText);
        void remoteLog('[S1_REPAIR_SATISFIED_EMPTY_FALLBACK]', {
          interviewSessionId: deps.interviewSessionIdRef.current,
          preview: nextDisplayText.slice(0, 280),
        });
      } else if (
        deps.currentInterviewMomentRef.current === 1 &&
        deps.scenarioARepairQuestionAskedRef.current &&
        scenarioAMinimumEngagementForHandoff(params.messagesToUse) &&
        (hasScenarioBoundaryWrapPhrase(ctx.streamFullTrimmed) ||
          textContainsScenarioBVignetteBody(ctx.streamFullTrimmed) ||
          hasScenarioBoundaryWrapPhrase(text))
      ) {
        nextText = `[SCENARIO_COMPLETE:1]\n\n${buildScenario1To2BundleForInterview(
          params.participantFirstNameForSpoken,
          SCENARIO_2_TEXT,
          resolveScenarioUserTextForBoundaryReflection(params.messagesToUse, 1),
        )}`;
        nextDisplayText = stripControlTokens(nextText);
        void remoteLog('[S1_STREAM_HANDOFF_EMPTY_FALLBACK]', {
          interviewSessionId: deps.interviewSessionIdRef.current,
          preview: nextDisplayText.slice(0, 280),
        });
      } else {
        const advanceBundle = applyPostClaudeScenarioAdvanceBundleOverride(
          '',
          params.participantFirstNameForSpoken,
          params.messagesToUse,
          deps.currentInterviewMomentRef.current,
          deps.currentScenarioRef.current,
        );
        if (advanceBundle) {
          nextText = advanceBundle;
          nextDisplayText = stripControlTokens(advanceBundle);
          void remoteLog('[SCENARIO_ADVANCE_EMPTY_FALLBACK]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            interviewMoment: deps.currentInterviewMomentRef.current,
            preview: nextDisplayText.slice(0, 280),
          });
        } else {
          void remoteLog('[SCENARIO_SUPPRESSED_ELONGATING_NO_FALLBACK]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            interviewMoment: deps.currentInterviewMomentRef.current,
          });
          deps.setVoiceState('idle');
          return { handled: true };
        }
      }
    }
  } else if (transcriptHasInterviewClosingAssistantMessage(params.messagesToUse)) {
    void remoteLog('[INTERVIEW_CLOSING_DUPLICATE_SUPPRESSED_HANDOFF]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      postM5UserTurns: postM5UserTurnsForClose,
    });
    deps.setVoiceState('idle');
    const transcriptForScoring = resolveLiveTranscriptForScoring(deps, params.messagesToUse);
    await finalizePostClaudePendingInterviewCompletion(deps, {
      source: 'closing_duplicate_suppressed_handoff',
      transcriptForScoring,
      setVoiceIdle: false,
    });
    return { handled: true };
  } else if (
    ctx.parallelStreamingPlaybackUsed &&
    computeMoment5InterviewCloseGate(
      params.messagesToUse.map((m) => ({
        role: m.role,
        content: (m as { content?: string }).content ?? '',
        isWelcomeBack: (m as { isWelcomeBack?: boolean }).isWelcomeBack,
        interviewMoment: (m as { interviewMoment?: number }).interviewMoment,
      })),
      {
      moment5QuestionDelivered: deps.moment5QuestionDeliveredRef.current,
      moment5PrimaryAnchorSession: deps.moment5PrimaryAnchorDeliveredSessionRef.current,
      postM5UserTurnsRef: postM5UserTurnsForClose,
      accountabilityProbeFired: deps.moment5AccountabilityProbeFiredRef.current,
      currentInterviewMoment: deps.currentInterviewMomentRef.current,
      moment5ResolutionDelivered: deps.moment5ResolutionDeliveredRef.current,
    },
    ).moment5CloseAllowed &&
    parallelStreamDeliveredMoment5ClosingAttempt({
      spokenCompleteText: deps.parallelStreamingTtsRef.current.spokenCompleteText,
      streamFullText: stripControlTokens(params.textToParallelStream.full).trim(),
      closingSpokenInStream: params.textToParallelStream.closingSpoken,
    })
  ) {
    const streamClosingRaw = stripDuplicateInterviewClosingSentencesWithinDraft(
      stripControlTokens(params.textToParallelStream.full).trim() ||
        deps.parallelStreamingTtsRef.current.spokenCompleteText.trim(),
    );
    const enrichedClosing = enrichPersonalMomentClosingForTts(
      streamClosingRaw,
      params.participantFirstNameForSpoken,
      extractMoment5AnswerForClosingReflection(params.messagesToUse),
      deriveClosingPillarContextFromScenarioScores(deps.scenarioScoresRef.current),
    );
    void remoteLog('[M5_CLOSING_STREAM_ONLY_HANDOFF]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      preview: enrichedClosing.slice(0, 260),
      streamClosingRawPreview: streamClosingRaw.slice(0, 260),
      closingSpokenInStream: params.textToParallelStream.closingSpoken,
      streamDelivered: hasInterviewClosingTtsDeliveredForSession(
        deps.interviewSessionAttemptIdRef.current ?? deps.interviewSessionIdRef.current,
      ),
      streamSpokeIncompleteOnly: !looksLikeInterviewClosingAssistantMessage(streamClosingRaw),
    });
    deps.setVoiceState('idle');
    const streamClosingMsg: PostClaudeInterviewMessage = {
      role: 'assistant',
      content: enrichedClosing,
      scenarioNumber: 3,
      interviewMoment: 5,
    };
    const transcriptForScoring = resolveLiveTranscriptForScoring(
      deps,
      params.messagesToUse,
      streamClosingMsg,
    );
    deps.setMessages(transcriptForScoring);
    await finalizePostClaudePendingInterviewCompletion(deps, {
      source: 'closing_stream_only_handoff',
      transcriptForScoring,
      setVoiceIdle: false,
    });
    return { handled: true };
  } else if (
    deps.currentInterviewMomentRef.current === 1 &&
    shouldDeliverScenarioFollowUpQuestion(
      params.messagesToUse,
      SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
    ) &&
    (looksLikeScenarioARepairQuestionLoose(text) ||
      looksLikeScenarioARepairQuestionLoose(displayText) ||
      looksLikeScenarioARepairQuestionLoose(ctx.streamFullTrimmed))
  ) {
    nextDisplayText = SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
    void remoteLog('[S1_REPAIR_EMPTY_FALLBACK_AFTER_DEDUP_STRIP]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      preview: nextDisplayText.slice(0, 220),
      modelPreview: text.slice(0, 220),
    });
  } else {
    const advanceBundle = applyPostClaudeScenarioAdvanceBundleOverride(
      '',
      params.participantFirstNameForSpoken,
      params.messagesToUse,
      deps.currentInterviewMomentRef.current,
      deps.currentScenarioRef.current,
    );
    if (advanceBundle) {
      nextText = advanceBundle;
      nextDisplayText = stripControlTokens(advanceBundle);
      void remoteLog('[SCENARIO_ADVANCE_EMPTY_FALLBACK]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        interviewMoment: deps.currentInterviewMomentRef.current,
        preview: nextDisplayText.slice(0, 280),
      });
    } else {
      deps.setVoiceState('idle');
      return { handled: true };
    }
  }

  if (moment5CloseAfterSuppressedElongating && nextText.includes('[INTERVIEW_COMPLETE]')) {
    if (deps.isInterviewCompleteRef.current) {
      void remoteLog('[INTERVIEW_COMPLETE_DUPLICATE_SKIPPED]', {
        interviewSessionId: deps.interviewSessionIdRef.current,
        source: 'elongating_suppressed_m5_close_fallback',
        preview: nextText.slice(0, 200),
      });
      deps.setVoiceState('idle');
      return { handled: true };
    }
    void deps.persistInterviewAttemptSessionLifecycle(deps.interviewSessionAttemptIdRef.current, 'completed');
    await remoteLog('[0] INTERVIEW_COMPLETE token detected in response', {
      isAdmin: deps.isAdmin,
      ALPHA_MODE,
      userId: deps.userId ?? null,
      responseLength: nextText.length,
      interviewStatus: deps.interviewStatusRef.current,
      source: 'elongating_suppressed_m5_close_fallback',
    });
    markPostClaudeInterviewCompletionState(deps);
    const closingDisplay = sanitizePostClaudeClosingDisplayText(
      deps,
      params.messagesToUse,
      params.trimmed,
      nextText,
    );
    const finalAssistant: PostClaudeInterviewMessage = {
      role: 'assistant',
      content: closingDisplay,
      scenarioNumber: deps.resolveAssistantScenarioNumber(closingDisplay, params.messagesToUse),
    };
    const transcriptForScoring = resolveLiveTranscriptForScoring(
      deps,
      params.messagesToUse,
      finalAssistant,
    );
    deps.setMessages(transcriptForScoring);
    try {
      await speakAssistantTurn(closingDisplay, {
        telemetrySource: 'turn',
        interviewSpeechRole: 'assistant_response',
      });
    } catch {
      /* proceed to scoring even if TTS fails */
    } finally {
      deps.setVoiceState('idle');
    }
    await finalizePostClaudePendingInterviewCompletion(deps, {
      source: 'elongating_suppressed_m5_close',
      transcriptForScoring,
      persistSessionLifecycle: false,
      markCompletionState: false,
      emotionCatchUpSource: 'elongating_suppressed_m5_close_fallback',
    });
    return { handled: true };
  }

  return { handled: false, text: nextText, displayText: nextDisplayText };
}
