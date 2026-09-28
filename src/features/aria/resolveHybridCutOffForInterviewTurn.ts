import {
  evaluateHybridCutOffDetection,
  mergeHybridCutOffWithLlm,
} from '@features/aria/interviewCutOffDetection';
import type { HybridCutOffDetection, UserTurnMicStopTelemetry } from '@features/aria/interviewCutOffDetectionTypes';
import { fetchInterviewCutOffCompletenessFromLlm } from '@features/aria/fetchInterviewCutOffCompletenessFromLlm';
import {
  INTERVIEW_CUT_OFF_COMPLETENESS_LLM_ENABLED,
  INTERVIEW_CUT_OFF_COMPLETENESS_LLM_MIN_CONFIDENCE,
} from '@features/aria/interviewTurnOrchestratorConfig';
import { remoteLog } from '@utilities/remoteLog';

export async function resolveHybridCutOffForInterviewTurn(args: {
  transcriptText: string;
  activeQuestionPreview: string;
  telemetry?: UserTurnMicStopTelemetry | null;
  interviewSessionId?: string | null;
}): Promise<HybridCutOffDetection> {
  const heuristic = evaluateHybridCutOffDetection({
    transcriptText: args.transcriptText,
    telemetry: args.telemetry,
  });

  if (
    heuristic.isCutOff &&
    heuristic.confidence === 'high'
  ) {
    void remoteLog('[CUT_OFF_DETECTION]', {
      interviewSessionId: args.interviewSessionId ?? null,
      source: heuristic.source,
      confidence: heuristic.confidence,
      preview: args.transcriptText.slice(0, 80),
    });
    return heuristic;
  }

  const needsLlm =
    INTERVIEW_CUT_OFF_COMPLETENESS_LLM_ENABLED &&
    (heuristic.confidence === 'medium' ||
      (heuristic.isCutOff && heuristic.confidence !== 'low'));

  if (!needsLlm) {
    return heuristic;
  }

  try {
    const llm = await fetchInterviewCutOffCompletenessFromLlm({
      activeQuestionPreview: args.activeQuestionPreview,
      userText: args.transcriptText,
    });
    const resolved = mergeHybridCutOffWithLlm(
      heuristic,
      llm,
      INTERVIEW_CUT_OFF_COMPLETENESS_LLM_MIN_CONFIDENCE,
    );
    void remoteLog('[CUT_OFF_COMPLETENESS_LLM]', {
      interviewSessionId: args.interviewSessionId ?? null,
      heuristicSource: heuristic.source,
      heuristicConfidence: heuristic.confidence,
      llmCutOff: llm?.cutOff ?? null,
      llmConfidence: llm?.confidence ?? null,
      resolvedSource: resolved.source,
      resolvedIsCutOff: resolved.isCutOff,
      preview: args.transcriptText.slice(0, 80),
    });
    return resolved;
  } catch (err) {
    void remoteLog('[CUT_OFF_COMPLETENESS_LLM_LIVE_ERROR]', {
      interviewSessionId: args.interviewSessionId ?? null,
      message: err instanceof Error ? err.message : String(err),
      preview: args.transcriptText.slice(0, 80),
    });
    return heuristic;
  }
}

/** Sync-only helper for post-transcribe gates (no LLM wait). */
export function resolveHybridCutOffSync(args: {
  transcriptText: string;
  telemetry?: UserTurnMicStopTelemetry | null;
}): HybridCutOffDetection {
  return evaluateHybridCutOffDetection(args);
}
