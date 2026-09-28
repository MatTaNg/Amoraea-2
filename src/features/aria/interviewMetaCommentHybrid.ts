import { evaluateHybridCutOffDetection, shouldSuppressMetaForCutOffDetection } from '@features/aria/interviewCutOffDetection';
import type { UserTurnMicStopTelemetry } from '@features/aria/interviewCutOffDetectionTypes';
import {
  metaCommentLlmResultToClassification,
  type MetaCommentLlmResult,
} from '@features/aria/fetchInterviewMetaCommentFromLlm';
import { getInabilitySubstantiveOverrideDetail } from '@features/aria/metaCommentInabilityOverride';
import type {
  MetaCommentClassification,
  ResolvedMetaComment,
} from '@features/aria/metaCommentClassificationTypes';
import { FRUSTRATION_META_CONFIDENCE_THRESHOLD } from '@features/aria/metaCommentClassificationTypes';
import { isExplicitRepeatRequestPreClassification } from '@features/aria/metaCommentConfusionRepeat';

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/** When true, await the fast meta-comment LLM before skip/meta inject gates run. */
export function shouldAwaitMetaCommentLlm(args: {
  trimmed: string;
  metaResolved: ResolvedMetaComment;
  micStopTelemetry?: UserTurnMicStopTelemetry | null;
}): boolean {
  if (args.metaResolved.exemptMetaCommentTurn) return false;
  if (isExplicitRepeatRequestPreClassification(args.trimmed)) return false;
  if (getInabilitySubstantiveOverrideDetail(args.trimmed)) return false;

  const cutOff = evaluateHybridCutOffDetection({
    transcriptText: args.trimmed,
    telemetry: args.micStopTelemetry,
  });
  if (shouldSuppressMetaForCutOffDetection(cutOff)) return false;

  const raw = args.metaResolved.raw;
  if (!raw) {
    const wc = wordCount(args.trimmed);
    return wc >= 2 && wc <= 12;
  }

  if (raw.confidence >= 1.0) return false;
  // Explicit skip asks must not be reclassified by the LLM as confusion.
  if (raw.type === 'skip_request' && raw.confidence >= 0.5) return false;

  if (raw.type === 'ambiguous_short') return true;
  if (raw.type === 'frustration' && raw.confidence < FRUSTRATION_META_CONFIDENCE_THRESHOLD) {
    return true;
  }
  if (raw.confidence < 0.72) return true;

  return false;
}

export function mergeHeuristicMetaWithLlm(args: {
  metaResolved: ResolvedMetaComment;
  llm: MetaCommentLlmResult | null;
  minConfidence: number;
}): ResolvedMetaComment {
  const { metaResolved, llm, minConfidence } = args;
  if (!llm || llm.confidence < minConfidence) {
    return metaResolved;
  }

  const heuristicRaw = metaResolved.raw;
  // Never let the LLM rewrite a clear skip_request into confusion / other meta.
  if (heuristicRaw?.type === 'skip_request' && heuristicRaw.confidence >= 0.5) {
    return metaResolved;
  }

  const llmAsCutOff = llm.metaType === 'cut_off';
  const llmAsNonMeta =
    llm.metaType === 'none' || llm.metaType === 'substantive_answer' || llmAsCutOff;

  if (llmAsNonMeta) {
    return {
      ...metaResolved,
      effective: metaResolved.exemptMetaCommentTurn ? null : null,
    };
  }

  const llmClassification = metaCommentLlmResultToClassification(llm);
  if (!llmClassification) {
    return metaResolved;
  }

  const llmWins =
    !heuristicRaw ||
    heuristicRaw.type === 'ambiguous_short' ||
    heuristicRaw.confidence < minConfidence ||
    llm.confidence >= heuristicRaw.confidence + 0.08;

  if (!llmWins) {
    return metaResolved;
  }

  const mergedRaw: MetaCommentClassification = llmClassification;
  const effective = metaResolved.exemptMetaCommentTurn ? null : mergedRaw;
  return {
    ...metaResolved,
    raw: mergedRaw,
    effective,
  };
}
