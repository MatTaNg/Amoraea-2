import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import { deliverScenario1VignetteAfterReadinessAssent } from '@features/aria/deliverScenario1AfterReadinessAssent';
import type { PostClaudeNaturalLanguageClosingHandoffEval } from '@features/aria/evaluatePostClaudeNaturalLanguageClosingHandoff';
import {
  isInterviewClosingReflectiveAckFragment,
  isInterviewClosingThanksFragment,
  stripDuplicateInterviewClosingSentencesWithinDraft,
} from '@features/aria/elongatingProbe';
import { hasInterviewClosingTtsDeliveredForSession } from '@features/aria/interviewClosingTtsSession';
import { finalizePostClaudePendingInterviewCompletion, markPostClaudeInterviewCompletionState } from '@features/aria/finalizePostClaudePendingInterviewCompletion';
import { resolveInterviewTranscriptForCompletionScoring } from '@features/aria/resolveInterviewTranscriptForCompletionScoring';
import { isInterviewPreambleBriefingMoment } from '@features/aria/interviewLanguageGate';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
} from '@features/aria/postClaudeAssistantTurnTypes';
import type { PostClaudeNaturalLanguageTranscriptPersistResult } from '@features/aria/persistPostClaudeNaturalLanguageTranscriptTurn';
import {
  handlePostClaudePendingBundledHandoffSpeak,
  speakPostClaudeNaturalLanguageEmotionTransition,
} from '@features/aria/speakPostClaudeNaturalLanguageEmotionTransition';
import {
  coerceInterviewAssistantDraftForSpeak,
  isGenericTruncatedAssistantDraft,
  spokenTextMissesCoercedAssistantDraft,
} from '@features/aria/interviewTruncatedAssistantDraft';
import {
  looksLikeScenarioARepairQuestion,
  looksLikeScenarioARepairStreamFragment,
  shouldSuppressScenarioARepairBeforeContemptAnswer,
  spokenTextContainsScenarioARepairQuestion,
} from '@features/aria/interviewDisengagementProbes';
import { SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY } from '@features/aria/probeAndScoringUtils';
import { parallelStreamDeliveredBundledHandoffViaCanonicalCard } from '@features/aria/showScenarioCardCanonicalTts';
import {
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBQ1Question,
  looksLikeScenarioBRepairAsJamesQuestion,
  scenarioBJamesRepairProbeAlreadySatisfied,
  shouldSuppressPrematureScenarioBJamesQ2Coercion,
  streamMissedScenarioBScriptedProbeDelivery,
} from '@features/aria/scenarioBProbeLogic';
import { isScenarioABoundaryReflectionWithoutNextVignette } from '@features/aria/scenarioAContemptProbeTextMatch';
import { isActiveScenarioAConstructProbeTurn } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { textContainsScenarioBVignetteBody, textContainsScenarioCVignetteBody } from '@features/aria/emotionScenarioTransitionInference';
import { streamMissedScenarioARepairSatisfiedHandoffDelivery } from '@features/aria/interviewDisengagementProbes';
import { remoteLog } from '@utilities/remoteLog';

export type PostClaudeNaturalLanguageSpeakAndCompleteArgs = {
  deps: PostClaudeAssistantTurnDeps;
  params: PostClaudeAssistantTurnParams;
  parallelStreamingPlaybackUsed: boolean;
  displayText: string;
  transcript: PostClaudeNaturalLanguageTranscriptPersistResult;
  closingHandoff: PostClaudeNaturalLanguageClosingHandoffEval;
  speakAssistantTurn: PostClaudeSpeakAssistantTurn;
};

/** Bundled handoff speak, emotion transitions, closing TTS, and M5 failsafe completion. */
export async function runPostClaudeNaturalLanguageSpeakAndComplete(
  args: PostClaudeNaturalLanguageSpeakAndCompleteArgs,
): Promise<void> {
  const {
    deps,
    params,
    parallelStreamingPlaybackUsed,
    displayText,
    transcript,
    closingHandoff,
    speakAssistantTurn,
  } = args;
  const {
    priorScenarioNum,
    pendingBundledHandoff,
    assistantContentToPersist,
    aiMsg,
    skipDuplicatePreambleAppend,
    updatedMessages,
    emotionSplit,
    deferEmotionModal,
    emotionCompletedScenario,
    emotionNaturalForward,
    emotionNaturalS3ToM4,
    detectedScenario,
  } = transcript;
  const {
    closingCandidate,
    closingLooksFinal,
    streamClosingAlreadyDelivered,
    shouldFailsafeComplete,
    streamSpokeClosingThankYou,
    streamSpokeIncompleteClosingOnly,
    effectiveSkipClosingSpeak,
    mustRunEmotionTransitionPath,
  } = closingHandoff;
  const closingTtsSessionKey =
    deps.interviewSessionAttemptIdRef.current ?? deps.interviewSessionIdRef.current;

  const coercedDisplayText = coerceInterviewAssistantDraftForSpeak(displayText, {
    interviewMoment: deps.currentInterviewMomentRef.current,
    currentScenario: deps.currentScenarioRef.current,
    firstName: params.participantFirstNameForSpoken,
    messages: updatedMessages,
  });
  if (coercedDisplayText !== displayText.trim()) {
    void remoteLog('[ASSISTANT_DRAFT_TRUNCATION_COERCED_BEFORE_SPEAK]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      interviewMoment: deps.currentInterviewMomentRef.current,
      beforePreview: displayText.slice(0, 160),
      afterPreview: coercedDisplayText.slice(0, 160),
    });
  }

  if (
    pendingBundledHandoff &&
    deferEmotionModal &&
    emotionSplit.afterModal.trim()
  ) {
    const completedForDeferred =
      emotionCompletedScenario ??
      (detectedScenario != null && detectedScenario > priorScenarioNum
        ? ((detectedScenario - 1) as 1 | 2 | 3)
        : priorScenarioNum);
    deps.pendingEmotionModalTransitionRef.current = {
      completedScenario: completedForDeferred,
      afterModal: emotionSplit.afterModal,
      transitionText: coercedDisplayText,
      priorScenario: priorScenarioNum,
    };
  }

  if (
    await handlePostClaudePendingBundledHandoffSpeak(deps, speakAssistantTurn, {
      pendingBundledHandoff,
      parallelStreamingPlaybackUsed,
      assistantContentToPersist,
      streamSpokenCompleteText: deps.parallelStreamingTtsRef.current.spokenCompleteText,
      currentInterviewMoment: deps.currentInterviewMomentRef.current,
    })
  ) {
    // #region agent log
    fetch('http://127.0.0.1:7668/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'28d27a'},body:JSON.stringify({sessionId:'28d27a',location:'runPostClaudeNaturalLanguageSpeakAndComplete.ts:bundled_early_return',message:'bundled_handoff_early_return',data:{pendingBundledHandoff,deferEmotionModal,hasPendingEmotion:!!deps.pendingEmotionModalTransitionRef.current},timestamp:Date.now(),hypothesisId:'H3'})}).catch(()=>{});
    // #endregion
    return;
  }

  if (!effectiveSkipClosingSpeak || mustRunEmotionTransitionPath) {
    if (emotionNaturalForward) {
      await speakPostClaudeNaturalLanguageEmotionTransition(deps, updatedMessages, speakAssistantTurn, {
        displayText: coercedDisplayText,
        priorScenarioNum,
        emotionSplit,
        deferEmotionModal,
        aiMsg,
        scenarioJustCompleted: emotionCompletedScenario ?? priorScenarioNum,
      });
    } else if (emotionNaturalS3ToM4) {
      await speakPostClaudeNaturalLanguageEmotionTransition(deps, updatedMessages, speakAssistantTurn, {
        displayText: coercedDisplayText,
        priorScenarioNum,
        emotionSplit,
        deferEmotionModal,
        aiMsg,
        scenarioJustCompleted: 3,
      });
    } else if (!effectiveSkipClosingSpeak) {
      const streamSpokeText = deps.parallelStreamingTtsRef.current.spokenCompleteText.trim();
      const streamSpokeIncompleteClosingOnlyLocal =
        streamSpokeIncompleteClosingOnly ||
        (parallelStreamingPlaybackUsed &&
          !!streamSpokeText &&
          !streamSpokeClosingThankYou &&
          !params.textToParallelStream.closingSpoken &&
          (isInterviewClosingReflectiveAckFragment(streamSpokeText) ||
            (/\bwhat stood out to me\b/i.test(streamSpokeText) &&
              !isInterviewClosingThanksFragment(streamSpokeText))));
      if (
        (shouldFailsafeComplete &&
          (closingLooksFinal || streamSpokeIncompleteClosingOnlyLocal) &&
          parallelStreamingPlaybackUsed &&
          !streamClosingAlreadyDelivered &&
          !hasInterviewClosingTtsDeliveredForSession(closingTtsSessionKey) &&
          !params.textToParallelStream.closingSpoken &&
          !streamSpokeClosingThankYou) ||
        (streamSpokeIncompleteClosingOnlyLocal &&
          !hasInterviewClosingTtsDeliveredForSession(closingTtsSessionKey) &&
          !params.textToParallelStream.closingSpoken)
      ) {
        const dedupedClosing = stripDuplicateInterviewClosingSentencesWithinDraft(closingCandidate);
        if (dedupedClosing.trim()) {
          await speakAssistantTurn(dedupedClosing, {
            ...ASSISTANT_INTERVIEW_SPEECH,
            forceSpeakDespiteParallelStream: true,
          });
          params.textToParallelStream.closingSpoken = true;
        }
      } else if (skipDuplicatePreambleAppend && isInterviewPreambleBriefingMoment(displayText)) {
        void remoteLog('[PREAMBLE_BRIEFING_TTS_SKIPPED_DUPLICATE]', {
          interviewSessionId: deps.interviewSessionIdRef.current,
          preview: displayText.slice(0, 220),
        });
        const deliveredScenario1 = await deliverScenario1VignetteAfterReadinessAssent(
          deps,
          params.trimmed,
          updatedMessages,
          params.participantFirstNameForSpoken,
          'post_claude_preamble_skip',
        );
        if (!deliveredScenario1) {
          deps.setVoiceState('idle');
        }
      } else {
        const streamSpokeTextEarly = deps.parallelStreamingTtsRef.current.spokenCompleteText.trim();
        const jamesCoerceCtx = {
          messages: updatedMessages,
          interviewMoment: deps.currentInterviewMomentRef.current,
          streamSpokeS2Opening:
            textContainsScenarioBVignetteBody(streamSpokeTextEarly) ||
            looksLikeScenarioBQ1Question(streamSpokeTextEarly),
          s2CanonicalPlaybackConfirmed:
            deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current?.situation_2 === true,
        };
        const suppressPrematureJamesQ2Speak =
          shouldSuppressPrematureScenarioBJamesQ2Coercion(jamesCoerceCtx) &&
          (looksLikeScenarioBJamesDifferentlyQuestion(coercedDisplayText) ||
            isScenarioABoundaryReflectionWithoutNextVignette(coercedDisplayText));
        const suppressRepairRespeakBeforeContempt =
          shouldSuppressScenarioARepairBeforeContemptAnswer({
            currentScenario: deps.currentScenarioRef.current,
            currentMoment: deps.currentInterviewMomentRef.current,
            shouldForceScenarioAContemptProbe: params.shouldForceScenarioAContemptProbe,
            scenarioAContemptProbeSpokenThisStream: params.textToParallelStream.spokenStarted,
            scenarioAContemptProbeAsked: deps.scenarioAContemptProbeAskedRef.current,
            specificEmmaLineAlreadyAddressed: params.specificEmmaLineAlreadyAddressed,
            scenarioARepairQuestionAsked: deps.scenarioARepairQuestionAskedRef.current,
            allowScenarioARepairAfterContemptAnswer: params.allowScenarioARepairAfterContemptAnswer,
          }) && looksLikeScenarioARepairStreamFragment(coercedDisplayText);
        const suppressRepairRespeakAfterStreamDelivered =
          isActiveScenarioAConstructProbeTurn(
            deps.currentScenarioRef.current,
            deps.currentInterviewMomentRef.current,
          ) &&
          spokenTextContainsScenarioARepairQuestion(streamSpokeTextEarly) &&
          (coercedDisplayText.trim() === SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY ||
            looksLikeScenarioARepairQuestion(coercedDisplayText) ||
            looksLikeScenarioARepairStreamFragment(coercedDisplayText));
        const streamMissedScenarioBProbe = streamMissedScenarioBScriptedProbeDelivery(
          streamSpokeTextEarly,
          coercedDisplayText,
          jamesCoerceCtx,
        );
        const streamMissedS1Handoff = streamMissedScenarioARepairSatisfiedHandoffDelivery(
          streamSpokeTextEarly,
          coercedDisplayText,
          updatedMessages,
          deps.currentInterviewMomentRef.current,
        );
        const s2RepairAlreadySatisfied = scenarioBJamesRepairProbeAlreadySatisfied(updatedMessages);
        const suppressS2ProbeRespeakAfterSatisfiedRepair =
          s2RepairAlreadySatisfied &&
          (looksLikeScenarioBJamesDifferentlyQuestion(coercedDisplayText) ||
            looksLikeScenarioBRepairAsJamesQuestion(coercedDisplayText));
        if (suppressS2ProbeRespeakAfterSatisfiedRepair) {
          void remoteLog('[S2_PROBE_RESPEAK_SUPPRESSED_REPAIR_SATISFIED]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            streamSpokePreview: streamSpokeTextEarly.slice(0, 160),
            coercedPreview: coercedDisplayText.slice(0, 160),
          });
        }
        const showScenarioHandoffDeliveredViaCanonical =
          parallelStreamDeliveredBundledHandoffViaCanonicalCard(
            deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current ?? {},
            coercedDisplayText,
          );
        const suppressS3RespeakAfterCanonical =
          textContainsScenarioCVignetteBody(coercedDisplayText) &&
          deps.showScenarioCardCanonicalPlaybackConfirmedKindsRef?.current?.situation_3 === true;
        const needsRespeakAfterTruncation =
          !suppressS2ProbeRespeakAfterSatisfiedRepair &&
          !suppressRepairRespeakBeforeContempt &&
          !suppressRepairRespeakAfterStreamDelivered &&
          !showScenarioHandoffDeliveredViaCanonical &&
          !suppressS3RespeakAfterCanonical &&
          coercedDisplayText.trim().length > 0 &&
          (spokenTextMissesCoercedAssistantDraft(streamSpokeTextEarly, coercedDisplayText) ||
            streamMissedScenarioBProbe ||
            streamMissedS1Handoff);
        if (suppressRepairRespeakBeforeContempt) {
          void remoteLog('[S1_REPAIR_RESPEAK_SUPPRESSED_AFTER_CONTEMPT_STREAM]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            streamSpokePreview: streamSpokeTextEarly.slice(0, 160),
            coercedPreview: coercedDisplayText.slice(0, 160),
            s1ContemptFixVersion: 22,
          });
        }
        if (suppressRepairRespeakAfterStreamDelivered) {
          void remoteLog('[S1_REPAIR_RESPEAK_SUPPRESSED_AFTER_STREAM_PARAPHRASE]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            streamSpokePreview: streamSpokeTextEarly.slice(0, 160),
            coercedPreview: coercedDisplayText.slice(0, 160),
            s1ContemptFixVersion: 25,
          });
        }
        if (suppressPrematureJamesQ2Speak) {
          void remoteLog('[S2_PREMATURE_JAMES_Q2_SPEAK_SUPPRESSED]', {
            interviewSessionId: deps.interviewSessionIdRef.current,
            streamSpokePreview: streamSpokeTextEarly.slice(0, 160),
            coercedPreview: coercedDisplayText.slice(0, 160),
            s2CanonicalPlaybackConfirmed: jamesCoerceCtx.s2CanonicalPlaybackConfirmed,
          });
          deps.setVoiceState('idle');
        } else if (needsRespeakAfterTruncation) {
          await speakAssistantTurn(coercedDisplayText, {
            ...ASSISTANT_INTERVIEW_SPEECH,
            forceSpeakDespiteParallelStream: true,
          });
        } else {
          const forceSpeakMissedScenarioBProbe =
            parallelStreamingPlaybackUsed &&
            streamMissedScenarioBProbe &&
            !suppressS2ProbeRespeakAfterSatisfiedRepair;
          const forceSpeakMissedS1Handoff =
            parallelStreamingPlaybackUsed && streamMissedS1Handoff;
          if (forceSpeakMissedScenarioBProbe) {
            void remoteLog('[S2_B_PROBE_POST_CLAUDE_FORCE_SPEAK]', {
              interviewSessionId: deps.interviewSessionIdRef.current,
              streamSpokePreview: streamSpokeTextEarly.slice(0, 160),
              coercedPreview: coercedDisplayText.slice(0, 160),
            });
          }
          if (forceSpeakMissedS1Handoff) {
            void remoteLog('[S1_HANDOFF_POST_CLAUDE_FORCE_SPEAK]', {
              interviewSessionId: deps.interviewSessionIdRef.current,
              streamSpokePreview: streamSpokeTextEarly.slice(0, 160),
              coercedPreview: coercedDisplayText.slice(0, 160),
            });
          }
          if (suppressS2ProbeRespeakAfterSatisfiedRepair) {
            deps.setVoiceState('idle');
          } else {
            await speakAssistantTurn(coercedDisplayText, {
              ...ASSISTANT_INTERVIEW_SPEECH,
              ...(forceSpeakMissedScenarioBProbe || forceSpeakMissedS1Handoff
                ? { forceSpeakDespiteParallelStream: true }
                : {}),
            });
          }
        }
      }
    }
  }

  if (shouldFailsafeComplete) {
    const closingThankYouAudible =
      streamSpokeClosingThankYou ||
      streamClosingAlreadyDelivered ||
      hasInterviewClosingTtsDeliveredForSession(closingTtsSessionKey);
    if (!closingThankYouAudible && closingCandidate.trim()) {
      const dedupedClosing = stripDuplicateInterviewClosingSentencesWithinDraft(closingCandidate);
      if (dedupedClosing.trim()) {
        await speakAssistantTurn(dedupedClosing, {
          ...ASSISTANT_INTERVIEW_SPEECH,
          forceSpeakDespiteParallelStream: true,
        });
        params.textToParallelStream.closingSpoken = true;
      }
    }
    void deps.persistInterviewAttemptSessionLifecycle(deps.interviewSessionAttemptIdRef.current, 'completed');
    markPostClaudeInterviewCompletionState(deps);
    deps.setVoiceState('idle');
    const transcriptForScoring = resolveInterviewTranscriptForCompletionScoring(
      deps.currentMessagesRef.current,
      updatedMessages,
    );
    await finalizePostClaudePendingInterviewCompletion(deps, {
      source: 'closing_failsafe',
      transcriptForScoring,
      persistSessionLifecycle: false,
      markCompletionState: false,
      setVoiceIdle: false,
    });
  }
}
