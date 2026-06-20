import { invokeAnthropicMessages, type AnthropicMessagesResponse } from '@utilities/invokeAnthropicMessages';
import { invokeOpenAiChatWithMeta } from '@utilities/invokeOpenAiChat';
import type { AnthropicMessagesPayload } from '@utilities/invokeAnthropicMessages';
import type { OpenAiChatPayload } from '@utilities/invokeOpenAiChat';

export type ReportNarrativePipeline =
  | 'personal_full_report'
  | 'personal_partial_report'
  | 'relationship_validation_full'
  | 'relationship_validation_partial'
  | 'ai_reasoning';

export const REPORT_NARRATIVE_TOKEN_BUDGETS: Record<
  ReportNarrativePipeline,
  { initial: number; retry: number }
> = {
  personal_full_report: { initial: 6000, retry: 8192 },
  personal_partial_report: { initial: 3500, retry: 6000 },
  relationship_validation_full: { initial: 6500, retry: 8192 },
  relationship_validation_partial: { initial: 5500, retry: 8000 },
  ai_reasoning: { initial: 8000, retry: 12000 },
};

export type NarrativeGenerationOutcome = {
  pipeline: ReportNarrativePipeline;
  provider: 'anthropic' | 'openai';
  maxTokensRequested: number;
  inputTokens: number | null;
  outputTokens: number | null;
  stopReason: string | null;
  narrativeTruncatedDueToMaxTokens: boolean;
  retriedWithHigherBudget: boolean;
  textLength: number;
};

export function extractAnthropicMessageText(response: AnthropicMessagesResponse): string {
  return (response.content?.[0]?.text ?? '').trim();
}

export function anthropicStoppedDueToMaxTokens(stopReason: string | null | undefined): boolean {
  return stopReason === 'max_tokens';
}

export function openAiStoppedDueToLength(finishReason: string | null | undefined): boolean {
  return finishReason === 'length';
}

/** Heuristic: closing section exists but last line lacks terminal punctuation. */
export function closingSectionAppearsTruncated(markdown: string): boolean {
  const lower = markdown.toLowerCase();
  const closingIdx = lower.lastIndexOf('## closing');
  if (closingIdx < 0) return false;
  const tail = markdown.slice(closingIdx + '## Closing'.length).trim();
  const contentLines = tail
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('##'));
  if (contentLines.length === 0) return true;
  const lastLine = contentLines[contentLines.length - 1] ?? '';
  if (lastLine.length < 20) return false;
  return !/[.!?](?:['"])?$/.test(lastLine);
}

export function logNarrativeGenerationOutcome(outcome: NarrativeGenerationOutcome): void {
  const payload = {
    pipeline: outcome.pipeline,
    provider: outcome.provider,
    max_tokens: outcome.maxTokensRequested,
    input_tokens: outcome.inputTokens,
    output_tokens: outcome.outputTokens,
    stop_reason: outcome.stopReason,
    narrative_truncated_due_to_max_tokens: outcome.narrativeTruncatedDueToMaxTokens,
    retried_with_higher_budget: outcome.retriedWithHigherBudget,
    text_length: outcome.textLength,
  };
  if (outcome.narrativeTruncatedDueToMaxTokens) {
    console.warn('[ReportNarrative] narrative_truncated_due_to_max_tokens', payload);
  } else {
    console.log('[ReportNarrative] generation complete', payload);
  }
}

async function invokeAnthropicOnce(
  payload: AnthropicMessagesPayload,
): Promise<AnthropicMessagesResponse> {
  return invokeAnthropicMessages(payload);
}

export async function invokeAnthropicReportNarrative(
  pipeline: ReportNarrativePipeline,
  payload: Omit<AnthropicMessagesPayload, 'max_tokens'> & { max_tokens?: number },
): Promise<string> {
  const budgets = REPORT_NARRATIVE_TOKEN_BUDGETS[pipeline];
  const initialMax = payload.max_tokens ?? budgets.initial;
  const retryMax = budgets.retry;

  let response = await invokeAnthropicOnce({ ...payload, max_tokens: initialMax });
  let stopReason = response.stop_reason ?? null;
  let retried = false;

  if (anthropicStoppedDueToMaxTokens(stopReason)) {
    console.warn(
      `[ReportNarrative] ${pipeline}: stop_reason=max_tokens at ${initialMax} — retrying with ${retryMax}`,
    );
    response = await invokeAnthropicOnce({ ...payload, max_tokens: retryMax });
    stopReason = response.stop_reason ?? null;
    retried = true;
  }

  const text = extractAnthropicMessageText(response);
  logNarrativeGenerationOutcome({
    pipeline,
    provider: 'anthropic',
    maxTokensRequested: retried ? retryMax : initialMax,
    inputTokens: response.usage?.input_tokens ?? null,
    outputTokens: response.usage?.output_tokens ?? null,
    stopReason,
    narrativeTruncatedDueToMaxTokens: anthropicStoppedDueToMaxTokens(stopReason),
    retriedWithHigherBudget: retried,
    textLength: text.length,
  });

  if (!text) {
    throw new Error(`No report content returned from Claude (${pipeline})`);
  }
  return text;
}

export async function invokeOpenAiReportNarrative(
  pipeline: Extract<
    ReportNarrativePipeline,
    'relationship_validation_full' | 'relationship_validation_partial'
  >,
  payload: OpenAiChatPayload,
): Promise<string> {
  const budgets = REPORT_NARRATIVE_TOKEN_BUDGETS[pipeline];
  const initialMax = payload.max_tokens ?? budgets.initial;
  const retryMax = budgets.retry;

  let result = await invokeOpenAiChatWithMeta({ ...payload, max_tokens: initialMax });
  let finishReason = result.finishReason;
  let retried = false;

  if (openAiStoppedDueToLength(finishReason)) {
    console.warn(
      `[ReportNarrative] ${pipeline}: finish_reason=length at ${initialMax} — retrying with ${retryMax}`,
    );
    result = await invokeOpenAiChatWithMeta({ ...payload, max_tokens: retryMax });
    finishReason = result.finishReason;
    retried = true;
  }

  logNarrativeGenerationOutcome({
    pipeline,
    provider: 'openai',
    maxTokensRequested: retried ? retryMax : initialMax,
    inputTokens: result.usage?.prompt_tokens ?? null,
    outputTokens: result.usage?.completion_tokens ?? null,
    stopReason: finishReason,
    narrativeTruncatedDueToMaxTokens: openAiStoppedDueToLength(finishReason),
    retriedWithHigherBudget: retried,
    textLength: result.text.length,
  });

  return result.text;
}
