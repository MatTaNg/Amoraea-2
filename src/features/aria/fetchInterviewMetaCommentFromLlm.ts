import { buildInterviewMetaCommentLlmPrompt } from '@features/aria/interviewMetaCommentLlmPrompt';
import type { MetaCommentLlmLabel, MetaCommentLlmResult } from '@features/aria/interviewMetaCommentLlmTypes';
import { INTERVIEW_META_COMMENT_LLM_TIMEOUT_MS } from '@features/aria/interviewTurnOrchestratorConfig';
import type { MetaCommentType } from '@features/aria/metaCommentClassificationTypes';
import {
  CLAUDE_SONNET_MODEL,
  getAnthropicEndpoint,
  getAnthropicRequestHeaders,
} from '@utilities/anthropicMessagesClient';
import { fetchWithTimeout } from '@utilities/fetchWithTimeout';

const META_COMMENT_LLM_TYPES = new Set<MetaCommentLlmLabel>([
  'frustration',
  'confusion',
  'checking_in',
  'skip_request',
  'inability',
  'already_answered',
  'ambiguous_short',
  'none',
  'substantive_answer',
  'cut_off',
]);

function normalizeMetaCommentLlmLabel(raw: string): MetaCommentLlmLabel | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, '_');
  if (t === 'repeat_request' || t === 'confusion_repeat_request') {
    return 'confusion';
  }
  if (META_COMMENT_LLM_TYPES.has(t as MetaCommentLlmLabel)) {
    return t as MetaCommentLlmLabel;
  }
  return null;
}

export function parseMetaCommentLlmJson(raw: string): MetaCommentLlmResult | null {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    const parsed = JSON.parse(jsonMatch[0]) as {
      meta_type?: string;
      confidence?: number;
      confusion_subtype?: string | null;
      reason?: string;
    };
    const metaType = normalizeMetaCommentLlmLabel(String(parsed.meta_type ?? ''));
    if (!metaType) return null;
    const confusionSubtype =
      parsed.confusion_subtype === 'repeat_request' ? ('repeat_request' as const) : undefined;
    return {
      metaType,
      confidence:
        typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
          ? parsed.confidence
          : 0.5,
      ...(confusionSubtype ? { confusionSubtype } : {}),
      reason: String(parsed.reason ?? '').slice(0, 240),
    };
  } catch {
    return null;
  }
}

export function metaCommentLlmResultToClassification(
  llm: MetaCommentLlmResult,
): { type: MetaCommentType; confidence: number; confusion_subtype?: 'repeat_request' } | null {
  if (
    llm.metaType === 'none' ||
    llm.metaType === 'substantive_answer' ||
    llm.metaType === 'cut_off'
  ) {
    return null;
  }
  if (llm.metaType === 'ambiguous_short') {
    return { type: 'ambiguous_short', confidence: llm.confidence };
  }
  return {
    type: llm.metaType,
    confidence: llm.confidence,
    ...(llm.confusionSubtype ? { confusion_subtype: llm.confusionSubtype } : {}),
  };
}

export async function fetchInterviewMetaCommentFromLlm(args: {
  activeQuestionPreview: string;
  userText: string;
  heuristicType: string | null;
  heuristicConfidence: number | null;
  timeoutMs?: number;
}): Promise<MetaCommentLlmResult | null> {
  const apiUrl = getAnthropicEndpoint();
  const headers = getAnthropicRequestHeaders();
  const timeoutMs = args.timeoutMs ?? INTERVIEW_META_COMMENT_LLM_TIMEOUT_MS;
  const res = await fetchWithTimeout(apiUrl, {
    method: 'POST',
    headers,
    timeoutMs,
    body: JSON.stringify({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: 100,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: buildInterviewMetaCommentLlmPrompt(args),
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
  return parseMetaCommentLlmJson(data.content?.[0]?.text ?? '');
}
