import { useCallback, useRef } from 'react';

import {
  createNavigateBackToValidationReportSyncCtxFromScreen,
  createOpenAdminPanelFromRouteSyncCtxFromScreen,
  createProcessTurnAudioSyncCtxFromScreen,
  createResolveAssistantScenarioNumberSyncCtxFromScreen,
  type NavigateBackToValidationReportScreenRefs,
  type OpenAdminPanelFromRouteScreenRefs,
  type ProcessTurnAudioScreenRefs,
  type ResolveAssistantScenarioNumberScreenRefs,
} from '@features/aria/buildAriaInterviewBootMiscScreenParams';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { ShowInterviewConfirmDialog } from '@features/aria/interviewConfirmDialogActions';
import { runConfirmInterviewSignOut } from '@features/aria/interviewConfirmDialogActions';
import { useOpenAdminPanelFromRouteParam } from '@features/aria/hooks/useOpenAdminPanelFromRouteParam';
import type { ProcessTurnAudioWithRetryDeps } from '@features/aria/interviewTurnAudioTypes';
import type { OpenAdminPanelFromRouteDeps } from '@features/aria/openAdminPanelFromRouteTypes';
import type { ResolveAssistantScenarioNumberDeps } from '@features/aria/resolveAssistantScenarioNumberTypes';
import { runDeleteTurnAudioFile, runProcessTurnAudioWithRetry } from '@features/aria/runInterviewTurnAudio';
import { runNavigateBackToValidationReport } from '@features/aria/runNavigateBackToValidationReport';
import { runResolveAssistantScenarioNumber } from '@features/aria/runResolveAssistantScenarioNumber';
import type { NavigateBackToValidationReportDeps } from '@features/aria/interviewClosingQuestionTypes';
import {
  syncNavigateBackToValidationReportDeps,
  syncOpenAdminPanelFromRouteDeps,
  syncProcessTurnAudioDeps,
  syncResolveAssistantScenarioNumberDeps,
} from '@features/aria/syncAriaInterviewDepsRefs';

export type ProcessTurnAudioDepScreenRefs = Omit<ProcessTurnAudioScreenRefs, 'deleteTurnAudioFile'>;

export type AriaInterviewBootMiscDepSyncWiringParams = {
  resolveAssistantScenarioNumber: ResolveAssistantScenarioNumberScreenRefs;
  processTurnAudio: ProcessTurnAudioDepScreenRefs;
  navigateBackToValidationReport: NavigateBackToValidationReportScreenRefs;
  openAdminPanelFromRoute: OpenAdminPanelFromRouteScreenRefs;
  openAdminPanelFromRouteEffects: {
    openAdminPanelParam: boolean | undefined;
    isAdminAccount: boolean;
  };
  showConfirmDialog: ShowInterviewConfirmDialog;
  signOut: () => void | Promise<void>;
};

/** Wire resolve-scenario, turn-audio, validation nav, admin panel route, and sign-out deps. */
export function useAriaInterviewBootMiscDepSyncWiring(params: AriaInterviewBootMiscDepSyncWiringParams) {
  const {
    resolveAssistantScenarioNumber: resolveAssistantScenarioNumberLocal,
    processTurnAudio,
    navigateBackToValidationReport,
    openAdminPanelFromRoute,
    openAdminPanelFromRouteEffects,
    showConfirmDialog,
    signOut,
  } = params;

  const resolveAssistantScenarioNumberDepsRef = useRef({} as ResolveAssistantScenarioNumberDeps);
  syncResolveAssistantScenarioNumberDeps(
    resolveAssistantScenarioNumberDepsRef,
    createResolveAssistantScenarioNumberSyncCtxFromScreen(resolveAssistantScenarioNumberLocal),
  );
  const resolveAssistantScenarioNumber = useCallback(
    (content: string, prev: MessageWithScenario[]) =>
      runResolveAssistantScenarioNumber(resolveAssistantScenarioNumberDepsRef.current, content, prev),
    [],
  );

  const processTurnAudioDepsRef = useRef({} as ProcessTurnAudioWithRetryDeps);
  syncProcessTurnAudioDeps(
    processTurnAudioDepsRef,
    createProcessTurnAudioSyncCtxFromScreen({
      ...processTurnAudio,
      deleteTurnAudioFile: runDeleteTurnAudioFile,
    }),
  );
  const deleteTurnAudioFile = useCallback(
    (nativeUri: string | null) => runDeleteTurnAudioFile(nativeUri),
    [],
  );
  const processTurnAudioWithRetry = useCallback(
    async (turnParams: {
      audioBlob: Blob | null;
      nativeUri: string | null;
      turnIndex: number;
      scenarioNumber: number | null;
    }) => runProcessTurnAudioWithRetry(processTurnAudioDepsRef.current, turnParams),
    [],
  );

  const handleInterviewSignOut = useCallback(() => {
    runConfirmInterviewSignOut({ showConfirmDialog, signOut });
  }, [showConfirmDialog, signOut]);

  const navigateBackToValidationReportDepsRef = useRef({} as NavigateBackToValidationReportDeps);
  syncNavigateBackToValidationReportDeps(
    navigateBackToValidationReportDepsRef,
    createNavigateBackToValidationReportSyncCtxFromScreen(navigateBackToValidationReport),
  );
  const handleBackToValidationReport = useCallback(
    () => runNavigateBackToValidationReport(navigateBackToValidationReportDepsRef.current),
    [],
  );

  const openAdminPanelFromRouteDepsRef = useRef({} as OpenAdminPanelFromRouteDeps);
  syncOpenAdminPanelFromRouteDeps(
    openAdminPanelFromRouteDepsRef,
    createOpenAdminPanelFromRouteSyncCtxFromScreen(openAdminPanelFromRoute),
  );
  useOpenAdminPanelFromRouteParam(openAdminPanelFromRouteDepsRef, openAdminPanelFromRouteEffects);

  return {
    resolveAssistantScenarioNumber,
    processTurnAudioWithRetry,
    deleteTurnAudioFile,
    handleInterviewSignOut,
    handleBackToValidationReport,
  };
}
