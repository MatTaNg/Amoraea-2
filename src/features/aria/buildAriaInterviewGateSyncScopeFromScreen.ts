import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import type {
  AriaInterviewGateIdentityLocalScope,
  AriaInterviewGateMetaSkipLocalScope,
  AriaInterviewGateMomentsLocalScope,
  AriaInterviewGateProgressResetLocalScope,
  AriaInterviewGateResumeEmotionLocalScope,
  AriaInterviewGateWebTtsLocalScope,
} from '@features/aria/buildAriaInterviewGateLocalSyncScope';
import {
  buildAriaInterviewGateIdentityLocalScope,
  buildAriaInterviewGateMetaSkipLocalScope,
  buildAriaInterviewGateMomentsLocalScope,
  buildAriaInterviewGateProgressResetLocalScope,
  buildAriaInterviewGateResumeEmotionLocalScope,
  buildAriaInterviewGateWebTtsLocalScope,
} from '@features/aria/buildAriaInterviewGateLocalSyncScope';
import { createAriaInterviewGateSyncContextFromLocalScopes } from '@features/aria/createAriaInterviewGateSyncContextFromLocalScopes';

export type AriaInterviewGateScreenScopeInput = {
  identity: AriaInterviewGateIdentityLocalScope;
  closing: AriaInterviewDepsSyncContext;
  metaSkip: AriaInterviewGateMetaSkipLocalScope;
  moments: AriaInterviewGateMomentsLocalScope;
  webTts: AriaInterviewGateWebTtsLocalScope;
  resumeEmotion: AriaInterviewGateResumeEmotionLocalScope;
  progressReset: AriaInterviewGateProgressResetLocalScope;
};

/** Build gate sync context from grouped screen-local scope fields. */
export function buildAriaInterviewGateSyncScopeFromScreen(
  screen: AriaInterviewGateScreenScopeInput,
): AriaInterviewDepsSyncContext {
  return createAriaInterviewGateSyncContextFromLocalScopes({
    identity: buildAriaInterviewGateIdentityLocalScope(screen.identity),
    closing: screen.closing,
    metaSkip: buildAriaInterviewGateMetaSkipLocalScope(screen.metaSkip),
    moments: buildAriaInterviewGateMomentsLocalScope(screen.moments),
    webTts: buildAriaInterviewGateWebTtsLocalScope(screen.webTts),
    resumeEmotion: buildAriaInterviewGateResumeEmotionLocalScope(screen.resumeEmotion),
    progressReset: buildAriaInterviewGateProgressResetLocalScope(screen.progressReset),
  });
}
