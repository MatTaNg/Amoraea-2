import type { MutableRefObject } from 'react';

import type { SaveScenarioCheckpointDeps } from '@features/aria/saveScenarioCheckpointTypes';
import type { SaveActiveInterviewProgressDeps, DebouncedLiveTranscriptSyncDeps, InterviewScenarioTransitionUiDeps } from '@features/aria/interviewActivePersistenceTypes';
import type { ApplyReferenceCardFromAssistantSpeechDeps } from '@features/aria/referenceCardFromAssistantSpeechTypes';
import type { ScenarioBoundaryScoringDeps } from '@features/aria/scenarioBoundaryScoringTypes';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsTypes';

export function syncSaveScenarioCheckpointDeps(
  ref: MutableRefObject<SaveScenarioCheckpointDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    interviewSessionAttemptIdRef: ctx.interviewSessionAttemptIdRef,
    resumeActiveScenarioRef: ctx.resumeActiveScenarioRef,
    supabase: ctx.supabase,
    loadInterviewFromStorage: ctx.loadInterviewFromStorage,
    saveInterviewToStorage: ctx.saveInterviewToStorage,
  } as SaveScenarioCheckpointDeps;
}

export function syncSaveActiveInterviewProgressDeps(
  ref: MutableRefObject<SaveActiveInterviewProgressDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    messages: ctx.messages,
    scenarioScores: ctx.scenarioScores,
    scoredScenariosRef: ctx.scoredScenariosRef,
    currentScenarioRef: ctx.currentScenarioRef,
    resumeActiveScenarioRef: ctx.resumeActiveScenarioRef,
    emotionItemResponsesRef: ctx.emotionItemResponsesRef,
    interviewStatusRef: ctx.interviewStatusRef,
    interviewSessionAttemptIdRef: ctx.interviewSessionAttemptIdRef,
    saveInterviewProgress: ctx.saveInterviewProgress,
  } as SaveActiveInterviewProgressDeps;
}

export function syncDebouncedLiveTranscriptSyncDeps(
  ref: MutableRefObject<DebouncedLiveTranscriptSyncDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    messages: ctx.messages,
    interviewStatusRef: ctx.interviewStatusRef,
    interviewSessionAttemptIdRef: ctx.interviewSessionAttemptIdRef,
    resumeActiveScenarioRef: ctx.resumeActiveScenarioRef,
    supabase: ctx.supabase,
    syncLiveInterviewTranscriptToAttempt: ctx.syncLiveInterviewTranscriptToAttempt,
  } as DebouncedLiveTranscriptSyncDeps;
}

export function syncInterviewScenarioTransitionUiDeps(
  ref: MutableRefObject<InterviewScenarioTransitionUiDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    messages: ctx.messages,
    committedScenarioRef: ctx.committedScenarioRef,
    isAssistantBubbleForTranscript: ctx.isAssistantBubbleForTranscript,
    stripControlTokens: ctx.stripControlTokens,
    detectActiveScenarioFromMessage: ctx.detectActiveScenarioFromMessage,
    setInterviewUiPhase: ctx.setInterviewUiPhase,
    setReferenceCardPrompt: ctx.setReferenceCardPrompt,
    setReferenceCardScenario: ctx.setReferenceCardScenario,
  } as InterviewScenarioTransitionUiDeps;
}

export function syncApplyReferenceCardFromAssistantSpeechDeps(
  ref: MutableRefObject<ApplyReferenceCardFromAssistantSpeechDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    messages: ctx.messages,
    committedScenarioRef: ctx.committedScenarioRef,
    moment5PrimaryAnchorDeliveredSessionRef: ctx.moment5PrimaryAnchorDeliveredSessionRef,
    moment5QuestionDeliveredRef: ctx.moment5QuestionDeliveredRef,
    currentInterviewMomentRef: ctx.currentInterviewMomentRef,
    lastQuestionTextRef: ctx.lastQuestionTextRef,
    scenarioAContemptProbeAskedRef: ctx.scenarioAContemptProbeAskedRef,
    scenarioARepairQuestionAskedRef: ctx.scenarioARepairQuestionAskedRef,
    s2RepairProbeDeliveredRef: ctx.s2RepairProbeDeliveredRef,
    s3RepairProbeDeliveredRef: ctx.s3RepairProbeDeliveredRef,
    setReferenceCardScenario: ctx.setReferenceCardScenario,
    setReferenceCardPrompt: ctx.setReferenceCardPrompt,
    setInterviewUiPhase: ctx.setInterviewUiPhase,
  } as ApplyReferenceCardFromAssistantSpeechDeps;
}

export function syncScenarioBoundaryScoringDeps(
  ref: MutableRefObject<ScenarioBoundaryScoringDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    userId: ctx.userId,
    isAdmin: ctx.isAdmin,
    currentScenarioRef: ctx.currentScenarioRef,
    interviewSessionAttemptIdRef: ctx.interviewSessionAttemptIdRef,
    currentMessagesRef: ctx.currentMessagesRef,
    scoredScenariosRef: ctx.scoredScenariosRef,
    scenarioScoresRef: ctx.scenarioScoresRef,
    resumeActiveScenarioRef: ctx.resumeActiveScenarioRef,
    scoreScenarioRef: ctx.scoreScenarioRef,
    interviewMomentsCompleteRef: ctx.interviewMomentsCompleteRef,
    currentInterviewMomentRef: ctx.currentInterviewMomentRef,
    tryRunEmotionModalFromScenarioTransitionRef: ctx.tryRunEmotionModalFromScenarioTransitionRef,
    resetScenarioCClientGatesOnly: ctx.resetScenarioCClientGatesOnly,
    scoreScenario: ctx.scoreScenario,
    loadInterviewFromStorage: ctx.loadInterviewFromStorage,
    saveInterviewToStorage: ctx.saveInterviewToStorage,
  } as ScenarioBoundaryScoringDeps;
}
