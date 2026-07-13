import * as preamble from '@features/aria/ariaInterviewScreenPreambleBindings';
import * as wiring from '@features/aria/ariaInterviewScreenWiringImports';
import type { AriaInterviewScreenSessionState } from '@features/aria/hooks/useAriaInterviewScreenSessionState';
import type { AriaInterviewBootMiscDepSyncWiringParams } from '@features/aria/hooks/useAriaInterviewBootMiscDepSyncWiring';

export type BuildAriaInterviewBootMiscDepSyncWiringParamsFromScreenInput = {
  userId: string;
  navigation: unknown;
  signOut: () => void | Promise<void>;
  session: AriaInterviewScreenSessionState;
  openAdminPanelParam: boolean | undefined;
  isAdminAccount: boolean;
};

/** Assemble boot-misc dep-sync params (scenario resolve, turn audio, nav, admin route, sign-out). */
export function buildAriaInterviewBootMiscDepSyncWiringParamsFromScreen(
  input: BuildAriaInterviewBootMiscDepSyncWiringParamsFromScreenInput,
): AriaInterviewBootMiscDepSyncWiringParams {
  const { userId, navigation, signOut, session, openAdminPanelParam, isAdminAccount } = input;
  const { shell, gate } = session;
  const { setShowAdminPanel, currentScenarioRef } = shell;
  const { currentInterviewMomentRef } = gate.moments;
  const { interviewSessionIdRef } = gate.progressReset;

  return {
    resolveAssistantScenarioNumber: {
      currentInterviewMomentRef,
      currentScenarioRef,
      detectScenarioFromResponse: wiring.detectScenarioFromResponse,
      isScenarioCQ1Prompt: wiring.isScenarioCQ1Prompt,
      getScenarioNumberForNewMessage: wiring.getScenarioNumberForNewMessage,
    },
    processTurnAudio: {
      userId,
      interviewSessionIdRef,
      supabaseAnonKey: preamble.SUPABASE_ANON_KEY,
      getResolvedSupabaseUrl: preamble.getResolvedSupabaseUrl,
      bytesToBase64: preamble.bytesToBase64,
    },
    navigateBackToValidationReport: { navigation },
    openAdminPanelFromRoute: { setShowAdminPanel, navigation },
    openAdminPanelFromRouteEffects: {
      openAdminPanelParam,
      isAdminAccount,
    },
    showConfirmDialog: wiring.showConfirmDialog,
    signOut,
  };
}
