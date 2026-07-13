import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

export type ClosingPhase = 'needed' | 'asked' | 'answered';

export type ClosingQuestionActionsDeps = {
  closingQuestionAskedRef: MutableRefObject<Record<number, boolean>>;
  closingQuestionAnsweredRef: MutableRefObject<Record<number, boolean>>;
  lastClosingQuestionScenarioRef: MutableRefObject<number | null>;
  lastAnsweredClosingScenarioRef: MutableRefObject<number | null>;
  setClosingQuestionState: Dispatch<SetStateAction<Record<1 | 2 | 3, ClosingPhase>>>;
};

export type PostInterviewFeedbackAlertDeps = {
  showSimpleAlert: (title: string, message: string) => void;
};

export type NavigateBackToValidationReportDeps = {
  navigation: {
    canGoBack?: () => boolean;
    goBack?: () => void;
    replace?: (route: string) => void;
  };
};

export type AriaScreenBootEffectsDeps = {
  setValidationTrackInterviewHandoffActive: (active: boolean) => void;
  remoteLog: (event: string, data: Record<string, unknown>) => void | Promise<void>;
  getResolvedSupabaseUrl: () => string | null | undefined;
  bumpAriaScreenMountGeneration: () => void;
};
