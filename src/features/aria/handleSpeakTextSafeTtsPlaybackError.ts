import type { VoiceState } from '@features/aria/hooks/useAriaInterviewSession';

/** Native TTS error handler — browser gesture/tab-abort paths removed. */
export function handleSpeakTextSafeTtsPlaybackError(args: {
  err: unknown;
  text: string;
  interviewSpeechRole?: 'assistant_response';
  skipInterviewSpeechAdvance: boolean;
  setVoiceState: (state: VoiceState) => void;
  applyInterviewSpeechComplete: (rawText: string) => void;
}): void {
  if (__DEV__) {
    console.warn(
      'TTS failed, falling back to visual display:',
      args.err instanceof Error ? args.err.message : args.err,
    );
    if (args.err instanceof Error && args.err.stack) {
      console.warn('[TTS] stack:', args.err.stack.split('\n').slice(0, 8).join('\n'));
    }
  }
  args.setVoiceState('idle');
  if (
    args.interviewSpeechRole === 'assistant_response' &&
    !args.skipInterviewSpeechAdvance
  ) {
    try {
      args.applyInterviewSpeechComplete(args.text);
    } catch (completeErr) {
      if (__DEV__) {
        console.warn(
          '[TTS] applyInterviewSpeechComplete after playback error failed:',
          completeErr instanceof Error ? completeErr.message : completeErr,
        );
      }
    }
  }
}
