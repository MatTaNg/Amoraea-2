import React from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { AriaSessionExpiredScreen } from '@features/aria/screens/AriaSessionExpiredScreen';
import { AriaInterviewLoadingScreen } from '@features/aria/screens/AriaInterviewLoadingScreen';
import { AriaInterviewResumeLoadingScreen } from '@features/aria/screens/AriaInterviewResumeLoadingScreen';
import { AriaInterviewStartingScreen } from '@features/aria/screens/AriaInterviewStartingScreen';
import { AriaInterviewIntroScreen } from '@features/aria/screens/AriaInterviewIntroScreen';
import { AriaInterviewUnderReviewScreen } from '@features/aria/screens/AriaInterviewUnderReviewScreen';
import type { PostInterviewFeedbackKey } from '@features/aria/interviewPostInterviewFeedbackConfig';
import { PreparingResultsView } from '@app/screens/PreparingResultsView';
import { InterviewAnalysisScreen } from '@app/screens/InterviewAnalysisScreen';
import { AdminInterviewDashboard } from '@app/screens/AdminInterviewDashboard';

export type AriaInterviewScreenRouterProps = {
  sessionExpired: boolean;
  interviewStatus: string;
  status: string;
  fromValidationTrack: boolean;
  pendingCompletion: boolean;
  resumeLoadingVisible: boolean;
  resumeHydrationPending: boolean;
  shouldShowAdminPanel: boolean;
  alphaMode: boolean;
  analysisAttemptId: string | null;
  isAdmin: boolean;
  isAdminAccount: boolean;
  userId: string;
  hasSubmittedPostInterviewFeedback: boolean;
  showPostInterviewFeedback: boolean;
  postInterviewFeedbackError: string | null;
  postInterviewRatings: Record<PostInterviewFeedbackKey, number | null>;
  postInterviewComments: Record<PostInterviewFeedbackKey, string>;
  postInterviewGeneralFeedback: string;
  adminInterviewTopBar: React.ReactNode;
  micError: string | null;
  micPermission: string;
  micWarning: string | null;
  preInterviewConsentAge: boolean;
  preInterviewConsentData: boolean;
  interviewStartInFlight: boolean;
  interviewAttemptBootstrap: 'idle' | 'loading' | 'ready' | 'failed';
  supabase: SupabaseClient;
  signOut: () => Promise<void>;
  setSessionExpired: (value: boolean) => void;
  setShowAdminPanel: (value: boolean) => void;
  setPostInterviewFeedbackError: (value: string | null) => void;
  setShowPostInterviewFeedback: (value: boolean) => void;
  setPostInterviewRatings: React.Dispatch<
    React.SetStateAction<Record<PostInterviewFeedbackKey, number | null>>
  >;
  setPostInterviewComments: React.Dispatch<
    React.SetStateAction<Record<PostInterviewFeedbackKey, string>>
  >;
  setPostInterviewGeneralFeedback: React.Dispatch<React.SetStateAction<string>>;
  setMicError: React.Dispatch<React.SetStateAction<string | null>>;
  setPreInterviewConsentAge: React.Dispatch<React.SetStateAction<boolean>>;
  setPreInterviewConsentData: React.Dispatch<React.SetStateAction<boolean>>;
  onboardingAutoStartRef: React.MutableRefObject<boolean>;
  handleInterviewSignOut: () => void;
  handleRetake: () => void;
  handleSubmitPostInterviewFeedback: () => void;
  handleBackToValidationReport: () => void;
  startInterview: (opts?: { fromUserGesture?: boolean }) => Promise<void>;
};

/** Returns an early-return screen when routing applies; otherwise null for the active interview shell. */
export function AriaInterviewScreenRouter(
  props: AriaInterviewScreenRouterProps,
): React.ReactElement | null {
  if (props.sessionExpired) {
    return (
      <AriaSessionExpiredScreen
        onContinue={async () => {
          const { error } = await props.supabase.auth.refreshSession();
          if (!error) props.setSessionExpired(false);
          else {
            await props.signOut();
          }
        }}
      />
    );
  }

  if (props.interviewStatus === 'loading') {
    return <AriaInterviewLoadingScreen />;
  }

  const validationPreparingResultsVisible =
    props.fromValidationTrack &&
    (props.interviewStatus === 'preparing_results' ||
      props.status === 'scoring' ||
      props.status === 'results' ||
      props.pendingCompletion ||
      props.interviewStatus === 'under_review' ||
      props.interviewStatus === 'congratulations');

  if (validationPreparingResultsVisible || props.interviewStatus === 'preparing_results') {
    return <PreparingResultsView />;
  }

  if (props.resumeLoadingVisible || props.resumeHydrationPending) {
    return <AriaInterviewResumeLoadingScreen />;
  }

  if (props.shouldShowAdminPanel) {
    return (
      <AdminInterviewDashboard
        onClose={() => {
          props.setShowAdminPanel(false);
        }}
      />
    );
  }

  if (props.alphaMode && props.interviewStatus === 'analysis') {
    return (
      <InterviewAnalysisScreen
        attemptId={props.analysisAttemptId}
        onRetake={props.handleRetake}
        isAdmin={props.isAdmin}
        alphaMode={props.alphaMode}
      />
    );
  }

  if (props.interviewStatus === 'under_review' || props.interviewStatus === 'congratulations') {
    return (
      <AriaInterviewUnderReviewScreen
        isAdminAccount={props.isAdminAccount}
        userId={props.userId}
        analysisAttemptId={props.analysisAttemptId}
        hasSubmittedPostInterviewFeedback={props.hasSubmittedPostInterviewFeedback}
        showPostInterviewFeedback={props.showPostInterviewFeedback}
        postInterviewFeedbackError={props.postInterviewFeedbackError}
        postInterviewRatings={props.postInterviewRatings}
        postInterviewComments={props.postInterviewComments}
        postInterviewGeneralFeedback={props.postInterviewGeneralFeedback}
        onSignOut={props.handleInterviewSignOut}
        onOpenAdminPanel={() => props.setShowAdminPanel(true)}
        onRetake={props.handleRetake}
        onOpenFeedback={() => {
          props.setPostInterviewFeedbackError(null);
          props.setShowPostInterviewFeedback(true);
        }}
        onCloseFeedback={() => {
          props.setPostInterviewFeedbackError(null);
          props.setShowPostInterviewFeedback(false);
        }}
        onClearFeedbackError={() => props.setPostInterviewFeedbackError(null)}
        onSetRating={(id, value) => {
          props.setPostInterviewRatings((prev) => ({ ...prev, [id]: value }));
        }}
        onSetComment={(id, text) => {
          props.setPostInterviewComments((prev) => ({ ...prev, [id]: text }));
        }}
        onSetGeneralFeedback={props.setPostInterviewGeneralFeedback}
        onSubmitFeedback={props.handleSubmitPostInterviewFeedback}
      />
    );
  }

  if (props.status === 'starting_interview') {
    return (
      <AriaInterviewStartingScreen
        adminTopBar={props.adminInterviewTopBar}
        micError={props.micError}
        micPermissionDenied={props.micPermission === 'denied'}
        onSignOut={props.handleInterviewSignOut}
        onRetryMic={() => {
          props.onboardingAutoStartRef.current = false;
          props.setMicError(null);
          void props.startInterview({ fromUserGesture: true });
        }}
      />
    );
  }

  if (props.status === 'intro') {
    /** Active shell owns in-progress UI; session status may still be intro for a frame after resume/start. */
    if (props.interviewStatus === 'in_progress') {
      return null;
    }
    const sessionPrepPending =
      Boolean(props.userId) &&
      !props.isAdmin &&
      (props.interviewAttemptBootstrap === 'idle' || props.interviewAttemptBootstrap === 'loading');
    const attemptReady =
      !props.userId || props.isAdmin || props.interviewAttemptBootstrap !== 'failed';
    const preInterviewReady =
      props.preInterviewConsentAge &&
      props.preInterviewConsentData &&
      !props.micError &&
      attemptReady;

    return (
      <AriaInterviewIntroScreen
        adminTopBar={props.adminInterviewTopBar}
        fromValidationTrack={props.fromValidationTrack}
        micError={props.micError}
        micWarning={props.micWarning}
        preInterviewConsentAge={props.preInterviewConsentAge}
        preInterviewConsentData={props.preInterviewConsentData}
        preInterviewReady={preInterviewReady}
        sessionPrepPending={sessionPrepPending}
        interviewStartInFlight={props.interviewStartInFlight}
        interviewAttemptBootstrap={props.interviewAttemptBootstrap}
        userId={props.userId}
        isAdmin={props.isAdmin}
        onBackToValidationReport={props.handleBackToValidationReport}
        onSignOut={props.handleInterviewSignOut}
        onToggleConsentAge={() => props.setPreInterviewConsentAge((v) => !v)}
        onToggleConsentData={() => props.setPreInterviewConsentData((v) => !v)}
        onBeginInterview={() => {
          if (__DEV__) {
            console.log('[START] Begin interview pressed', {
              preInterviewReady,
              interviewAttemptBootstrap: props.interviewAttemptBootstrap,
              interviewStartInFlight: props.interviewStartInFlight,
            });
          }
          void props.startInterview({ fromUserGesture: true });
        }}
      />
    );
  }

  return null;
}
