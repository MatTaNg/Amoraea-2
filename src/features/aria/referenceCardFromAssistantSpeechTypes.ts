import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { ActiveScenario } from '@app/screens/UserInterviewLayout';
import type { InterviewFirstNameProfile } from '@features/aria/interviewerFrameworkPrompt';
import type { InterviewUiPhase } from '@features/aria/sessionLifecycleTypes';
import type { SessionLogRuntimeContext } from '@utilities/sessionLogging/sessionLogContext';
import type { SessionLogInsert } from '@utilities/sessionLogging/writeSessionLog';

export type ApplyReferenceCardFromAssistantSpeechDeps = {
  messages: ReadonlyArray<{ role: string; content?: string }>;
  committedScenarioRef: MutableRefObject<ActiveScenario | null>;
  moment5PrimaryAnchorDeliveredSessionRef: MutableRefObject<boolean>;
  moment5QuestionDeliveredRef?: MutableRefObject<boolean>;
  currentInterviewMomentRef?: MutableRefObject<number>;
  lastQuestionTextRef?: MutableRefObject<string>;
  scenarioAContemptProbeAskedRef?: MutableRefObject<boolean>;
  scenarioARepairQuestionAskedRef?: MutableRefObject<boolean>;
  s2RepairProbeDeliveredRef?: MutableRefObject<boolean>;
  setReferenceCardScenario: Dispatch<SetStateAction<ActiveScenario | null>>;
  setReferenceCardPrompt: Dispatch<SetStateAction<string | null>>;
  setInterviewUiPhase: Dispatch<SetStateAction<InterviewUiPhase>>;
};

export type ApplyInterviewSpeechCompleteDeps = {
  applyReferenceCardFromAssistantSpeech: (rawText: string) => void;
  scenarioRefSync?: InterviewScenarioRefSyncTarget;
};

export type ShowChatErrorDeps = {
  setMessages: Dispatch<SetStateAction<Array<{ role: string; content: string; isError?: boolean }>>>;
  setConversationErrorNotice?: Dispatch<SetStateAction<string | null>>;
};

export type ProfileNameSourceDebugDeps = {
  getInterviewUserFirstNameForPrompt: (profile: InterviewFirstNameProfile) => string;
  writeSessionLog: (row: SessionLogInsert) => void;
  getSessionLogRuntime: () => Readonly<SessionLogRuntimeContext>;
};

export type InterviewScrollToEndDeps = {
  scrollViewRef: MutableRefObject<{ scrollToEnd?: (opts: { animated: boolean }) => void } | null>;
};
