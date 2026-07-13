import { useCallback, useRef } from 'react';
import type { MutableRefObject } from 'react';

import type { AriaInterviewDepsSyncContext } from '@features/aria/syncAriaInterviewDepsRefs';
import {
  createInterviewCompletionScoringSyncCtxFromScreen,
  createLoadPostInterviewFeedbackSyncCtxFromScreen,
  createPerformAdminInterviewResetSyncCtxFromScreen,
  createPerformInterviewRetakeSyncCtxFromScreen,
  createSubmitPostInterviewFeedbackSyncCtxFromScreen,
  createWebResumeWelcomeTapSyncCtxFromScreen,
} from '@features/aria/buildAriaInterviewAuxClusterScreenParams';
import { createInterviewSessionLifecycleSyncCtxFromScreen } from '@features/aria/buildAriaInterviewClusterScreenParams';
import { createPostInterviewFeedbackAlertSyncCtxFromScreen } from '@features/aria/buildAriaInterviewBootMiscScreenParams';
import type { InterviewSessionLifecycleLocalScope } from '@features/aria/buildInterviewSessionLifecycleLocalSyncExtra';
import type { InterviewCompletionScoringLocalScope } from '@features/aria/buildInterviewPostInterviewFeedbackLocalSyncExtras';
import type {
  LoadPostInterviewFeedbackLocalScope,
  SubmitPostInterviewFeedbackLocalScope,
} from '@features/aria/buildInterviewPostInterviewFeedbackLocalSyncExtras';
import type { PerformAdminInterviewResetLocalScope } from '@features/aria/buildPerformAdminInterviewResetLocalSyncExtra';
import type { PerformInterviewRetakeLocalScope } from '@features/aria/buildPerformInterviewRetakeLocalSyncExtra';
import type { WebResumeWelcomeTapLocalScope } from '@features/aria/buildWebResumeWelcomeTapSyncExtra';
import type { AudioRouteKind } from '@features/aria/config/audioRouteRuntime';
import type { AriaPostInterviewFeedbackState } from '@features/aria/hooks/useAriaPostInterviewFeedbackState';
import {
  useHandleWebResumeWelcomeTap,
  useSubmitPostInterviewFeedbackCallback,
} from '@features/aria/hooks/useInterviewTurnProcessingCallbacks';
import {
  useInterviewAdminResetActions,
  useInterviewRetakeActions,
} from '@features/aria/hooks/useInterviewRetakeActions';
import {
  useInterviewCompletionScoring,
  type InterviewCompletionScoringEffectInputs,
} from '@features/aria/hooks/useInterviewCompletionScoring';
import {
  useInterviewSessionLifecycle,
  type InterviewSessionLifecycleEffectInputs,
} from '@features/aria/hooks/useInterviewSessionLifecycle';
import { useLoadPostInterviewFeedback } from '@features/aria/hooks/useLoadPostInterviewFeedback';
import type { ShowInterviewConfirmDialog } from '@features/aria/interviewConfirmDialogActions';
import type { PostInterviewFeedbackAlertDeps } from '@features/aria/interviewClosingQuestionTypes';
import type { LoadPostInterviewFeedbackDeps } from '@features/aria/loadPostInterviewFeedbackTypes';
import type { PerformAdminInterviewResetDeps } from '@features/aria/performAdminInterviewResetTypes';
import type { PerformInterviewRetakeDeps } from '@features/aria/performInterviewRetakeTypes';
import type { PreparingResultsFailsafeDeps } from '@features/aria/preparingResultsFailsafeTypes';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import type { InterviewSessionLifecycleDeps } from '@features/aria/sessionLifecycleTypes';
import type { SubmitPostInterviewFeedbackDeps } from '@features/aria/submitPostInterviewFeedbackTypes';
import type { WebResumeWelcomeTapDeps } from '@features/aria/webResumeWelcomeTapTypes';
import {
  runShowFeedbackNotice,
  runShowMissingInterviewAttemptAlert,
} from '@features/aria/runPostInterviewFeedbackAlerts';
import {
  syncLoadPostInterviewFeedbackDeps,
  syncPerformAdminInterviewResetDeps,
  syncPerformInterviewRetakeDeps,
  syncPostInterviewFeedbackAlertDeps,
  syncSessionLifecycleDeps,
  syncSubmitPostInterviewFeedbackDeps,
  syncWebResumeWelcomeTapDeps,
} from '@features/aria/syncAriaInterviewDepsRefs';

export type SessionLifecycleAudioDeviceDepScreenRefs = Omit<
  InterviewSessionLifecycleLocalScope['audioDevice'],
  'setAudioRouteKind'
> & {
  setAudioRouteKind: (kind: AudioRouteKind) => void;
};

export type SessionLifecycleDepScreenRefs = Omit<InterviewSessionLifecycleLocalScope, 'audioDevice'> & {
  audioDevice: SessionLifecycleAudioDeviceDepScreenRefs;
};

export type PerformAdminInterviewResetDepScreenRefs = {
  media: PerformAdminInterviewResetLocalScope['media'];
  storage: PerformAdminInterviewResetLocalScope['storage'];
  closingQuestion: PerformAdminInterviewResetLocalScope['closingQuestion'];
  sessionRefs: PerformAdminInterviewResetLocalScope['sessionRefs'];
  interviewReset: Omit<PerformAdminInterviewResetLocalScope['interviewReset'], 'startInterview'>;
};

export type SubmitPostInterviewFeedbackDepScreenRefs = Omit<
  SubmitPostInterviewFeedbackLocalScope,
  'handlers'
>;

export type AriaInterviewLifecycleDepSyncWiringParams = {
  coreCtx: AriaInterviewDepsSyncContext;
  coreGateServicesBaseCtx: AriaInterviewDepsSyncContext;
  coreGateServicesFullSyncCtx: AriaInterviewDepsSyncContext;
  servicesBaseCtx: AriaInterviewDepsSyncContext;
  showSimpleAlert: PostInterviewFeedbackAlertDeps['showSimpleAlert'];
  showConfirmDialog: ShowInterviewConfirmDialog;
  webResumeWelcomeTap: WebResumeWelcomeTapLocalScope;
  sessionLifecycle: SessionLifecycleDepScreenRefs;
  sessionLifecycleEffects: InterviewSessionLifecycleEffectInputs;
  completionScoring: InterviewCompletionScoringLocalScope;
  completionScoringEffects: InterviewCompletionScoringEffectInputs;
  completionRefs: {
    isInterviewCompleteRef: MutableRefObject<boolean>;
    pendingCompletionTranscriptRef: MutableRefObject<
      Array<{ role: string; content: string; interviewMoment?: number; scenarioNumber?: number }> | null
    >;
    scoreInterviewAttemptedRef: MutableRefObject<boolean>;
    interviewStatusRef: MutableRefObject<string>;
    setInterviewStatus: ScoreInterviewDeps['setInterviewStatus'];
    setPendingCompletion: React.Dispatch<React.SetStateAction<boolean>>;
  };
  performRetake: {
    closingQuestion: PerformInterviewRetakeLocalScope['closingQuestion'];
    interviewReset: PerformInterviewRetakeLocalScope['interviewReset'];
  };
  performAdminInterviewReset: PerformAdminInterviewResetDepScreenRefs;
  postInterviewFeedback: AriaPostInterviewFeedbackState;
  submitPostInterviewFeedback: SubmitPostInterviewFeedbackDepScreenRefs;
  loadPostInterviewFeedback: LoadPostInterviewFeedbackLocalScope;
  loadPostInterviewFeedbackEffects: {
    userId: string;
    interviewStatus: LoadPostInterviewFeedbackLocalScope['interviewStatus'];
    analysisAttemptId: LoadPostInterviewFeedbackLocalScope['analysisAttemptId'];
  };
};

/** Wire session lifecycle, completion scoring, retake/admin reset, and post-interview feedback deps. */
export function useAriaInterviewLifecycleDepSyncWiring(params: AriaInterviewLifecycleDepSyncWiringParams) {
  const {
    coreCtx,
    coreGateServicesBaseCtx,
    coreGateServicesFullSyncCtx,
    servicesBaseCtx,
    showSimpleAlert,
    showConfirmDialog,
    webResumeWelcomeTap,
    sessionLifecycle,
    sessionLifecycleEffects,
    completionScoring,
    completionScoringEffects,
    completionRefs,
    performRetake,
    performAdminInterviewReset,
    postInterviewFeedback,
    submitPostInterviewFeedback,
    loadPostInterviewFeedback,
    loadPostInterviewFeedbackEffects,
  } = params;

  const webResumeWelcomeTapDepsRef = useRef({} as WebResumeWelcomeTapDeps);
  syncWebResumeWelcomeTapDeps(
    webResumeWelcomeTapDepsRef,
    createWebResumeWelcomeTapSyncCtxFromScreen(coreCtx, webResumeWelcomeTap),
  );
  const handleWebResumeWelcomeTap = useHandleWebResumeWelcomeTap(webResumeWelcomeTapDepsRef);

  const sessionLifecycleDepsRef = useRef({} as InterviewSessionLifecycleDeps);
  syncSessionLifecycleDeps(
    sessionLifecycleDepsRef,
    createInterviewSessionLifecycleSyncCtxFromScreen(coreGateServicesBaseCtx, sessionLifecycle),
  );

  const { startInterview, handleMobileWebTapToBegin } = useInterviewSessionLifecycle(
    sessionLifecycleDepsRef,
    sessionLifecycleEffects,
  );

  const scoreInterviewDepsRef = useRef({} as ScoreInterviewDeps);
  const preparingResultsFailsafeDepsRef = useRef({} as PreparingResultsFailsafeDeps);

  useInterviewCompletionScoring(
    scoreInterviewDepsRef,
    preparingResultsFailsafeDepsRef,
    createInterviewCompletionScoringSyncCtxFromScreen(coreGateServicesFullSyncCtx, completionScoring),
    completionScoringEffects,
    completionRefs,
  );

  const performRetakeDepsRef = useRef({} as PerformInterviewRetakeDeps);
  syncPerformInterviewRetakeDeps(
    performRetakeDepsRef,
    createPerformInterviewRetakeSyncCtxFromScreen(coreCtx, {
      ...performRetake,
      postInterviewReset: postInterviewFeedback,
    }),
  );

  const { handleRetake } = useInterviewRetakeActions({
    performRetakeDepsRef,
    showConfirmDialog,
  });

  const performAdminInterviewResetDepsRef = useRef({} as PerformAdminInterviewResetDeps);
  syncPerformAdminInterviewResetDeps(
    performAdminInterviewResetDepsRef,
    createPerformAdminInterviewResetSyncCtxFromScreen(coreCtx, {
      ...performAdminInterviewReset,
      interviewReset: {
        ...performAdminInterviewReset.interviewReset,
        startInterview,
      },
      postInterviewReset: postInterviewFeedback,
    }),
  );

  const { handleAdminResetInterview } = useInterviewAdminResetActions({
    performAdminInterviewResetDepsRef,
    showConfirmDialog,
  });

  const postInterviewFeedbackAlertDepsRef = useRef({ showSimpleAlert } as PostInterviewFeedbackAlertDeps);
  syncPostInterviewFeedbackAlertDeps(
    postInterviewFeedbackAlertDepsRef,
    createPostInterviewFeedbackAlertSyncCtxFromScreen({ showSimpleAlert }),
  );
  const showFeedbackNotice = useCallback(
    (title: string, message: string) =>
      runShowFeedbackNotice(postInterviewFeedbackAlertDepsRef.current, title, message),
    [],
  );
  const showMissingInterviewAttemptAlert = useCallback(() => runShowMissingInterviewAttemptAlert(), []);

  const submitPostInterviewFeedbackDepsRef = useRef({} as SubmitPostInterviewFeedbackDeps);
  syncSubmitPostInterviewFeedbackDeps(
    submitPostInterviewFeedbackDepsRef,
    createSubmitPostInterviewFeedbackSyncCtxFromScreen(servicesBaseCtx, {
      ...submitPostInterviewFeedback,
      handlers: {
        showFeedbackNotice,
        showMissingAttemptAlert: showMissingInterviewAttemptAlert,
      },
    }),
  );

  const handleSubmitPostInterviewFeedback = useSubmitPostInterviewFeedbackCallback(
    submitPostInterviewFeedbackDepsRef,
  );

  const loadPostInterviewFeedbackDepsRef = useRef({} as LoadPostInterviewFeedbackDeps);
  syncLoadPostInterviewFeedbackDeps(
    loadPostInterviewFeedbackDepsRef,
    createLoadPostInterviewFeedbackSyncCtxFromScreen(servicesBaseCtx, loadPostInterviewFeedback),
  );

  useLoadPostInterviewFeedback(loadPostInterviewFeedbackDepsRef, loadPostInterviewFeedbackEffects);

  return {
    handleWebResumeWelcomeTap,
    startInterview,
    handleMobileWebTapToBegin,
    handleRetake,
    handleAdminResetInterview,
    handleSubmitPostInterviewFeedback,
  };
}
