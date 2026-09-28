import { buildInterviewWithinScenarioAckLlmPrompt } from '@features/aria/interviewWithinScenarioAckLlmPrompt';
import {
  isValidWithinScenarioAck,
  parseWithinScenarioAckFromLlm,
} from '@features/aria/interviewWithinScenarioAckLlmValidation';
import { INTERVIEW_WITHIN_SCENARIO_ACK_LLM_TIMEOUT_MS } from '@features/aria/interviewTurnOrchestratorConfig';
import {
  CLAUDE_SONNET_MODEL,
  getAnthropicEndpoint,
  getAnthropicRequestHeaders,
} from '@utilities/anthropicMessagesClient';
import { fetchWithTimeout } from '@utilities/fetchWithTimeout';

export async function fetchInterviewWithinScenarioAckFromLlm(args: {
  userText: string;
  activeQuestionPreview: string;
  recentAckPreviews: string[];
  timeoutMs?: number;
}): Promise<string | null> {
  const apiUrl = getAnthropicEndpoint();
  const headers = getAnthropicRequestHeaders();
  const timeoutMs = args.timeoutMs ?? INTERVIEW_WITHIN_SCENARIO_ACK_LLM_TIMEOUT_MS;
  const res = await fetchWithTimeout(apiUrl, {
    method: 'POST',
    headers,
    timeoutMs,
    body: JSON.stringify({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 40,
      temperature: 0.4,
      messages: [
        {
          role: 'user',
          content: buildInterviewWithinScenarioAckLlmPrompt(args),
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
  const parsed = parseWithinScenarioAckFromLlm(data.content?.[0]?.text ?? '');
  if (!parsed || !isValidWithinScenarioAck(parsed)) {
    return null;
  }
  return parsed.trim();
}
