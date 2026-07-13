import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import {
  finalizePostClaudePendingInterviewCompletion,
  markPostClaudeInterviewCompletionState,
} from '@features/aria/finalizePostClaudePendingInterviewCompletion';
import { sanitizePostClaudeClosingDisplayText } from '@features/aria/sanitizePostClaudeClosingDisplayText';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';
import { ALPHA_MODE } from '@features/aria/scoreInterviewModuleConstants';
import { remoteLog } from '@utilities/remoteLog';

/** Main-path `[INTERVIEW_COMPLETE]` handling after closing failsafes and before `[SCENARIO_COMPLETE:N]`. */
export async function runPostClaudeInterviewCompleteTokenGate(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  text: string,
  speakAssistantTurn: PostClaudeSpeakAssistantTurn,
): Promise<{ handled: boolean }> {
  if (!text.includes('[INTERVIEW_COMPLETE]')) {
    return { handled: false };
  }

  if (deps.isInterviewCompleteRef.current) {
    void remoteLog('[INTERVIEW_COMPLETE_DUPLICATE_SKIPPED]', {
      interviewSessionId: deps.interviewSessionIdRef.current,
      preview: text.slice(0, 200),
    });
    deps.setVoiceState('idle');
    return { handled: true };
  }

  void deps.persistInterviewAttemptSessionLifecycle(deps.interviewSessionAttemptIdRef.current, 'completed');
  await remoteLog('[0] INTERVIEW_COMPLETE token detected in response', {
    isAdmin: deps.isAdmin,
    ALPHA_MODE,
    userId: deps.userId ?? null,
    responseLength: text.length,
    interviewStatus: deps.interviewStatusRef.current,
  });
  if (__DEV__) {
    console.log('=== INTERVIEW_COMPLETE TOKEN DETECTED ===');
  }
  markPostClaudeInterviewCompletionState(deps);
  const displayText = sanitizePostClaudeClosingDisplayText(deps, params.messagesToUse, params.trimmed, text);
  const finalAssistant: PostClaudeInterviewMessage = {
    role: 'assistant',
    content: displayText,
    scenarioNumber: deps.resolveAssistantScenarioNumber(displayText, params.messagesToUse),
  };
  const finalMessages = [...params.messagesToUse, finalAssistant];
  deps.setMessages(finalMessages);
  const transcriptForScoring = finalMessages.filter((m) => m.role === 'user' || m.role === 'assistant');
  try {
    await speakAssistantTurn(displayText, {
      telemetrySource: 'turn',
      interviewSpeechRole: 'assistant_response',
    });
  } catch {
    /* proceed to scoring even if TTS fails */
  } finally {
    deps.setVoiceState('idle');
  }
  await finalizePostClaudePendingInterviewCompletion(deps, {
    source: 'interview_complete_token',
    transcriptForScoring,
    persistSessionLifecycle: false,
    markCompletionState: false,
  });
  return { handled: true };
}
