import type { HandleSendTypedDeps, HandleSendTypedParams } from '@features/aria/handleSendTypedTypes';
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';

export function runHandleSendTyped(deps: HandleSendTypedDeps, params: HandleSendTypedParams): void {
  const text = params.text.trim();
  if (!text) return;
  deps.touchActivity();
  deps.setTypedAnswer('');
  deps.setMicWarning(null);
  deps.lastVoiceTurnLanguageRef.current = null;
  deps.lastVoiceTurnConfidenceRef.current = null;
  if (deps.userId && deps.ttsLineInFlightRef.current) {
    const r = getSessionLogRuntime();
    writeSessionLog({
      userId: deps.userId,
      attemptId: r.attemptId,
      eventType: 'tts_interrupted',
      eventData: { source: 'typed_send' },
      platform: r.platform,
    });
  }
  deps.stopElevenLabsSpeech();
  void deps.processUserSpeech(text);
}
