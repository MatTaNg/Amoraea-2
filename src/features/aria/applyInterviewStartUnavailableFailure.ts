import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { INTERVIEW_START_UNAVAILABLE_MESSAGE } from '@features/aria/interviewUserFacingErrors';
import type { StartInterviewDeps } from '@features/aria/sessionLifecycleTypes';

/** Reset pre-start state and surface a single servers-down message (no fake welcome / in-progress). */
export async function applyInterviewStartUnavailableFailure(
  deps: Pick<
    StartInterviewDeps,
    | 'hasResumedRef'
    | 'setVoiceState'
    | 'setStatus'
    | 'setInterviewStatus'
    | 'setMicError'
    | 'setMessages'
    | 'speakTextSafe'
  >,
  options?: { speak?: boolean },
): Promise<void> {
  deps.hasResumedRef.current = false;
  deps.setVoiceState('idle');
  deps.setStatus('intro');
  deps.setInterviewStatus('not_started');
  deps.setMicError(INTERVIEW_START_UNAVAILABLE_MESSAGE);
  const errorRow: MessageWithScenario = {
    role: 'assistant',
    content: INTERVIEW_START_UNAVAILABLE_MESSAGE,
  };
  deps.setMessages([errorRow]);
  if (options?.speak !== false) {
    await deps.speakTextSafe(INTERVIEW_START_UNAVAILABLE_MESSAGE, { telemetrySource: 'greeting' }).catch(
      () => {},
    );
  }
}
