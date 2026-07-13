import * as preamble from '@features/aria/ariaInterviewScreenPreambleBindings';
import * as wiring from '@features/aria/ariaInterviewScreenWiringImports';
import type { MutableRefObject } from 'react';
import type { AriaInterviewBootEffectWiringParams } from '@features/aria/hooks/useAriaInterviewBootEffectWiring';
import type { useAriaInterviewSession } from '@features/aria/hooks/useAriaInterviewSession';
import type { AriaInterviewScreenSessionState } from '@features/aria/hooks/useAriaInterviewScreenSessionState';
import type { InterviewFirstNameProfile } from '@features/aria/interviewerFrameworkPrompt';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';

export type BuildAriaInterviewBootEffectWiringParamsFromScreenInput = {
  servicesBaseCtx: AriaInterviewDepsSyncContext;
  userId: string | undefined;
  userEmail: string | undefined | null;
  profile: InterviewFirstNameProfile | undefined;
  session: AriaInterviewScreenSessionState;
  interview: ReturnType<typeof useAriaInterviewSession>;
};

/** Assemble boot-effect wiring params from services base ctx + live shell/gate diagnostic refs. */
export function buildAriaInterviewBootEffectWiringParamsFromScreen(
  input: BuildAriaInterviewBootEffectWiringParamsFromScreenInput,
): AriaInterviewBootEffectWiringParams {
  const { servicesBaseCtx, userId, userEmail, profile, session, interview } = input;
  const { messages, status, currentMessagesRef, setMessages, setMicPermission } = interview;
  const { shell, gate, routing } = session;
  const { elongatingProbeFiredRef } = gate.metaSkip;
  const { transcriptScenarioLogCursorRef } = gate.resumeEmotion;
  const { currentInterviewMomentRef } = gate.moments;
  const { webTtsTabInterruptPendingReplayRef } = gate.webTts;
  const {
    scenarioAContemptProbeAskedRef,
    scenarioARepairQuestionAskedRef,
  } = gate.moments;
  const {
    isAdmin,
    interviewStatus,
    scenarioScores,
    scenarioScoresRef,
    pendingCompletion,
    pendingScoringSyncAttemptId,
    results,
    preInterviewConsentAge,
    preInterviewConsentData,
    setUsingMemoryFallback,
    lastAdminScoreCardCountRef,
    setReasoningProgress,
    setNetworkStatus,
    setIsAdmin,
    setUserEmail,
    scrollViewRef,
    lastQuestionTextRef,
  } = shell;
  const { isInterviewAppRoute, preparingHandoffPollTick } = routing;

  return {
    servicesBaseCtx,
    remoteLog: wiring.remoteLog,
    diagnostic: {
      elongatingProbeFiredRef,
      isApprovedElongatingProbeOnly: wiring.isApprovedElongatingProbeOnly,
      transcriptScenarioLogCursorRef,
      currentInterviewMomentRef,
      isMoment5AssistantAnchor: wiring.isMoment5AssistantAnchor,
      looksLikeMoment5AccountabilityProbeAssistantPrompt: wiring.looksLikeMoment5AccountabilityProbeAssistantPrompt,
      looksLikeMoment4ThresholdQuestion: wiring.looksLikeMoment4ThresholdQuestion,
      looksLikeMoment4SpecificityFollowUpPrompt: wiring.looksLikeMoment4SpecificityFollowUpPrompt,
      looksLikeMoment4GrudgePrompt: wiring.looksLikeMoment4GrudgePrompt,
      lastAdminScoreCardCountRef,
      messageLooksLikeScoreCard: preamble.messageLooksLikeScoreCard,
      setReasoningProgress,
      getResolvedSupabaseUrl: preamble.getResolvedSupabaseUrl,
      getResolvedSupabaseAnonKey: preamble.getResolvedSupabaseAnonKey,
      setNetworkStatus,
    },
    userId,
    isAdmin,
    userEmail: userEmail ?? undefined,
    messages,
    status,
    interviewStatus,
    scenarioScores,
    scenarioScoresRef,
    pendingCompletion,
    pendingScoringSyncAttemptId,
    isInterviewAppRoute,
    preparingHandoffPollTick,
    alphaMode: preamble.ALPHA_MODE,
    results,
    preInterviewConsentAge,
    preInterviewConsentData,
    currentMessagesRef,
    setUsingMemoryFallback,
    setMicPermission,
    supabase: wiring.supabase,
    setIsAdmin,
    setUserEmail,
    isAmoraeaAdminConsoleEmail: wiring.isAmoraeaAdminConsoleEmail,
    profile,
    getInterviewUserFirstNameForPrompt: wiring.getInterviewUserFirstNameForPrompt,
    writeSessionLog: wiring.writeSessionLog,
    scrollViewRef,
    setMessages,
    setConversationErrorNotice: shell.setConversationErrorNotice,
    webTtsTabInterruptPendingReplayRef,
    lastQuestionTextRef,
    scenarioAContemptProbeAskedRef,
    scenarioARepairQuestionAskedRef,
  };
}
