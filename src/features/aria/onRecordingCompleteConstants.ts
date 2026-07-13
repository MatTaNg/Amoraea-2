/** VAD / re-prompt constants for interview recording completion (extracted from AriaScreen #8b). */
export const VAD_GATE_BYPASS_REASON_NO_SAMPLE_EXCEEDED =
  'no_sample_exceeded_vad_threshold_in_decode' as const;

export const VAD_BYPASS_WHISPER_MIN_PEAK_ABOVE_AMBIENT_DB = 5;

/** When speech starts late in a min-duration clip, Whisper often returns empty — re-prompt instead. */
export const MIN_SPEECH_AFTER_VAD_FOR_WHISPER_MS = 450;

/** Strong peak + near-miss duration after a hot adaptive threshold — still try Whisper once. */
export const VAD_CLIP_NEAR_MISS_MIN_SPEECH_MS = 300;
export const VAD_CLIP_NEAR_MISS_MIN_PEAK_DB = -25;

export const SILENT_BUFFER_RETAKE_PROMPT =
  "I didn't catch any speech on that try. Tap the mic when you're ready and say that again.";

export const WHISPER_RATIO_REASK_PROMPT =
  'I only caught part of that — could you answer again in a full sentence?';
