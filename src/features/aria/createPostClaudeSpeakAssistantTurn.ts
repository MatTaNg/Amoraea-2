import { Platform } from 'react-native';

import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { PostClaudeAssistantTurnDeps } from '@features/aria/postClaudeAssistantTurnTypes';
import type { SpeakTextSafeOptions } from '@features/aria/speakTextSafeDeps';
import type { TtsTelemetrySource } from '@features/aria/telemetry/tsAutoplayTelemetry';

export type PostClaudeSpeakAssistantTurnOptions = SpeakTextSafeOptions & {
  silent?: boolean;
  interviewSpeechRole?: 'assistant_response';
  telemetrySource?: TtsTelemetrySource;
  skipQuestionDeliveredTelemetry?: boolean;
  skipInterviewSpeechAdvance?: boolean;
  skipQuestionTiming?: boolean;
  skipLastQuestionRef?: boolean;
  allowDuplicateConsecutiveTts?: boolean;
  /** Speak even when parallel streaming already played (e.g. canonical scenario-complete bundle after truncated stream). */
  forceSpeakDespiteParallelStream?: boolean;
  skipGestureGate?: boolean;
  ttsTriggerSource?: 'gesture_handler' | 'effect' | 'callback' | 'timeout' | 'preauthorized_element';
  immediateWebPlaybackElement?: HTMLAudioElement;
};

export type PostClaudeSpeakAssistantTurn = (
  spokenText: string,
  opts?: PostClaudeSpeakAssistantTurnOptions,
) => Promise<void>;

/** Routes TTS through parallel-stream completion or speakTextSafe depending on stream state. */
export function createPostClaudeSpeakAssistantTurn(
  deps: PostClaudeAssistantTurnDeps,
  parallelStreamingPlaybackUsed: boolean,
): PostClaudeSpeakAssistantTurn {
  return async (spokenText: string, opts?: PostClaudeSpeakAssistantTurnOptions) => {
    if (parallelStreamingPlaybackUsed && !opts?.forceSpeakDespiteParallelStream) {
      if (opts?.interviewSpeechRole === 'assistant_response' && !opts?.skipLastQuestionRef) {
        deps.lastQuestionTextRef.current = stripControlTokens(spokenText).trim();
      }
      if (Platform.OS === 'web' && deps.webTtsTabInterruptPendingReplayRef.current) {
        const fullReplay = stripControlTokens(spokenText).trim();
        if (fullReplay.length > 0 && deps.pendingGestureRestoreSpeakRef.current) {
          deps.pendingGestureRestoreSpeakRef.current = {
            ...deps.pendingGestureRestoreSpeakRef.current,
            text: fullReplay,
            queuedAtMs: deps.pendingGestureRestoreSpeakRef.current?.queuedAtMs ?? Date.now(),
          };
        }
        deps.setWebTabGestureRestoreOverlay(true);
        return;
      }
      if (opts?.interviewSpeechRole === 'assistant_response' && !opts?.skipInterviewSpeechAdvance) {
        deps.applyInterviewSpeechComplete(spokenText);
      }
      return;
    }
    await deps.speakTextSafe(spokenText, opts ?? ASSISTANT_INTERVIEW_SPEECH);
  };
}
