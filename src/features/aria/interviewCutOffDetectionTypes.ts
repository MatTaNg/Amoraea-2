/** Whisper / VAD telemetry captured when a user turn finishes recording. */
export type UserTurnMicStopTelemetry = {
  audioDurationMs: number;
  wordCount: number;
  wordsPerSecond: number;
  ratioFlag: boolean;
};

export type CutOffDetectionSource =
  | 'structural_heuristic'
  | 'audio_telemetry'
  | 'audio_structural'
  | 'llm_live'
  | 'none';

export type HybridCutOffDetection = {
  isCutOff: boolean;
  source: CutOffDetectionSource;
  /** High = act immediately; medium = optional LLM confirm; low = not a cut-off. */
  confidence: 'high' | 'medium' | 'low';
};

export type CutOffCompletenessLlmResult = {
  cutOff: boolean;
  confidence: number;
  reason: string;
};
