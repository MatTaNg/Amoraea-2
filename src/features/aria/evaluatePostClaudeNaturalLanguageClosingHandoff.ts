import {
  isInterviewClosingReflectiveAckFragment,
  isInterviewClosingThanksFragment,
  isLenientInterviewCloseAfterClosingSpeech,
  looksLikeInterviewClosingAssistantMessage,
  streamSpokeAudibleInterviewClosingContent,
  streamSpokeIncompleteInterviewClosingOnly,
  stripDuplicateInterviewClosingSentencesWithinDraft,
  transcriptHasInterviewClosingAssistantMessage,
} from '@features/aria/elongatingProbe';
import { combineMoment5UserTurnText, extractMoment5AnswerForClosingReflection } from '@features/aria/moment5TranscriptHelpers';
import { deriveClosingPillarContextFromScenarioScores } from '@features/aria/closingReflectionGrounding';
import { enrichPersonalMomentClosingForTts } from '@features/aria/personalMomentClosingEnrichment';
import { stripInternalReflectionSchemaLeak } from '@features/aria/interviewReflectionTextStrips';
import { moment5AssistantTurnAwaitingResolutionFollowUpAnswer } from '@features/aria/moment5SpecificityRedirect';
import {
  hasInterviewClosingSpeakInFlightForSession,
  hasInterviewClosingTtsDeliveredForSession,
} from '@features/aria/interviewClosingTtsSession';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import {
  computeMoment5InterviewCloseGate,
  type Moment5CloseGateSnapshot,
} from '@features/aria/interviewProgressSync';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';
import { remoteLog } from '@utilities/remoteLog';

export type PostClaudeNaturalLanguageClosingHandoffContext = {
  strippedText: string;
  parallelStreamingPlaybackUsed: boolean;
  rawApiHadInterviewComplete: boolean;
};

export type PostClaudeNaturalLanguageEmotionHandoffDiag = {
  priorScenarioNum: 1 | 2 | 3;
  detectedScenario: 1 | 2 | 3 | null;
  emotionNaturalForward: boolean;
  emotionCompletedScenario: 1 | 2 | 3 | null;
  scenarioHandoffTransition: boolean;
  emotionNaturalS3ToM4: boolean;
  deferEmotionModal: boolean;
  deferBlocked: boolean;
  hasAfterModal: boolean;
};

export type PostClaudeNaturalLanguageClosingHandoffEval = {
  closeGateForFailsafe: Moment5CloseGateSnapshot;
  closingCandidate: string;
  closingLooksFinal: boolean;
  streamClosingAlreadyDelivered: boolean;
  closingSpeakInFlight: boolean;
  lenientCloseReady: boolean;
  shouldFailsafeComplete: boolean;
  closingAlreadySpokenInTranscript: boolean;
  streamSpokeClosingThankYou: boolean;
  streamSpokeIncompleteClosingOnly: boolean;
  streamThankYouSpeakCount: number;
  skipClosingSpeak: boolean;
  effectiveSkipClosingSpeak: boolean;
  mustRunEmotionTransitionPath: boolean;
};

/** M5 closing failsafe + skip-closing-speak evaluation for the natural-language assistant path. */
export function evaluatePostClaudeNaturalLanguageClosingHandoff(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  ctx: PostClaudeNaturalLanguageClosingHandoffContext,
  displayText: string,
  updatedMessages: PostClaudeInterviewMessage[],
  emotionDiag: PostClaudeNaturalLanguageEmotionHandoffDiag,
): PostClaudeNaturalLanguageClosingHandoffEval {
  const closeGateForFailsafe = computeMoment5InterviewCloseGate(updatedMessages, {
    moment5QuestionDelivered: deps.moment5QuestionDeliveredRef.current,
    moment5PrimaryAnchorSession: deps.moment5PrimaryAnchorDeliveredSessionRef.current,
    postM5UserTurnsRef: deps.moment5PostPromptUserTurnCountRef.current,
    accountabilityProbeFired: deps.moment5AccountabilityProbeFiredRef.current,
    currentInterviewMoment: deps.currentInterviewMomentRef.current,
    moment5ResolutionDelivered: deps.moment5ResolutionDeliveredRef.current,
  });
  const rawClosing =
    displayText.trim() ||
    ctx.strippedText.trim() ||
    stripDuplicateInterviewClosingSentencesWithinDraft(
      stripControlTokens(params.textToParallelStream.full).trim(),
    );
  const sanitizedRawClosing = stripInternalReflectionSchemaLeak(rawClosing);
  const m5UserForClosing = extractMoment5AnswerForClosingReflection(updatedMessages);
  const closingCandidate = enrichPersonalMomentClosingForTts(
    sanitizedRawClosing,
    params.participantFirstNameForSpoken,
    m5UserForClosing,
    deriveClosingPillarContextFromScenarioScores(deps.scenarioScoresRef.current),
  );
  const closingLooksFinal = looksLikeInterviewClosingAssistantMessage(closingCandidate);
  const closingTtsSessionKey =
    deps.interviewSessionAttemptIdRef.current ?? deps.interviewSessionIdRef.current;
  const streamClosingAlreadyDelivered = hasInterviewClosingTtsDeliveredForSession(closingTtsSessionKey);
  const closingSpeakInFlight = hasInterviewClosingSpeakInFlightForSession(closingTtsSessionKey);
  const lenientCloseReady = isLenientInterviewCloseAfterClosingSpeech({
    closingText: closingCandidate,
    hasMoment5PrimaryAnchorInTranscript: closeGateForFailsafe.hasMoment5PrimaryAnchorInTranscript,
    postM5UserTurns: closeGateForFailsafe.postM5UserTurns,
    personalHandoffInjected: deps.personalHandoffInjectedRef.current,
    currentInterviewMoment: deps.currentInterviewMomentRef.current,
    moment5CloseAllowed: closeGateForFailsafe.moment5CloseAllowed,
  });
  const resolutionFollowUpAwaitingAnswer = moment5AssistantTurnAwaitingResolutionFollowUpAnswer({
    displayText,
    strippedText: ctx.strippedText,
    streamFullText: stripControlTokens(params.textToParallelStream.full).trim(),
    streamSpokenText: deps.parallelStreamingTtsRef.current.spokenCompleteText.trim(),
    messages: updatedMessages,
  });
  const streamSpokeIncompleteClosingOnly = streamSpokeIncompleteInterviewClosingOnly({
    parallelStreamingPlaybackUsed: ctx.parallelStreamingPlaybackUsed,
    spokenCompleteText: deps.parallelStreamingTtsRef.current.spokenCompleteText,
    closingSpokenInStream: params.textToParallelStream.closingSpoken,
  });
  const streamSpokeAudibleClosing = streamSpokeAudibleInterviewClosingContent(
    deps.parallelStreamingTtsRef.current.spokenCompleteText,
  );
  const streamThankYouSpeakCount =
    deps.parallelStreamingTtsRef.current.spokenCompleteText.match(
      /\bthank you for being so open with me\b/gi,
    )?.length ?? 0;
  const streamSpokeClosingThankYou = streamThankYouSpeakCount >= 1;
  const closingFlagMatchesAudibleClosing =
    params.textToParallelStream.closingSpoken &&
    (streamClosingAlreadyDelivered || streamSpokeClosingThankYou || streamSpokeAudibleClosing);
  const shouldFailsafeComplete =
    !resolutionFollowUpAwaitingAnswer &&
    !closeGateForFailsafe.resolutionFollowUpStillRequired &&
    !deps.isInterviewCompleteRef.current &&
    deps.isInterviewAppRoute &&
    !deps.isAdmin &&
    deps.status === 'active' &&
    (closingLooksFinal || streamSpokeIncompleteClosingOnly) &&
    (closeGateForFailsafe.moment5CloseAllowed ||
      lenientCloseReady ||
      streamClosingAlreadyDelivered ||
      closingFlagMatchesAudibleClosing ||
      streamSpokeIncompleteClosingOnly);
  void remoteLog('[M5_CLOSING_HANDOFF_EVAL]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
    closingLooksFinal,
    moment5CloseAllowed: closeGateForFailsafe.moment5CloseAllowed,
    lenientCloseReady,
    resolutionFollowUpAwaitingAnswer,
    streamClosingAlreadyDelivered,
    closingSpeakInFlight,
    closingSpokenInStream: params.textToParallelStream.closingSpoken,
    spokenStartedInStream: params.textToParallelStream.spokenStarted,
    preview: closingCandidate.slice(0, 220),
  });
  const closingAlreadySpokenInTranscript = transcriptHasInterviewClosingAssistantMessage(
    params.messagesToUse,
  );
  const closingMarkedSpokenInStream =
    params.textToParallelStream.closingSpoken &&
    (streamClosingAlreadyDelivered || streamSpokeAudibleClosing);
  const closingAlreadyAudibleViaTts =
    streamClosingAlreadyDelivered ||
    streamSpokeClosingThankYou ||
    closingMarkedSpokenInStream;
  const skipClosingSpeak =
    (shouldFailsafeComplete || closingLooksFinal) && closingAlreadyAudibleViaTts;
  if (shouldFailsafeComplete) {
    const candidateLooksThanks = isInterviewClosingThanksFragment(closingCandidate);
    const candidateLooksReflective = isInterviewClosingReflectiveAckFragment(closingCandidate);
    void remoteLog('[INTERVIEW_COMPLETE_CLOSING_FAILSAFE]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      moment5CloseAllowed: closeGateForFailsafe.moment5CloseAllowed,
      lenientCloseReady,
      rawApiHadInterviewComplete: ctx.rawApiHadInterviewComplete,
      accountabilityProbeStillRequired: closeGateForFailsafe.accountabilityProbeStillRequired,
      postM5UserTurns: closeGateForFailsafe.postM5UserTurns,
      closingAlreadySpokenInTranscript,
      closingSpokenInStream: params.textToParallelStream.closingSpoken,
      streamSpokeClosingThankYou,
      streamThankYouSpeakCount,
      spokenCompletePreview: deps.parallelStreamingTtsRef.current.spokenCompleteText.slice(0, 220),
      skipClosingSpeak,
      preview: closingCandidate.slice(0, 260),
      candidateLooksThanks,
      candidateLooksReflective,
    });
  }
  const parallelStreamClosingAlreadyAudible =
    ctx.parallelStreamingPlaybackUsed &&
    (streamClosingAlreadyDelivered ||
      streamSpokeClosingThankYou ||
      closingMarkedSpokenInStream);
  const effectiveSkipClosingSpeak = skipClosingSpeak || parallelStreamClosingAlreadyAudible;
  const mustRunEmotionTransitionPath =
    emotionDiag.emotionNaturalForward || emotionDiag.emotionNaturalS3ToM4;

  return {
    closeGateForFailsafe,
    closingCandidate,
    closingLooksFinal,
    streamClosingAlreadyDelivered,
    closingSpeakInFlight,
    lenientCloseReady,
    shouldFailsafeComplete,
    closingAlreadySpokenInTranscript,
    streamSpokeClosingThankYou,
    streamSpokeIncompleteClosingOnly,
    streamThankYouSpeakCount,
    skipClosingSpeak,
    effectiveSkipClosingSpeak,
    mustRunEmotionTransitionPath,
  };
}
