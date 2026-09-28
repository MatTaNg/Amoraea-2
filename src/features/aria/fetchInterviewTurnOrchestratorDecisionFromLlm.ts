import { buildInterviewTurnOrchestratorUserPrompt } from '@features/aria/buildInterviewTurnOrchestratorUserPrompt';
import { parseInterviewTurnOrchestratorLlmJson } from '@features/aria/parseInterviewTurnOrchestratorLlmJson';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import type {
  InterviewTurnOrchestratorDecision,
  InterviewTurnStateSnapshot,
} from '@features/aria/interviewTurnOrchestratorTypes';
import { INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_SHADOW_TIMEOUT_MS } from '@features/aria/interviewTurnOrchestratorConfig';
import {
  CLAUDE_SONNET_MODEL,
  getAnthropicEndpoint,
  getAnthropicRequestHeaders,
} from '@utilities/anthropicMessagesClient';
import { fetchWithTimeout } from '@utilities/fetchWithTimeout';

export async function fetchInterviewTurnOrchestratorDecisionFromLlm(args: {
  snapshot: InterviewTurnStateSnapshot;
  messages: readonly MessageWithScenario[];
  constructFlags: PreClaudeScenarioConstructProbeFlags;
  metaCommentClassification: MetaCommentClassification | null;
  activeQuestionPreview: string;
  timeoutMs?: number;
}): Promise<InterviewTurnOrchestratorDecision | null> {
  const apiUrl = getAnthropicEndpoint();
  const headers = getAnthropicRequestHeaders();
  const timeoutMs = args.timeoutMs ?? INTERVIEW_TURN_ORCHESTRATOR_PHASE4_LLM_SHADOW_TIMEOUT_MS;
  const res = await fetchWithTimeout(apiUrl, {
    method: 'POST',
    headers,
    timeoutMs,
    body: JSON.stringify({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 280,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: buildInterviewTurnOrchestratorUserPrompt({
            snapshot: args.snapshot,
            messages: args.messages,
            constructFlags: args.constructFlags,
            metaCommentClassification: args.metaCommentClassification,
          }),
        },
      ],
    }),
  });
  const data = (await res.json()) as {
    content?: { text?: string }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message ?? `HTTP ${res.status}`);
  }
  const raw = data.content?.[0]?.text ?? '';
  return parseInterviewTurnOrchestratorLlmJson({
    raw,
    activeQuestionPreview: args.activeQuestionPreview,
  });
}
