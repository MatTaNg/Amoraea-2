/**
 * Session-scoped ElevenLabs TTS duration estimate + rolling calibration vs actual playback.
 * Single-step adjustment is capped at 10% of the current multiplier to avoid overcorrection.
 */

const MIN_MS = 400;
const MAX_MS = 180_000;
const BASE_MS_PER_CHAR = 85;
/** Hard floor/ceiling for ms/char — outside this range suggests bad telemetry, not calibration need. */
export const MULTIPLIER_FLOOR_MS_PER_CHAR = 60;
export const MULTIPLIER_CEILING_MS_PER_CHAR = 120;
/** After this many recent turns, re-evaluate multiplier. */
const ROLLING_WINDOW = 3;
/** Ratios below this rolling average suggest expected duration is too high — raise ms/char (in small steps). */
const CALIBRATION_TRIGGER_MAX_RATIO = 0.95;
const CALIBRATION_ESCAPE_RATIO_THRESHOLD = 0.75;
const CALIBRATION_ESCAPE_CONSECUTIVE_TURNS = 3;
const CALIBRATION_ESCAPE_MAX_STEP_MS_PER_CHAR = 40;
/** Max change to multiplier in one adjustment: 10% of current value. */
const MAX_STEP_FRACTION = 0.1;

let calibratedMsPerChar = Math.min(
  MULTIPLIER_CEILING_MS_PER_CHAR,
  Math.max(MULTIPLIER_FLOOR_MS_PER_CHAR, BASE_MS_PER_CHAR)
);
const recentRatios: number[] = [];
let consecutiveLowRollingAvgTurns = 0;

export function resetTtsDurationCalibration(): void {
  recentRatios.length = 0;
  consecutiveLowRollingAvgTurns = 0;
  calibratedMsPerChar = Math.min(
    MULTIPLIER_CEILING_MS_PER_CHAR,
    Math.max(MULTIPLIER_FLOOR_MS_PER_CHAR, BASE_MS_PER_CHAR)
  );
}

export function getTtsDurationCalibrationSnapshot(): { multiplier_ms_per_char: number; samples_in_window: number } {
  return { multiplier_ms_per_char: calibratedMsPerChar, samples_in_window: recentRatios.length };
}

export function getTtsExpectedDurationMsFromCharCount(charCount: number): {
  expectedMs: number;
  calculationMethod: string;
} {
  const n = Math.max(0, charCount);
  const expectedMs = Math.round(Math.min(MAX_MS, Math.max(MIN_MS, n * calibratedMsPerChar)));
  const calculationMethod = `min_max_clamped(strip_control_tokens_char_count_times_${calibratedMsPerChar}ms,${MIN_MS},${MAX_MS})`;
  return { expectedMs, calculationMethod };
}

export type TtsCalibrationAdjustmentDetail = {
  rolling_avg_ratio: number;
  turns_in_window: number;
  step_applied_ms: number;
  ideal_next_multiplier_without_step_cap: number;
  adjustment_reason: string;
};

export type TtsCalibrationResult = {
  ratio: number;
  calibration_adjusted: boolean;
  calibration_escape_applied?: boolean;
  previous_multiplier_ms_per_char: number;
  new_multiplier_ms_per_char: number;
  calibration_skip_reason:
    | 'insufficient_turns'
    | 'within_threshold'
    | 'adjusted'
    | 'rounded_no_change'
    | 'at_floor_or_ceiling';
  calibration_adjustment_detail?: TtsCalibrationAdjustmentDetail | null;
};

/**
 * After each completed TTS turn, record actual/expected ratio; after 3 samples, adjust if rolling avg &lt; 0.95.
 * Each increase is at most 10% of the current multiplier; target ideal is approached over successive turns.
 */
export function recordTtsTurnDurationRatio(actualMs: number, expectedMs: number): TtsCalibrationResult | null {
  if (!Number.isFinite(actualMs) || !Number.isFinite(expectedMs) || expectedMs <= 0) return null;
  const ratio = actualMs / expectedMs;
  recentRatios.push(ratio);
  if (recentRatios.length > ROLLING_WINDOW) {
    recentRatios.shift();
  }

  const prev = calibratedMsPerChar;
  let calibration_skip_reason: TtsCalibrationResult['calibration_skip_reason'] = 'insufficient_turns';
  let adjusted = false;

  if (recentRatios.length < ROLLING_WINDOW) {
    return {
      ratio,
      calibration_adjusted: false,
      previous_multiplier_ms_per_char: prev,
      new_multiplier_ms_per_char: calibratedMsPerChar,
      calibration_skip_reason: 'insufficient_turns',
      calibration_adjustment_detail: null,
    };
  }

  const window = recentRatios.slice(-ROLLING_WINDOW);
  const avgRatio = window.reduce((a, b) => a + b, 0) / ROLLING_WINDOW;
  if (ratio > CALIBRATION_ESCAPE_RATIO_THRESHOLD) {
    consecutiveLowRollingAvgTurns = 0;
  } else if (avgRatio < CALIBRATION_ESCAPE_RATIO_THRESHOLD) {
    consecutiveLowRollingAvgTurns += 1;
  } else {
    consecutiveLowRollingAvgTurns = 0;
  }

  if (avgRatio >= CALIBRATION_TRIGGER_MAX_RATIO) {
    calibration_skip_reason = 'within_threshold';
    return {
      ratio,
      calibration_adjusted: false,
      previous_multiplier_ms_per_char: prev,
      new_multiplier_ms_per_char: calibratedMsPerChar,
      calibration_skip_reason,
      calibration_adjustment_detail: null,
    };
  }

  /** Full proportional target (uncapped) — audit / ideal reference only. */
  const idealUncapped = prev / avgRatio;
  const shouldApplyEscape = consecutiveLowRollingAvgTurns >= CALIBRATION_ESCAPE_CONSECUTIVE_TURNS;
  if (shouldApplyEscape) {
    let next = idealUncapped;
    next = Math.max(prev - CALIBRATION_ESCAPE_MAX_STEP_MS_PER_CHAR, Math.min(prev + CALIBRATION_ESCAPE_MAX_STEP_MS_PER_CHAR, next));
    next = Math.round(next);
    next = Math.min(MULTIPLIER_CEILING_MS_PER_CHAR, Math.max(MULTIPLIER_FLOOR_MS_PER_CHAR, next));
    consecutiveLowRollingAvgTurns = 0;
    if (next === prev) {
      const atBound =
        (prev <= MULTIPLIER_FLOOR_MS_PER_CHAR && idealUncapped < prev) ||
        (prev >= MULTIPLIER_CEILING_MS_PER_CHAR && idealUncapped > prev);
      return {
        ratio,
        calibration_adjusted: false,
        calibration_escape_applied: true,
        previous_multiplier_ms_per_char: prev,
        new_multiplier_ms_per_char: calibratedMsPerChar,
        calibration_skip_reason: atBound ? 'at_floor_or_ceiling' : 'rounded_no_change',
        calibration_adjustment_detail: {
          rolling_avg_ratio: avgRatio,
          turns_in_window: ROLLING_WINDOW,
          step_applied_ms: 0,
          ideal_next_multiplier_without_step_cap: Math.round(idealUncapped * 100) / 100,
          adjustment_reason: `rolling_window_${ROLLING_WINDOW}_avg_ratio_${avgRatio.toFixed(4)}_below_${CALIBRATION_ESCAPE_RATIO_THRESHOLD}_escape_cap_${CALIBRATION_ESCAPE_MAX_STEP_MS_PER_CHAR}ms_step_${atBound ? 'blocked_at_bounds' : 'no_change_after_round'}`,
        },
      };
    }
    calibratedMsPerChar = next;
    return {
      ratio,
      calibration_adjusted: true,
      calibration_escape_applied: true,
      previous_multiplier_ms_per_char: prev,
      new_multiplier_ms_per_char: calibratedMsPerChar,
      calibration_skip_reason: 'adjusted',
      calibration_adjustment_detail: {
        rolling_avg_ratio: avgRatio,
        turns_in_window: ROLLING_WINDOW,
        step_applied_ms: next - prev,
        ideal_next_multiplier_without_step_cap: Math.round(idealUncapped * 100) / 100,
        adjustment_reason: `rolling_window_${ROLLING_WINDOW}_avg_ratio_${avgRatio.toFixed(4)}_below_${CALIBRATION_ESCAPE_RATIO_THRESHOLD}_escape_cap_${CALIBRATION_ESCAPE_MAX_STEP_MS_PER_CHAR}ms_step`,
      },
    };
  }
  const maxStep = prev * MAX_STEP_FRACTION;
  let next = prev;
  if (idealUncapped > prev) {
    next = Math.min(idealUncapped, prev + maxStep, MULTIPLIER_CEILING_MS_PER_CHAR);
  } else if (idealUncapped < prev) {
    next = Math.max(idealUncapped, prev - maxStep, MULTIPLIER_FLOOR_MS_PER_CHAR);
  }
  next = Math.round(next);
  next = Math.min(MULTIPLIER_CEILING_MS_PER_CHAR, Math.max(MULTIPLIER_FLOOR_MS_PER_CHAR, next));

  const adjustment_reason = `rolling_window_${ROLLING_WINDOW}_avg_ratio_${avgRatio.toFixed(4)}_below_${CALIBRATION_TRIGGER_MAX_RATIO}_cap_10pct_step`;

  if (next === prev) {
    const atBound =
      (prev <= MULTIPLIER_FLOOR_MS_PER_CHAR && idealUncapped < prev) ||
      (prev >= MULTIPLIER_CEILING_MS_PER_CHAR && idealUncapped > prev);
    return {
      ratio,
      calibration_adjusted: false,
      previous_multiplier_ms_per_char: prev,
      new_multiplier_ms_per_char: calibratedMsPerChar,
      calibration_skip_reason: atBound ? 'at_floor_or_ceiling' : 'rounded_no_change',
      calibration_adjustment_detail: {
        rolling_avg_ratio: avgRatio,
        turns_in_window: ROLLING_WINDOW,
        step_applied_ms: 0,
        ideal_next_multiplier_without_step_cap: Math.round(idealUncapped * 100) / 100,
        adjustment_reason: `${adjustment_reason}_${atBound ? 'blocked_at_bounds' : 'no_change_after_round'}`,
      },
    };
  }

  calibratedMsPerChar = next;
  return {
    ratio,
    calibration_adjusted: true,
    previous_multiplier_ms_per_char: prev,
    new_multiplier_ms_per_char: calibratedMsPerChar,
    calibration_skip_reason: 'adjusted',
    calibration_adjustment_detail: {
      rolling_avg_ratio: avgRatio,
      turns_in_window: ROLLING_WINDOW,
      step_applied_ms: next - prev,
      ideal_next_multiplier_without_step_cap: Math.round(idealUncapped * 100) / 100,
      adjustment_reason,
    },
  };
}
