import type { AriaInterviewGateScreenRefsParams } from '@features/aria/buildAriaInterviewGateScreenRefsInput';
import { buildAriaInterviewGateScreenRefsInput } from '@features/aria/buildAriaInterviewGateScreenRefsInput';
import type { AriaInterviewGateScreenScopeInput } from '@features/aria/buildAriaInterviewGateSyncScopeFromScreen';
import { buildAriaInterviewGateSyncScopeFromScreen } from '@features/aria/buildAriaInterviewGateSyncScopeFromScreen';
import type {
  AriaInterviewGateIdentityLocalScope,
  AriaInterviewGateMetaSkipLocalScope,
  AriaInterviewGateMomentsLocalScope,
  AriaInterviewGateProgressResetLocalScope,
  AriaInterviewGateResumeEmotionLocalScope,
} from '@features/aria/buildAriaInterviewGateLocalSyncScope';
import type { AriaInterviewGateWebTtsSyncScope } from '@features/aria/ariaInterviewGateSyncScopeTypes';
import { RESUME_WELCOME_BACK_MESSAGE } from '@features/aria/interviewMomentScenarioConfig';
import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import type { ResetInterviewProgressRefsDeps } from '@features/aria/interviewProgressResetTypes';
import type { GestureContextLostReason } from '@features/aria/utils/webInterviewGestureContext';
import type { MutableRefObject } from 'react';

export type AriaInterviewGateScreenRefsInput = {
  identity: Omit<AriaInterviewGateIdentityLocalScope, 'resumeWelcomeBackMessage'>;
  closing: AriaInterviewDepsSyncContext;
  metaSkip: AriaInterviewGateMetaSkipLocalScope;
  moments: AriaInterviewGateMomentsLocalScope;
  webTts: Omit<AriaInterviewGateWebTtsSyncScope, 'gestureContextLostAtRef'> & {
    gestureContextLostAtRef: MutableRefObject<{ atMs: number; reason: GestureContextLostReason } | null>;
  };
  resumeEmotion: AriaInterviewGateResumeEmotionLocalScope;
  progressReset: AriaInterviewGateProgressResetLocalScope;
};

/** Assemble grouped gate screen scope from live refs (injects resume welcome copy + webTts cast). */
export function buildAriaInterviewGateScreenScopeInputFromRefs(
  refs: AriaInterviewGateScreenRefsInput,
): AriaInterviewGateScreenScopeInput {
  return {
    identity: {
      ...refs.identity,
      resumeWelcomeBackMessage: RESUME_WELCOME_BACK_MESSAGE,
    },
    closing: refs.closing,
    metaSkip: refs.metaSkip,
    moments: refs.moments,
    webTts: {
      ...refs.webTts,
      gestureContextLostAtRef:
        refs.webTts.gestureContextLostAtRef as ResetInterviewProgressRefsDeps['gestureContextLostAtRef'],
    },
    resumeEmotion: refs.resumeEmotion,
    progressReset: refs.progressReset,
  };
}

/** Build gate sync context from grouped screen-local refs. */
export function buildAriaInterviewGateSyncCtxFromScreenRefs(
  refs: AriaInterviewGateScreenRefsInput,
): AriaInterviewDepsSyncContext {
  return buildAriaInterviewGateSyncScopeFromScreen(buildAriaInterviewGateScreenScopeInputFromRefs(refs));
}

/** Build gate sync context from screen refs bag (closing question + grouped scopes). */
export function buildAriaInterviewGateSyncCtxFromScreenRefsBag(
  params: AriaInterviewGateScreenRefsParams,
): AriaInterviewDepsSyncContext {
  return buildAriaInterviewGateSyncCtxFromScreenRefs(buildAriaInterviewGateScreenRefsInput(params));
}
