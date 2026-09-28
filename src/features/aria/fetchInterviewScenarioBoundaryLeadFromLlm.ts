import {
  buildInterviewScenarioBoundaryLlmPrompt,
  staticScenarioBoundaryLeadFallback,
} from '@features/aria/interviewScenarioBoundaryLlmPrompt';
import {
  isValidScenarioBoundaryLead,
  parseScenarioBoundaryLeadFromLlm,
} from '@features/aria/interviewScenarioBoundaryLlmValidation';
import { INTERVIEW_SCENARIO_BOUNDARY_LLM_TIMEOUT_MS } from '@features/aria/interviewTurnOrchestratorConfig';
import {
  CLAUDE_SONNET_MODEL,
  getAnthropicEndpoint,
  getAnthropicRequestHeaders,
} from '@utilities/anthropicMessagesClient';
import { fetchWithTimeout } from '@utilities/fetchWithTimeout';

export async function fetchInterviewScenarioBoundaryLeadFromLlm(args: {
  completedScenario: 1 | 2 | 3;
  userCorpus: string;
  timeoutMs?: number;
}): Promise<string | null> {
  const staticFallback = staticScenarioBoundaryLeadFallback(args.completedScenario);
  const apiUrl = getAnthropicEndpoint();
  const headers = getAnthropicRequestHeaders();
  const timeoutMs = args.timeoutMs ?? INTERVIEW_SCENARIO_BOUNDARY_LLM_TIMEOUT_MS;
  const res = await fetchWithTimeout(apiUrl, {
    method: 'POST',
    headers,
    timeoutMs,
    body: JSON.stringify({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 160,
      temperature: 0.35,
      messages: [
        {
          role: 'user',
          content: buildInterviewScenarioBoundaryLlmPrompt({
            completedScenario: args.completedScenario,
            userCorpus: args.userCorpus,
            staticFallback,
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
  const parsed = parseScenarioBoundaryLeadFromLlm(data.content?.[0]?.text ?? '');
  if (!parsed || !isValidScenarioBoundaryLead(parsed, args.completedScenario)) {
    return null;
  }
  return parsed.trim();
}
