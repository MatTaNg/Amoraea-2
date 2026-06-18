import type { ComputeGateResultOptions } from '@features/aria/computeGateResultCore';
import { moment4Moment5ConcretenessDepthSignalDelta } from '@features/aria/moment4ConcretenessClassification';
import { DEFAULT_DEFENSE_PATTERNS, type DefensePatternsJson } from '@features/aria/defensePatternsDetection';
import { resolveEmotionRecognitionRawScoreForGate } from '@features/aria/emotionRecognitionInterview';

const EMOTION_RECOGNITION_FLOOR_EXCLUSIVE_MAX = 0.34;
const EMOTION_RECOGNITION_REVIEW_EXCLUSIVE_MAX = 0.67;

export type DepthSignalModifierLine = {
  label: string;
  detail?: string;
  delta: number;
};

function parseEgoLevel(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return null;
  const n = Math.round(raw);
  return n >= 1 && n <= 5 ? n : null;
}

function parseDefenseCount(dp: DefensePatternsJson | null | undefined): number {
  const merged = { ...DEFAULT_DEFENSE_PATTERNS, ...(dp ?? {}) };
  return [
    merged.projection_detected === true,
    merged.rationalization_detected === true,
    merged.splitting_detected === true,
    merged.denial_detected === true,
  ].filter(Boolean).length;
}

function parseNonNegativeInt(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.round(raw));
}

/** Line-item depth signal adjustments — mirrors computeGateResultCore depth modifier block. */
export function buildDepthSignalModifierLines(
  options?: ComputeGateResultOptions,
): DepthSignalModifierLine[] {
  const lines: DepthSignalModifierLine[] = [];
  const egoLevel = parseEgoLevel(options?.egoDevelopmentLevel);
  if (egoLevel === 1) {
    lines.push({ label: 'Ego development', detail: 'Level 1 — concrete, rule-based', delta: -0.8 });
  } else if (egoLevel === 2) {
    lines.push({ label: 'Ego development', detail: 'Level 2 — multiple perspectives', delta: -0.3 });
  } else if (egoLevel === 4) {
    lines.push({ label: 'Ego development', detail: 'Level 4 — integrates contradictions', delta: 0.2 });
  } else if (egoLevel === 5) {
    lines.push({ label: 'Ego development', detail: 'Level 5 — systemic relational understanding', delta: 0.3 });
  }

  const defenseCount = parseDefenseCount(options?.defensePatterns);
  if (defenseCount === 1) {
    lines.push({ label: 'Defense patterns', detail: '1 immature defense flagged', delta: -0.15 });
  } else if (defenseCount === 2) {
    lines.push({ label: 'Defense patterns', detail: '2 immature defenses flagged', delta: -0.35 });
  } else if (defenseCount === 3) {
    lines.push({ label: 'Defense patterns', detail: '3 immature defenses flagged', delta: -0.6 });
  } else if (defenseCount >= 4) {
    lines.push({ label: 'Defense patterns', detail: '4+ immature defenses flagged', delta: -0.8 });
  }

  const m4 = (options?.moment4Concreteness ?? '').toString().trim().toLowerCase();
  const m5 = (options?.moment5Concreteness ?? '').toString().trim().toLowerCase();
  const concretenessDelta = moment4Moment5ConcretenessDepthSignalDelta(m4, m5);
  const concretenessDetail =
    m4 && m5 ? `Moment 4 ${m4 || '—'} · Moment 5 ${m5 || '—'}` : '';
  if (concretenessDelta !== 0 && concretenessDetail) {
    lines.push({ label: 'Personal moment concreteness', detail: concretenessDetail, delta: concretenessDelta });
  } else if (concretenessDelta > 0 && concretenessDetail) {
    lines.push({ label: 'Personal moment concreteness', detail: concretenessDetail, delta: concretenessDelta });
  }

  const overcertaintyCount = parseNonNegativeInt(options?.mentalizingOvercertaintyCount);
  if (overcertaintyCount === 1) {
    lines.push({ label: 'Mentalizing overcertainty', detail: '1 moment flagged', delta: -0.1 });
  } else if (overcertaintyCount === 2) {
    lines.push({ label: 'Mentalizing overcertainty', detail: '2 moments flagged', delta: -0.2 });
  } else if (overcertaintyCount === 3) {
    lines.push({ label: 'Mentalizing overcertainty', detail: '3 moments flagged', delta: -0.35 });
  } else if (overcertaintyCount >= 4) {
    lines.push({ label: 'Mentalizing overcertainty', detail: '4+ moments flagged', delta: -0.5 });
  }

  const erScore = resolveEmotionRecognitionRawScoreForGate({
    emotionRecognitionRawScore: options?.emotionRecognitionRawScore,
    emotionRecognitionCorrectCount: options?.emotionRecognitionCorrectCount,
    emotionRecognitionResponses: options?.emotionRecognitionResponses,
  });
  if (erScore !== null) {
    if (erScore < EMOTION_RECOGNITION_FLOOR_EXCLUSIVE_MAX) {
      lines.push({
        label: 'Emotion recognition',
        detail: `${Math.round(erScore * 100)}% correct — floor band`,
        delta: -0.2,
      });
    } else if (erScore < EMOTION_RECOGNITION_REVIEW_EXCLUSIVE_MAX) {
      lines.push({
        label: 'Emotion recognition',
        detail: `${Math.round(erScore * 100)}% correct — review band`,
        delta: -0.2,
      });
    } else if (erScore >= 0.99) {
      lines.push({
        label: 'Emotion recognition',
        detail: '3/3 correct',
        delta: 0.1,
      });
    }
  }

  const disclosure = options?.disclosureCalibration ?? null;
  if (disclosure === 'underdisclosure') {
    lines.push({ label: 'Disclosure calibration', detail: 'Underdisclosure', delta: -0.2 });
  } else if (disclosure === 'overdisclosure') {
    lines.push({ label: 'Disclosure calibration', detail: 'Overdisclosure', delta: -0.15 });
  }

  if (options?.personalMomentEmotionalVocabLow === true) {
    lines.push({
      label: 'Personal moment emotional vocabulary',
      detail: 'Low density vs scenario responses',
      delta: -0.15,
    });
  }

  return lines;
}

export function sumDepthSignalModifierLines(lines: DepthSignalModifierLine[]): number {
  const total = lines.reduce((sum, line) => sum + line.delta, 0);
  return Math.round(total * 100) / 100;
}
