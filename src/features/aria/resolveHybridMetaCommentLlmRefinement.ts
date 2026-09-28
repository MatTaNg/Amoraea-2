import { fetchInterviewMetaCommentFromLlm } from '@features/aria/fetchInterviewMetaCommentFromLlm';
import {
  mergeHeuristicMetaWithLlm,
  shouldAwaitMetaCommentLlm,
} from '@features/aria/interviewMetaCommentHybrid';
import type { UserTurnMicStopTelemetry } from '@features/aria/interviewCutOffDetectionTypes';
import type { ResolvedMetaComment } from '@features/aria/metaCommentClassificationTypes';
import {
  INTERVIEW_META_COMMENT_LLM_ENABLED,
  INTERVIEW_META_COMMENT_LLM_MIN_CONFIDENCE,
} from '@features/aria/interviewTurnOrchestratorConfig';
import { remoteLog } from '@utilities/remoteLog';

export async function resolveHybridMetaCommentLlmRefinement(args: {
  trimmed: string;
  activeQuestionPreview: string;
  metaResolved: ResolvedMetaComment;
  micStopTelemetry?: UserTurnMicStopTelemetry | null;
  interviewSessionId?: string | null;
}): Promise<ResolvedMetaComment> {
  if (
    !INTERVIEW_META_COMMENT_LLM_ENABLED ||
    !shouldAwaitMetaCommentLlm({
      trimmed: args.trimmed,
      metaResolved: args.metaResolved,
      micStopTelemetry: args.micStopTelemetry,
    })
  ) {
    return args.metaResolved;
  }

  try {
    const llm = await fetchInterviewMetaCommentFromLlm({
      activeQuestionPreview: args.activeQuestionPreview,
      userText: args.trimmed,
      heuristicType: args.metaResolved.raw?.type ?? null,
      heuristicConfidence: args.metaResolved.raw?.confidence ?? null,
    });
    const refined = mergeHeuristicMetaWithLlm({
      metaResolved: args.metaResolved,
      llm,
      minConfidence: INTERVIEW_META_COMMENT_LLM_MIN_CONFIDENCE,
    });
    void remoteLog('[META_COMMENT_LLM]', {
      interviewSessionId: args.interviewSessionId ?? null,
      preview: args.trimmed.slice(0, 80),
      heuristicType: args.metaResolved.raw?.type ?? null,
      heuristicConfidence: args.metaResolved.raw?.confidence ?? null,
      llmMetaType: llm?.metaType ?? null,
      llmConfidence: llm?.confidence ?? null,
      refinedType: refined.raw?.type ?? null,
      refinedEffective: refined.effective?.type ?? null,
    });
    return refined;
  } catch (err) {
    void remoteLog('[META_COMMENT_LLM_LIVE_ERROR]', {
      interviewSessionId: args.interviewSessionId ?? null,
      message: err instanceof Error ? err.message : String(err),
      preview: args.trimmed.slice(0, 80),
    });
    return args.metaResolved;
  }
}
