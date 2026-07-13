import type { MutableRefObject } from 'react';

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

/** Runtime values passed from AriaScreen each render — intentionally loose to avoid a 200-field type. */
export type AriaInterviewDepsSyncContext = Record<string, unknown>;

export function mergeAriaInterviewSyncCtx(
  core: AriaInterviewDepsSyncContext,
  extra: AriaInterviewDepsSyncContext,
): AriaInterviewDepsSyncContext {
  const merged = { ...core };
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) {
      merged[key] = value;
    }
  }
  return merged;
}

export type AriaInterviewDepsRefs = {
  emotionModalOrchestrationDepsRef: MutableRefObject<EmotionModalOrchestrationDeps>;
  webTtsRuntimeDepsRef: MutableRefObject<InterviewWebTtsRuntimeDeps>;
  speakTextSafeDepsRef: MutableRefObject<SpeakTextSafeDeps>;
  claudeParallelStreamTtsDepsRef: MutableRefObject<ClaudeParallelStreamTtsCallDeps>;
  kickPostClosingCompletionDepsRef: MutableRefObject<KickPostClosingInterviewCompletionDeps>;
  webTabRestoreSessionDepsRef: MutableRefObject<InterviewWebTabRestoreSessionDeps>;
  scoreScenarioDepsRef: MutableRefObject<ScoreScenarioDeps>;
  postClaudeTurnDepsRef: MutableRefObject<PostClaudeAssistantTurnDeps>;
  preClaudeTurnGateDepsRef: MutableRefObject<PreClaudeTurnGateDeps>;
  transcribeSafeDepsRef: MutableRefObject<TranscribeSafeDeps>;
  audioRecorderDepsRef: MutableRefObject<AriaInterviewAudioRecorderDeps>;
  micLifecycleDepsRef: MutableRefObject<InterviewMicLifecycleDeps>;
  handleNativeOrWhisperMicPressDepsRef: MutableRefObject<HandleNativeOrWhisperMicPressDeps>;
  sessionLifecycleDepsRef: MutableRefObject<InterviewSessionLifecycleDeps>;
  scoreInterviewDepsRef: MutableRefObject<ScoreInterviewDeps>;
};
