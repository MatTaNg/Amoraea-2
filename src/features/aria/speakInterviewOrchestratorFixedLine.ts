import {
  INTERVIEW_FIXED_LINES,
  type InterviewFixedLineId,
} from '@features/aria/interviewCanonicalProbeRegistry';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { ASSISTANT_INTERVIEW_SPEECH } from '@features/aria/interviewTtsSpeakOptions';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import {
  finishPreClaudeSkipInjectionTurn,
  isPreClaudeTurnSkipInjectionRouteActive,
  scenarioTagForSkipMoment,
} from '@features/aria/preClaudeTurnSkipInjectionShared';
import { getSessionLogRuntime, writeSessionLog } from '@utilities/sessionLogging';
import { remoteLog } from '@utilities/remoteLog';

/** Deliver orchestrator speak_fixed_line actions (score / go-back declines). */
export async function speakInterviewOrchestratorFixedLine(args: {
  deps: PreClaudeTurnGateDeps;
  trimmed: string;
  messagesToUse: MessageWithScenario[];
  lineId: InterviewFixedLineId;
}): Promise<boolean> {
  if (!isPreClaudeTurnSkipInjectionRouteActive(args.deps)) {
    return false;
  }

  const line = INTERVIEW_FIXED_LINES[args.lineId];
  const tag = scenarioTagForSkipMoment(args.deps, args.messagesToUse);
  const declineMsg: MessageWithScenario = {
    role: 'assistant',
    content: line,
    scenarioNumber: tag as 1 | 2 | 3,
    interviewMoment: args.deps.currentInterviewMomentRef.current,
  };
  args.deps.setMessages([...args.messagesToUse, declineMsg]);

  if (args.deps.userId) {
    const r = getSessionLogRuntime();
    writeSessionLog({
      userId: args.deps.userId,
      attemptId: r.attemptId,
      eventType: args.lineId === 'score_decline' ? 'score_request_declined' : 'go_back_request_declined',
      eventData: {
        moment_number: args.deps.currentInterviewMomentRef.current,
        scenario_number: tag,
        transcript_preview: args.trimmed.slice(0, 200),
        aira_response_delivered: line,
        source: 'orchestrator_execute',
      },
      platform: r.platform,
    });
  }

  void remoteLog('[ORCHESTRATOR_EXECUTE_FIXED_LINE]', {
    interviewSessionId: args.deps.interviewSessionIdRef.current,
    lineId: args.lineId,
  });

  await args.deps.speakTextSafe(line, {
    ...ASSISTANT_INTERVIEW_SPEECH,
    allowDuplicateConsecutiveTts: true,
    skipLastQuestionRef: true,
  });
  finishPreClaudeSkipInjectionTurn(args.deps);
  return true;
}
