import {
  looksLikeCompleteShortUserReply,
  looksLikeGrammaticallyCompleteShortUtterance,
  looksLikeIncompleteCutOffUserAnswer,
  looksLikeInterviewProcessMetaComment,
  looksLikeInterviewProcessQuestionRepeatRequest,
  looksLikeMicStopCutOffExemptFromMetaComment,
} from '@features/aria/interviewAnswerRelevance';
import { getWhisperRatioReaskSuppressionReason } from '@features/aria/interviewWhisperRatioReask';
import type {
  CutOffDetectionSource,
  HybridCutOffDetection,
  UserTurnMicStopTelemetry,
} from '@features/aria/interviewCutOffDetectionTypes';

export type { UserTurnMicStopTelemetry, HybridCutOffDetection, CutOffCompletenessLlmResult } from '@features/aria/interviewCutOffDetectionTypes';

const AUDIO_SUSPICIOUS_MAX_WORDS = 20;

/** Acoustic mic-stop signal: suspicious words/sec on a substantive-length clip. */
export function looksLikeMicStopFromAudioTelemetry(
  telemetry: UserTurnMicStopTelemetry | null | undefined,
): boolean {
  if (!telemetry) return false;
  const { ratioFlag, wordsPerSecond, wordCount } = telemetry;
  if (!ratioFlag || wordsPerSecond >= 0.3) return false;
  if (wordCount < 3 || wordCount > AUDIO_SUSPICIOUS_MAX_WORDS) return false;
  return true;
}

/**
 * Generic structural incompleteness — trailing grammar, dangling modals, etc.
 * Prefer this over phrase-specific regex at call sites.
 */
export function looksLikeStructuralCutOffUserAnswer(text: string): boolean {
  return looksLikeMicStopCutOffExemptFromMetaComment(text);
}

function isRecognizedCompleteOrHardStop(transcriptText: string, wordCount: number): boolean {
  if (looksLikeCompleteShortUserReply(transcriptText)) return true;
  if (looksLikeInterviewProcessMetaComment(transcriptText)) return true;
  if (looksLikeInterviewProcessQuestionRepeatRequest(transcriptText)) return true;
  if (looksLikeGrammaticallyCompleteShortUtterance(transcriptText)) return true;
  return getWhisperRatioReaskSuppressionReason(transcriptText, wordCount) === 'valid_hard_stop';
}

/**
 * Synchronous hybrid cut-off evaluation: structural heuristics + optional audio telemetry.
 * LLM confirmation is layered in {@link resolveHybridCutOffForInterviewTurn}.
 */
export function evaluateHybridCutOffDetection(args: {
  transcriptText: string;
  telemetry?: UserTurnMicStopTelemetry | null;
}): HybridCutOffDetection {
  const trimmed = (args.transcriptText ?? '').replace(/\s+/g, ' ').trim();
  if (!trimmed) {
    return { isCutOff: true, source: 'structural_heuristic', confidence: 'high' };
  }

  const wordCount = args.telemetry?.wordCount ?? trimmed.split(/\s+/).filter(Boolean).length;
  if (isRecognizedCompleteOrHardStop(trimmed, wordCount)) {
    return { isCutOff: false, source: 'none', confidence: 'low' };
  }

  const structural = looksLikeStructuralCutOffUserAnswer(trimmed);
  const audioSuspicious = looksLikeMicStopFromAudioTelemetry(args.telemetry ?? null);

  if (structural) {
    return {
      isCutOff: true,
      source: audioSuspicious ? 'audio_structural' : 'structural_heuristic',
      confidence: 'high',
    };
  }

  if (audioSuspicious && wordCount >= 3 && wordCount <= 12) {
    return { isCutOff: true, source: 'audio_telemetry', confidence: 'medium' };
  }

  if (audioSuspicious && looksLikeIncompleteCutOffUserAnswer(trimmed)) {
    return { isCutOff: true, source: 'audio_structural', confidence: 'high' };
  }

  return { isCutOff: false, source: 'none', confidence: 'low' };
}

export function mergeHybridCutOffWithLlm(
  heuristic: HybridCutOffDetection,
  llm: { cutOff: boolean; confidence: number } | null,
  minConfidence = 0.7,
): HybridCutOffDetection {
  if (heuristic.isCutOff && heuristic.confidence === 'high') {
    return heuristic;
  }
  if (llm?.cutOff === true && llm.confidence >= minConfidence) {
    return { isCutOff: true, source: 'llm_live', confidence: 'high' };
  }
  if (heuristic.confidence === 'medium' && llm?.cutOff === false && llm.confidence >= minConfidence) {
    return { isCutOff: false, source: 'none', confidence: 'low' };
  }
  if (heuristic.confidence === 'medium') {
    return heuristic;
  }
  return heuristic;
}

export function shouldSuppressMetaForCutOffDetection(
  detection: HybridCutOffDetection,
): boolean {
  return detection.isCutOff && detection.confidence !== 'low';
}

export function shouldPrioritizeCutOffRecoveryOverMeta(
  detection: HybridCutOffDetection,
): boolean {
  return detection.isCutOff;
}
