import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import { mergeAriaInterviewCoreWithLocalSyncCtx } from '@features/aria/mergeAriaInterviewSyncContextHelpers';
import {
  createInterviewWebResumeWelcomeTapEmotionSyncSlice,
  createInterviewWebResumeWelcomeTapResumeFlowSyncSlice,
  createInterviewWebResumeWelcomeTapSessionSyncSlice,
  createInterviewWebResumeWelcomeTapSpeechSyncSlice,
  createInterviewWebResumeWelcomeTapWebGestureSyncSlice,
} from '@features/aria/createInterviewWebResumeWelcomeTapSyncSlices';

/** Pick web-resume welcome-tap dep-sync fields from a merged interview sync context. */
export function buildWebResumeWelcomeTapSyncExtra(
  params: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  return Object.assign(
    {},
    createInterviewWebResumeWelcomeTapSessionSyncSlice(params),
    createInterviewWebResumeWelcomeTapWebGestureSyncSlice(params),
    createInterviewWebResumeWelcomeTapSpeechSyncSlice(params),
    createInterviewWebResumeWelcomeTapEmotionSyncSlice(params),
    createInterviewWebResumeWelcomeTapResumeFlowSyncSlice(params),
  );
}

export type WebResumeWelcomeTapLocalScope = Pick<
  AriaInterviewDepsSyncContext,
  | 'webResumeWelcomeTapHandledRef'
  | 'webResumeWelcomeTapPendingRef'
  | 'setWebResumeWelcomeTapPending'
  | 'resumeOfferWelcomeTtsRef'
  | 'emotionModalPendingTransitionRef'
  | 'resumeEmotionCatchUpIndicesRef'
  | 'awaitEmotionModalForIndex'
  | 'resumeWelcomeMessageRef'
  | 'pendingScenarioIntroAfterResumeWelcomeRef'
  | 'resumeEmotionAfterModalTextRef'
  | 'resumeRepeatChoicePendingRef'
  | 'setWebDesktopPendingTtsGestureOverlay'
>;

export function buildWebResumeWelcomeTapLocalSyncExtra(scope: WebResumeWelcomeTapLocalScope): AriaInterviewDepsSyncContext {
  return scope;
}

export function buildWebResumeWelcomeTapMergedSyncCtx(
  coreCtx: AriaInterviewDepsSyncContext,
  localScope: WebResumeWelcomeTapLocalScope,
): AriaInterviewDepsSyncContext {
  return mergeAriaInterviewCoreWithLocalSyncCtx(
    coreCtx,
    buildWebResumeWelcomeTapLocalSyncExtra(localScope),
  );
}
