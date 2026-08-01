import type { ComputeGateResultOptions } from '@features/aria/computeGateResultCore';
import { moment4Moment5ConcretenessDepthSignalDelta } from '@features/aria/moment4ConcretenessClassification';
import type { DefensePatternsJson } from '@features/aria/defensePatternsDetection';
import { resolveEmotionRecognitionCorrectCountForGate } from '@features/aria/emotionRecognitionInterview';
import {
  countDefensePatternsForDepthModifier,
  DEFENSE_PATTERN_COUNT_MODIFIERS,
  EGO_DEVELOPMENT_LEVEL_MODIFIERS,
  MENTALIZING_OVERCERTAINTY_COUNT_MODIFIERS,
  emotionRecognitionDepthSignalModifierFromCorrectCount,
} from '@config/scoring/depthSignalModifiers';

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
  return countDefensePatternsForDepthModifier(dp);
}

function parseNonNegativeInt(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return 0;
  return Math.max(0, Math.round(raw));
}

const EGO_LEVEL_LINE_DETAIL: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: 'Level 1 — concrete, rule-based',
  2: 'Level 2 — multiple perspectives',
  3: 'Level 3 — holds complexity',
  4: 'Level 4 — integrates contradictions',
  5: 'Level 5 — systemic relational understanding',
};

/** Line-item depth signal adjustments — mirrors computeGateResultCore depth modifier block. */
export function buildDepthSignalModifierLines(
  options?: ComputeGateResultOptions,
): DepthSignalModifierLine[] {
  const lines: DepthSignalModifierLine[] = [];
  const egoLevel = parseEgoLevel(options?.egoDevelopmentLevel);
  if (egoLevel != null) {
    const delta = EGO_DEVELOPMENT_LEVEL_MODIFIERS[egoLevel as 1 | 2 | 3 | 4 | 5];
    if (delta !== 0) {
      lines.push({
        label: 'Ego development',
        detail: EGO_LEVEL_LINE_DETAIL[egoLevel as 1 | 2 | 3 | 4 | 5],
        delta,
      });
    }
  }

  const defenseCount = parseDefenseCount(options?.defensePatterns);
  const defenseCountCapped = Math.min(4, defenseCount) as 0 | 1 | 2 | 3 | 4;
  const defenseDelta = DEFENSE_PATTERN_COUNT_MODIFIERS[defenseCountCapped];
  if (defenseCount === 1) {
    lines.push({ label: 'Defense patterns', detail: '1 immature defense flagged (projection excluded)', delta: defenseDelta });
  } else if (defenseCount === 2) {
    lines.push({ label: 'Defense patterns', detail: '2 immature defenses flagged (projection excluded)', delta: defenseDelta });
  } else if (defenseCount === 3) {
    lines.push({ label: 'Defense patterns', detail: '3 immature defenses flagged (projection excluded)', delta: defenseDelta });
  } else if (defenseCount >= 4) {
    lines.push({ label: 'Defense patterns', detail: '4+ immature defenses flagged (projection excluded)', delta: defenseDelta });
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
  if (overcertaintyCount >= 1) {
    const overcertaintyCapped = Math.min(4, overcertaintyCount) as 1 | 2 | 3 | 4;
    const delta = MENTALIZING_OVERCERTAINTY_COUNT_MODIFIERS[overcertaintyCapped];
    if (delta !== 0) {
      const detail =
        overcertaintyCount >= 4
          ? '4+ moments flagged'
          : `${overcertaintyCount} moment${overcertaintyCount === 1 ? '' : 's'} flagged`;
      lines.push({ label: 'Mentalizing overcertainty', detail, delta });
    }
  }

  const erCorrectCount = resolveEmotionRecognitionCorrectCountForGate({
    emotionRecognitionRawScore: options?.emotionRecognitionRawScore,
    emotionRecognitionCorrectCount: options?.emotionRecognitionCorrectCount,
    emotionRecognitionResponses: options?.emotionRecognitionResponses,
  });
  if (erCorrectCount !== null) {
    const delta = emotionRecognitionDepthSignalModifierFromCorrectCount(erCorrectCount);
    if (delta !== 0) {
      lines.push({
        label: 'Emotion recognition',
        detail: `${erCorrectCount}/3 correct`,
        delta,
      });
    }
  }

  const disclosure = options?.disclosureCalibration ?? null;
  if (disclosure === 'underdisclosure') {
    lines.push({ label: 'Disclosure calibration', detail: 'Underdisclosure', delta: -0.2 });
  }

  return lines;
}

export function sumDepthSignalModifierLines(lines: DepthSignalModifierLine[]): number {
  const total = lines.reduce((sum, line) => sum + line.delta, 0);
  return Math.round(total * 100) / 100;
}
