import fs from 'node:fs';

const preamblePath = 'src/features/aria/ariaInterviewModulePreamble.ts';
const preambleLines = fs.readFileSync(preamblePath, 'utf8').split(/\r?\n/);

const errorBlock = preambleLines.slice(182, 298).join('\n');
const errorHeader = `/** Amoraea-voiced and chat error copy for recording, transcription, and API failures. */\n\n`;
fs.writeFileSync('src/features/aria/interviewUserFacingErrors.ts', errorHeader + errorBlock, 'utf8');

const errorReExport = `export {
  AMORAEA_ERROR_MESSAGES,
  CHAT_ERROR_MESSAGES,
  assistantMessageForRecordingHardwareFailure,
  assistantMessageForRecordingOrTranscriptionFailure,
  getErrorMessage,
  getWhisperInfraExhaustedUserMessage,
  pickWhisperUploadFilename,
  randomFrom,
  whisperUploadFilePart,
} from '@features/aria/interviewUserFacingErrors';`;

const preambleOut = [
  ...preambleLines.slice(0, 182),
  errorReExport,
  ...preambleLines.slice(298),
].join('\n');
fs.writeFileSync(preamblePath, preambleOut, 'utf8');

const syncPath = 'src/features/aria/syncAriaInterviewDepsRefs.ts';
const syncLines = fs.readFileSync(syncPath, 'utf8').split(/\r?\n/);

const typesHeader = `import type { MutableRefObject } from 'react';

import type { EmotionModalOrchestrationDeps } from '@features/aria/emotionModalOrchestrationTypes';
import type { InterviewWebTtsRuntimeDeps } from '@features/aria/hooks/useInterviewWebTtsRuntime';
import type { SpeakTextSafeDeps } from '@features/aria/speakTextSafeDeps';
import type { ClaudeParallelStreamTtsCallDeps } from '@features/aria/claudeParallelStreamTtsCallTypes';
import type { KickPostClosingInterviewCompletionDeps } from '@features/aria/hooks/useKickPostClosingInterviewCompletion';
import type { InterviewWebTabRestoreSessionDeps } from '@features/aria/hooks/useInterviewWebTabRestoreSession';
import type { ScoreScenarioDeps } from '@features/aria/scoreScenarioTypes';
import type { PostClaudeAssistantTurnDeps } from '@features/aria/postClaudeAssistantTurnTypes';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import type { TranscribeSafeDeps } from '@features/aria/transcribeSafeTypes';
import type { AriaInterviewAudioRecorderDeps } from '@features/aria/hooks/useAriaInterviewAudioRecorder';
import type { InterviewMicLifecycleDeps } from '@features/aria/hooks/interviewMicLifecycleTypes';
import type { HandleNativeOrWhisperMicPressDeps } from '@features/aria/handleNativeOrWhisperMicPressTypes';
import type { InterviewSessionLifecycleDeps } from '@features/aria/sessionLifecycleTypes';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';

`;

const typesBody = syncLines.slice(110, 137).join('\n');
fs.writeFileSync(
  'src/features/aria/syncAriaInterviewDepsTypes.ts',
  typesHeader + typesBody + '\n',
  'utf8',
);

const earlyTtsHeader = `import type { ClaudeParallelStreamTtsCallDeps } from '@features/aria/claudeParallelStreamTtsCallTypes';
import type { EmotionModalOrchestrationDeps } from '@features/aria/emotionModalOrchestrationTypes';
import type { InterviewWebTtsRuntimeDeps } from '@features/aria/hooks/useInterviewWebTtsRuntime';
import type { SpeakTextSafeDeps } from '@features/aria/speakTextSafeDeps';
import type {
  AriaInterviewDepsRefs,
  AriaInterviewDepsSyncContext,
} from '@features/aria/syncAriaInterviewDepsTypes';

`;

const earlyTtsBody = syncLines.slice(138, 289).join('\n');
fs.writeFileSync(
  'src/features/aria/syncAriaInterviewEarlyAndTtsDepsRefs.ts',
  earlyTtsHeader + earlyTtsBody + '\n',
  'utf8',
);

const syncImportInsert = `export type {
  AriaInterviewDepsRefs,
  AriaInterviewDepsSyncContext,
} from '@features/aria/syncAriaInterviewDepsTypes';
export { mergeAriaInterviewSyncCtx } from '@features/aria/syncAriaInterviewDepsTypes';
export {
  syncAriaInterviewEarlyDeps,
  syncAriaInterviewTtsPipelineDeps,
} from '@features/aria/syncAriaInterviewEarlyAndTtsDepsRefs';

`;

const syncOut = [
  ...syncLines.slice(0, 110),
  syncImportInsert.trim(),
  ...syncLines.slice(289),
].join('\n');
fs.writeFileSync(syncPath, syncOut, 'utf8');
