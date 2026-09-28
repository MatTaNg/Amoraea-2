import { fetchInterviewWithinScenarioAckFromLlm } from '@features/aria/fetchInterviewWithinScenarioAckFromLlm';
import {
  chooseBriefScenarioAck,
  recentAssistantMessagesForAck,
} from '@features/aria/interviewReflectionAckVariation';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { INTERVIEW_WITHIN_SCENARIO_ACK_LLM_ENABLED } from '@features/aria/interviewTurnOrchestratorConfig';
import { remoteLog } from '@utilities/remoteLog';

function recentAckPreviews(messages: readonly MessageWithScenario[]): string[] {
  const acks: string[] = [];
  for (const m of [...messages].reverse()) {
    if (m.role !== 'assistant') continue;
    const c = String(m.content ?? '').trim();
    if (!c) continue;
    const firstSentence = (c.match(/^[^.!?]+[.!?]?/)?.[0] ?? c).trim();
    if (firstSentence.length <= 80) acks.unshift(firstSentence);
    if (acks.length >= 3) break;
  }
  return acks;
}

export async function resolveWithinScenarioBriefAckForInterview(args: {
  messages: readonly MessageWithScenario[];
  userText: string;
  activeQuestionPreview: string;
  interviewSessionId?: string | null;
}): Promise<{ ack: string; source: 'llm' | 'static' }> {
  const staticAck =
    chooseBriefScenarioAck(recentAssistantMessagesForAck([...args.messages])) || 'Got it.';
  if (!INTERVIEW_WITHIN_SCENARIO_ACK_LLM_ENABLED) {
    return { ack: staticAck, source: 'static' };
  }

  try {
    const llmAck = await fetchInterviewWithinScenarioAckFromLlm({
      userText: args.userText,
      activeQuestionPreview: args.activeQuestionPreview,
      recentAckPreviews: recentAckPreviews(args.messages),
    });
    if (llmAck) {
      void remoteLog('[WITHIN_SCENARIO_ACK_LLM]', {
        interviewSessionId: args.interviewSessionId ?? null,
        source: 'llm',
        preview: llmAck.slice(0, 80),
      });
      return { ack: llmAck, source: 'llm' };
    }
  } catch (err) {
    void remoteLog('[WITHIN_SCENARIO_ACK_LLM]', {
      interviewSessionId: args.interviewSessionId ?? null,
      source: 'static',
      reason: 'llm_error',
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return { ack: staticAck, source: 'static' };
}
