import type { MutableRefObject } from 'react';

import type { DeliverRecordingRetryLineDeps } from '@features/aria/deliverRecordingRetryLineTypes';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsTypes';

export function syncDeliverRecordingRetryLineDeps(
  ref: MutableRefObject<DeliverRecordingRetryLineDeps>,
  ctx: AriaInterviewDepsSyncContext,
): void {
  ref.current = {
    lastRecordingRetryDeliveredNormRef: ctx.lastRecordingRetryDeliveredNormRef,
    lastRecordingRetryDeliveredAtMsRef: ctx.lastRecordingRetryDeliveredAtMsRef,
    lastSuccessfulTtsTextNormalizedRef: ctx.lastSuccessfulTtsTextNormalizedRef,
    currentScenarioRef: ctx.currentScenarioRef,
    currentInterviewMomentRef: ctx.currentInterviewMomentRef,
    setVoiceState: ctx.setVoiceState,
    speakTextSafe: ctx.speakTextSafe,
    commitInterviewMessages: ctx.commitInterviewMessages,
  } as DeliverRecordingRetryLineDeps;
}
