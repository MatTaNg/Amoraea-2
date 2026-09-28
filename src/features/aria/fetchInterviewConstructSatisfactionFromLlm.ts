import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import { buildInterviewConstructSatisfactionLlmPrompt } from '@features/aria/interviewConstructSatisfactionLlmPrompt';
import type { ConstructSatisfactionLlmResult } from '@features/aria/interviewConstructSatisfactionLlmTypes';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_LIVE_TIMEOUT_MS,
  INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_SHADOW_TIMEOUT_MS,
} from '@features/aria/interviewTurnOrchestratorConfig';
import {
  CLAUDE_SONNET_MODEL,
  getAnthropicEndpoint,
  getAnthropicRequestHeaders,
} from '@utilities/anthropicMessagesClient';
import { fetchWithTimeout } from '@utilities/fetchWithTimeout';

export function recentUserTurnsForConstructSatisfaction(
  messages: readonly MessageWithScenario[],
  scenarioNumber: number,
  limit = 4,
): string[] {
  const turns: string[] = [];
  for (let i = messages.length - 1; i >= 0 && turns.length < limit; i--) {
    const m = messages[i];
    if (m.role !== 'user') continue;
    if ((m.scenarioNumber ?? 0) !== scenarioNumber) continue;
    const c = String(m.content ?? '').trim();
    if (c) turns.unshift(c);
  }
  return turns;
}

export function parseConstructSatisfactionLlmJson(raw: string): ConstructSatisfactionLlmResult | null {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      satisfied?: boolean;
      confidence?: number;
      reason?: string;
    };
    if (typeof parsed.satisfied !== 'boolean') return null;
    return {
      satisfied: parsed.satisfied,
      confidence:
        typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
          ? parsed.confidence
          : 0.5,
      reason: String(parsed.reason ?? '').slice(0, 240),
    };
  } catch {
    return null;
  }
}

export async function fetchInterviewConstructSatisfactionFromLlm(args: {
  probeId: InterviewCanonicalProbeId;
  activeQuestionPreview: string;
  userText: string;
  recentUserTurns: string[];
  timeoutMs?: number;
}): Promise<ConstructSatisfactionLlmResult | null> {
  const apiUrl = getAnthropicEndpoint();
  const headers = getAnthropicRequestHeaders();
  const timeoutMs = args.timeoutMs ?? INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_SHADOW_TIMEOUT_MS;
  const res = await fetchWithTimeout(apiUrl, {
    method: 'POST',
    headers,
    timeoutMs,
    body: JSON.stringify({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 120,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: buildInterviewConstructSatisfactionLlmPrompt(args),
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
  return parseConstructSatisfactionLlmJson(raw);
}

/** Default live-turn timeout — shorter than shadow to limit mic idle time. */
export function constructSatisfactionLlmLiveTimeoutMs(): number {
  return INTERVIEW_TURN_ORCHESTRATOR_PHASE3_LLM_LIVE_TIMEOUT_MS;
}
