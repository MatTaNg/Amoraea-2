import { buildInterviewCutOffCompletenessLlmPrompt } from '@features/aria/interviewCutOffCompletenessLlmPrompt';
import type { CutOffCompletenessLlmResult } from '@features/aria/interviewCutOffDetectionTypes';
import { INTERVIEW_CUT_OFF_COMPLETENESS_LLM_TIMEOUT_MS } from '@features/aria/interviewTurnOrchestratorConfig';
import {
  CLAUDE_SONNET_MODEL,
  getAnthropicEndpoint,
  getAnthropicRequestHeaders,
} from '@utilities/anthropicMessagesClient';
import { fetchWithTimeout } from '@utilities/fetchWithTimeout';

export function parseCutOffCompletenessLlmJson(raw: string): CutOffCompletenessLlmResult | null {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      cut_off?: boolean;
      confidence?: number;
      reason?: string;
    };
    if (typeof parsed.cut_off !== 'boolean') return null;
    return {
      cutOff: parsed.cut_off,
      confidence:
        typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
          ? parsed.confidence
          : 0.5,
      reason: String(parsed.reason ?? '').slice(0, 200),
    };
  } catch {
    return null;
  }
}

export async function fetchInterviewCutOffCompletenessFromLlm(args: {
  activeQuestionPreview: string;
  userText: string;
  timeoutMs?: number;
}): Promise<CutOffCompletenessLlmResult | null> {
  const apiUrl = getAnthropicEndpoint();
  const headers = getAnthropicRequestHeaders();
  const timeoutMs = args.timeoutMs ?? INTERVIEW_CUT_OFF_COMPLETENESS_LLM_TIMEOUT_MS;
  const res = await fetchWithTimeout(apiUrl, {
    method: 'POST',
    headers,
    timeoutMs,
    body: JSON.stringify({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 80,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: buildInterviewCutOffCompletenessLlmPrompt(args),
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
  return parseCutOffCompletenessLlmJson(data.content?.[0]?.text ?? '');
}
