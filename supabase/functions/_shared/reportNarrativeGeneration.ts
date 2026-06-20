/**
 * Deno copy for Edge Functions — keep aligned with src/utilities/reportNarrativeGeneration.ts
 */

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

export function anthropicStoppedDueToMaxTokens(stopReason: string | null | undefined): boolean {
  return stopReason === 'max_tokens';
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
