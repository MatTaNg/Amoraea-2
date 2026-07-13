import React from 'react';

import { buildAriaInterviewActiveShellProps } from '@features/aria/buildAriaInterviewActiveShellProps';
import type { AriaInterviewActiveShellScope } from '@features/aria/buildAriaInterviewActiveShellProps';
import { buildAriaInterviewScreenRouterProps } from '@features/aria/buildAriaInterviewScreenRouterProps';
import type { AriaInterviewScreenRouterScope } from '@features/aria/buildAriaInterviewScreenRouterProps';
import type { AriaPostInterviewFeedbackState } from '@features/aria/hooks/useAriaPostInterviewFeedbackState';
import { toAriaInterviewScreenRouterPostInterviewFeedbackScope } from '@features/aria/hooks/useAriaPostInterviewFeedbackState';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import { AriaAdminInterviewTopBar } from '@features/aria/screens/AriaAdminInterviewTopBar';
import {
  AriaInterviewActiveShell,
  resolveAriaInterviewActiveShellOverlayKind,
} from '@features/aria/screens/AriaInterviewActiveShell';
import { AriaInterviewScreenRouter } from '@features/aria/screens/AriaInterviewScreenRouter';

export type AriaInterviewScreenRenderScope = {
  adminBar: {
    isAdminAccount: boolean;
    setShowAdminPanel: React.Dispatch<React.SetStateAction<boolean>>;
    handleAdminResetInterview: () => void | Promise<void>;
    handleInterviewSignOut: () => void | Promise<void>;
  };
  router: {
    routing: AriaInterviewScreenRouterScope['routing'];
    adminAccess: Omit<AriaInterviewScreenRouterScope['adminAccess'], 'adminInterviewTopBar'>;
    postInterviewFeedback: {
      state: AriaPostInterviewFeedbackState;
      handlers: Pick<
        AriaInterviewScreenRouterScope['postInterviewFeedback'],
        'handleSubmitPostInterviewFeedback' | 'handleBackToValidationReport'
      >;
    };
    startConsent: AriaInterviewScreenRouterScope['startConsent'];
    sessionAuth: AriaInterviewScreenRouterScope['sessionAuth'];
  };
  activeShell: {
    layout: Pick<AriaInterviewActiveShellScope['layout'], 'isAdmin' | 'status'> & {
      emotionModalVisible: boolean;
      webTabGestureRestoreOverlay: boolean;
      webResumeWelcomeTapPending: boolean;
      webDesktopPendingTtsGestureOverlay: boolean;
    };
    emotionModal: AriaInterviewActiveShellScope['emotionModal'];
    interviewerMic: AriaInterviewActiveShellScope['interviewerMic'];
    adminResults: AriaInterviewActiveShellScope['adminResults'];
    handoff: Omit<AriaInterviewActiveShellScope['handoff'], 'routeOnComplete' | 'routeName'> & {
      route: { name?: string; params?: { onComplete?: (r: InterviewResults) => void } };
    };
    webGestures: AriaInterviewActiveShellScope['webGestures'];
  };
};

/** Router branch or active interview shell — keeps AriaScreen render block thin. */
export function renderAriaInterviewScreen(scope: AriaInterviewScreenRenderScope): React.ReactNode {
  const { adminBar, router, activeShell } = scope;

  const adminInterviewTopBar = adminBar.isAdminAccount ? (
    <AriaAdminInterviewTopBar
      onOpenPanel={() => adminBar.setShowAdminPanel(true)}
      onResetInterview={adminBar.handleAdminResetInterview}
      onSignOut={adminBar.handleInterviewSignOut}
    />
  ) : null;

  const routedInterviewScreen = AriaInterviewScreenRouter(
    buildAriaInterviewScreenRouterProps({
      routing: router.routing,
      adminAccess: {
        ...router.adminAccess,
        adminInterviewTopBar,
      },
      postInterviewFeedback: toAriaInterviewScreenRouterPostInterviewFeedbackScope(
        router.postInterviewFeedback.state,
        router.postInterviewFeedback.handlers,
      ),
      startConsent: router.startConsent,
      sessionAuth: router.sessionAuth,
    }),
  );
  if (routedInterviewScreen) {
    return routedInterviewScreen;
  }

  const { layout, handoff, ...activeShellRest } = activeShell;
  const inputDisabled = layout.status === 'scoring' || layout.status === 'results' || layout.emotionModalVisible;
  const isInterviewerView = layout.status === 'active' && !layout.isAdmin;
  const webActiveGestureOverlayKind = resolveAriaInterviewActiveShellOverlayKind({
    status: layout.status,
    isAdmin: layout.isAdmin,
    webTabGestureRestoreOverlay: layout.webTabGestureRestoreOverlay,
    webResumeWelcomeTapPending: layout.webResumeWelcomeTapPending,
    webDesktopPendingTtsGestureOverlay: layout.webDesktopPendingTtsGestureOverlay,
  });
  const routeOnComplete = handoff.route.params?.onComplete;

  return (
    <AriaInterviewActiveShell
      {...buildAriaInterviewActiveShellProps({
        layout: {
          adminInterviewTopBar,
          isAdmin: layout.isAdmin,
          status: layout.status,
          isInterviewerView,
          webActiveGestureOverlayKind,
          inputDisabled,
        },
        ...activeShellRest,
        handoff: {
          navigation: handoff.navigation,
          routeName: handoff.route.name ?? '',
          interviewSessionIdRef: handoff.interviewSessionIdRef,
          replaceWithStandardApplicantPostInterviewHandoffForUser:
            handoff.replaceWithStandardApplicantPostInterviewHandoffForUser,
          routeOnComplete,
        },
      })}
    />
  );
}
