import {
  computeGateResultCore,
  GATE_PASS_WEIGHTED_MIN,
  type ComputeGateResultOptions,
  type GateFailDetailJson,
} from '@features/aria/computeGateResultCore';
import { DEFAULT_DEFENSE_PATTERNS } from '@features/aria/defensePatternsDetection';
import {
  emotionRecognitionCorrectCount,
  hydrateEmotionResponsesFromStorage,
  resolveEmotionRecognitionRawScoreForGate,
} from '@features/aria/emotionRecognitionInterview';
import {
  computePsychometricModifier,
  type PsychometricModifierResult,
} from '@features/psychometrics/computePsychometricModifier';
import {
  instrumentComponentsFromModifierResult,
  type GamingCorrectionResult,
} from '@features/psychometrics/computeGamingCorrection';
import {
  ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES,
  formatPsychometricGateFailDescription,
} from '@features/psychometrics/psychometricFloorBreaches';
import { sd3NarcissismScoreFromUserRow } from '@features/psychometrics/usersPsychometricsSchemaFallback';
import {
  buildDepthSignalModifierLines,
  sumDepthSignalModifierLines,
} from '@features/admin/depthSignalModifierLines';

export type ScoreReceiptLineKind =
  | 'section'
  | 'base'
  | 'adjustment'
  | 'subtotal'
  | 'total'
  | 'threshold'
  | 'outcome'
  | 'gate_fail'
  | 'note';

export type ScoreReceiptLine = {
  kind: ScoreReceiptLineKind;
  label: string;
  detail?: string;
  amount?: number | null;
};

export type ScoreReceipt = {
  lines: ScoreReceiptLine[];
};

export type ScoreReceiptAttemptInput = {
  weighted_score?: number | null;
  skip_penalty_total?: number | null;
  auto_failed?: boolean | null;
  depth_signal_modifier?: number | null;
  score_modifier?: number | null;
  modified_weighted_score?: number | null;
  psychometric_modifier_applied?: number | null;
  corrected_psychometric_modifier?: number | null;
  gaming_correction?: GamingCorrectionResult | null;
  modified_weighted_score_with_psychometrics?: number | null;
  final_gate_pass?: boolean | null;
  passed?: boolean | null;
  gate_fail_reasons?: unknown;
  gate_fail_detail?: unknown;
  pillar_scores?: Record<string, number> | null;
  ego_development_level?: number | null;
  defense_patterns?: ComputeGateResultOptions['defensePatterns'];
  moment_4_concreteness?: string | null;
  moment_5_concreteness?: string | null;
  disclosure_calibration?: string | null;
  mentalizing_overcertainty_count?: number | null;
  emotion_recognition_raw_score?: number | null;
  emotion_recognition_responses?: unknown;
  personal_moment_emotional_vocab_low?: boolean | null;
  personal_moment_emotional_vocab_density?: number | null;
  closing_integration?: string | null;
};

export type ScoreReceiptUserInput = {
  psychometrics_brs_score?: number | null;
  psychometrics_anxiety_trait_score?: number | null;
  psychometrics_scs_sf_score?: number | null;
  psychometrics_gasp_score?: number | null;
  psychometrics_dweck_score?: number | null;
  psychometrics_aaq2_score?: number | null;
  psychometrics_rses_score?: number | null;
  psychometrics_scs_public_score?: number | null;
  psychometrics_scs_private_score?: number | null;
  psychometrics_mspss_friends_score?: number | null;
  psychometrics_mspss_family_score?: number | null;
  psychometrics_sd3_narcissism_score?: number | null;
  psychometrics_narq_s_score?: number | null;
  psychometrics_rfq_score?: number | null;
};

const INSTRUMENT_RECEIPT_META: Array<{
  componentKey: keyof PsychometricModifierResult;
  bandKey: keyof PsychometricModifierResult['breakdown'];
  label: string;
  instrumentKey: string;
}> = [
  { componentKey: 'brsComponent', bandKey: 'brsBand', label: 'Resilience Assessment', instrumentKey: 'brs' },
  {
    componentKey: 'anxietyTraitComponent',
    bandKey: 'anxietyTraitBand',
    label: 'Emotional Patterns Assessment',
    instrumentKey: 'anxiety_trait',
  },
  { componentKey: 'aaq2Component', bandKey: 'aaq2Band', label: 'Emotional Flexibility Assessment', instrumentKey: 'aaq2' },
  { componentKey: 'rfqComponent', bandKey: 'rfqBand', label: 'Self-Reflection Assessment', instrumentKey: 'rfq' },
  {
    componentKey: 'sd3NarcissismComponent',
    bandKey: 'sd3NarcissismBand',
    label: 'Social Perceptions Assessment',
    instrumentKey: 'sd3_narcissism',
  },
  {
    componentKey: 'dweckComponent',
    bandKey: 'dweckBand',
    label: 'Relationship Beliefs Assessment',
    instrumentKey: 'dweck',
  },
  { componentKey: 'rsesComponent', bandKey: 'rsesBand', label: 'Self-Esteem Assessment', instrumentKey: 'rses' },
  { componentKey: 'scsSfComponent', bandKey: 'scsSfBand', label: 'Self-Compassion Assessment', instrumentKey: 'scs_sf' },
  { componentKey: 'gaspComponent', bandKey: 'gaspBand', label: 'Responsibility Assessment', instrumentKey: 'gasp' },
];

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string');
}

function parseGateFailDetail(detail: unknown): GateFailDetailJson | null {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null;
  return detail as GateFailDetailJson;
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function pushAdjustment(
  lines: ScoreReceiptLine[],
  label: string,
  detail: string | undefined,
  delta: number,
): void {
  if (delta === 0) return;
  lines.push({ kind: 'adjustment', label, detail, amount: delta });
}

function buildGateComputeOptions(attempt: ScoreReceiptAttemptInput): ComputeGateResultOptions {
  const rawSkip = attempt.skip_penalty_total;
  const skipNum = typeof rawSkip === 'number' && Number.isFinite(rawSkip) ? rawSkip : Number(rawSkip);
  const skipPenaltyTotal = Number.isFinite(skipNum) ? skipNum : 0;
  const responses = hydrateEmotionResponsesFromStorage(attempt.emotion_recognition_responses);
  const correctOpt = emotionRecognitionCorrectCount(responses);
  const rawEmotion = resolveEmotionRecognitionRawScoreForGate({
    emotionRecognitionRawScore: attempt.emotion_recognition_raw_score,
    emotionRecognitionCorrectCount: correctOpt,
    emotionRecognitionResponses: attempt.emotion_recognition_responses,
  });
  return {
    skipPenaltyTotal,
    skipAutoFail: attempt.auto_failed === true,
    egoDevelopmentLevel: attempt.ego_development_level ?? null,
    defensePatterns: attempt.defense_patterns ?? DEFAULT_DEFENSE_PATTERNS,
    moment4Concreteness: attempt.moment_4_concreteness ?? null,
    moment5Concreteness: attempt.moment_5_concreteness ?? null,
    emotionRecognitionRawScore: rawEmotion ?? undefined,
    emotionRecognitionCorrectCount: correctOpt ?? undefined,
    emotionRecognitionResponses: attempt.emotion_recognition_responses,
    mentalizingOvercertaintyCount: attempt.mentalizing_overcertainty_count ?? null,
    disclosureCalibration: attempt.disclosure_calibration ?? null,
    closingIntegration: attempt.closing_integration ?? null,
    personalMomentEmotionalVocabLow: attempt.personal_moment_emotional_vocab_low === true,
    precomputedWeightedScore: attempt.weighted_score ?? undefined,
  };
}

function recomputePsychometricModifier(
  attempt: ScoreReceiptAttemptInput,
  user: ScoreReceiptUserInput,
): PsychometricModifierResult | null {
  const hasAnyScore =
    user.psychometrics_brs_score != null ||
    user.psychometrics_anxiety_trait_score != null ||
    user.psychometrics_scs_sf_score != null ||
    user.psychometrics_gasp_score != null ||
    user.psychometrics_dweck_score != null ||
    user.psychometrics_aaq2_score != null ||
    user.psychometrics_rses_score != null ||
    user.psychometrics_sd3_narcissism_score != null ||
    user.psychometrics_narq_s_score != null ||
    user.psychometrics_rfq_score != null;
  if (!hasAnyScore) return null;

  const pillars = attempt.pillar_scores ?? {};
  return computePsychometricModifier(
    {
      brsScore: user.psychometrics_brs_score ?? null,
      anxietyTraitScore: user.psychometrics_anxiety_trait_score ?? null,
      scsSfScore: user.psychometrics_scs_sf_score ?? null,
      gaspScore: user.psychometrics_gasp_score ?? null,
      dweckScore: user.psychometrics_dweck_score ?? null,
      aaq2Score: user.psychometrics_aaq2_score ?? null,
      rsesScore: user.psychometrics_rses_score ?? null,
      sd3NarcissismScore: sd3NarcissismScoreFromUserRow(user as Record<string, unknown>),
      rfqScore: user.psychometrics_rfq_score ?? null,
    },
    {
      disclosureCalibration: attempt.disclosure_calibration ?? null,
      moment5Concreteness: attempt.moment_5_concreteness ?? null,
      moment4Concreteness: attempt.moment_4_concreteness ?? null,
      personalMomentVocabDensity: attempt.personal_moment_emotional_vocab_density ?? null,
      regulationPillar: pillars.regulation,
      accountabilityPillar: pillars.accountability,
      egoDevelopmentLevel: attempt.ego_development_level ?? null,
      attunementPillar: pillars.attunement,
      contemptPillar: pillars.contempt,
      mentalizingPillar: pillars.mentalizing,
    },
  );
}

export function buildScoreReceipt(input: {
  attempt: ScoreReceiptAttemptInput;
  user?: ScoreReceiptUserInput | null;
  passThreshold?: number;
}): ScoreReceipt {
  const { attempt, user } = input;
  const lines: ScoreReceiptLine[] = [];
  const threshold =
    typeof input.passThreshold === 'number' && Number.isFinite(input.passThreshold)
      ? input.passThreshold
      : parseGateFailDetail(attempt.gate_fail_detail)?.weighted_score?.requiredMin ?? GATE_PASS_WEIGHTED_MIN;

  const gateOptions = buildGateComputeOptions(attempt);
  const pillars = attempt.pillar_scores ?? {};
  const gateEcho = computeGateResultCore(pillars, null, gateOptions);

  const interviewWeighted = finiteOrNull(attempt.weighted_score) ?? finiteOrNull(gateEcho.weightedScore);
  const skipPenalty = gateOptions.skipPenaltyTotal ?? 0;
  const markerWeighted =
    finiteOrNull(gateEcho.markerWeightedScore) ??
    (interviewWeighted != null ? round2(interviewWeighted - skipPenalty) : null);

  lines.push({ kind: 'section', label: 'Interview score' });

  if (markerWeighted != null && skipPenalty !== 0) {
    lines.push({ kind: 'base', label: 'Marker weighted average', amount: markerWeighted });
    pushAdjustment(lines, 'Scenario skip penalty', undefined, skipPenalty);
    lines.push({
      kind: 'subtotal',
      label: 'Interview weighted score',
      amount: interviewWeighted ?? round2(markerWeighted + skipPenalty),
    });
  } else if (interviewWeighted != null) {
    lines.push({ kind: 'base', label: 'Interview weighted score', amount: interviewWeighted });
  } else {
    lines.push({ kind: 'note', label: 'Interview weighted score not available' });
  }

  if (attempt.auto_failed === true) {
    lines.push({
      kind: 'gate_fail',
      label: 'Auto-fail',
      detail: 'Third skip — interview weighted score forced to fail regardless of modifiers',
    });
  }

  lines.push({ kind: 'section', label: 'Depth signal adjustments' });
  const depthLines = buildDepthSignalModifierLines(gateOptions);
  const depthSum = sumDepthSignalModifierLines(depthLines);
  if (depthLines.length === 0) {
    lines.push({ kind: 'note', label: 'No depth signal adjustments applied' });
  } else {
    for (const line of depthLines) {
      pushAdjustment(lines, line.label, line.detail, line.delta);
    }
  }

  const storedDepthModifier =
    finiteOrNull(attempt.depth_signal_modifier) ?? finiteOrNull(attempt.score_modifier);
  if (storedDepthModifier != null && Math.abs(storedDepthModifier - depthSum) > 0.02) {
    lines.push({
      kind: 'note',
      label: 'Stored depth modifier differs from recomputed line items',
      detail: `Stored ${storedDepthModifier.toFixed(2)} · recomputed ${depthSum.toFixed(2)}`,
    });
  }

  const interviewOnlyModified =
    finiteOrNull(attempt.modified_weighted_score) ??
    (interviewWeighted != null ? round2(interviewWeighted + (storedDepthModifier ?? depthSum)) : null);

  lines.push({
    kind: 'subtotal',
    label: 'Interview-only modified score',
    detail: 'Weighted score + depth signal modifier',
    amount: interviewOnlyModified,
  });

  const psychResult = user ? recomputePsychometricModifier(attempt, user) : null;
  const rawPsychModifier =
    finiteOrNull(attempt.psychometric_modifier_applied) ??
    finiteOrNull(psychResult?.modifier) ??
    null;

  if (rawPsychModifier != null || psychResult != null) {
    lines.push({ kind: 'section', label: 'Psychometric adjustments' });
    if (psychResult) {
      for (const meta of INSTRUMENT_RECEIPT_META) {
        const delta = psychResult[meta.componentKey] as number;
        if (delta === 0) continue;
        const band = psychResult.breakdown[meta.bandKey];
        pushAdjustment(lines, meta.label, String(band), delta);
      }
      if (psychResult.modifier === 0) {
        lines.push({ kind: 'note', label: 'All psychometric bands neutral — no penalty' });
      }
    } else if (rawPsychModifier != null) {
      lines.push({
        kind: 'note',
        label: 'Per-instrument breakdown unavailable',
        detail: 'Psychometric scores not loaded for this user',
      });
    }

    lines.push({
      kind: 'subtotal',
      label: 'Psychometric modifier (raw)',
      amount: rawPsychModifier,
    });
  } else {
    lines.push({ kind: 'section', label: 'Psychometric adjustments' });
    lines.push({ kind: 'note', label: 'Psychometrics pending — modifier not applied yet' });
  }

  const gaming = attempt.gaming_correction ?? null;
  const correctedPsych =
    finiteOrNull(attempt.corrected_psychometric_modifier) ??
    finiteOrNull(gaming?.correctedModifier) ??
    rawPsychModifier;

  if (gaming && rawPsychModifier != null && correctedPsych != null && gaming.correctionApplied !== 0) {
    lines.push({ kind: 'section', label: 'Gaming correction' });
    if (psychResult) {
      const components = instrumentComponentsFromModifierResult(psychResult);
      for (const key of gaming.strippedInstruments) {
        const contribution = components[key as keyof typeof components];
        if (typeof contribution === 'number' && contribution > 0) {
          const meta = INSTRUMENT_RECEIPT_META.find((m) => m.instrumentKey === key);
          pushAdjustment(
            lines,
            `Stripped positive — ${meta?.label ?? key}`,
            'Gaming correction removed favorable self-report contribution',
            -contribution,
          );
        }
      }
    }
    if (gaming.additionalPenalty < 0) {
      pushAdjustment(
        lines,
        'Additional gaming penalty',
        gaming.activeTriggers.map((t) => t.detail).join(' · ') || undefined,
        gaming.additionalPenalty,
      );
    }
    lines.push({
      kind: 'subtotal',
      label: 'Psychometric modifier (corrected)',
      detail: gaming.explanation,
      amount: correctedPsych,
    });
  } else if (correctedPsych != null && correctedPsych !== rawPsychModifier) {
    lines.push({
      kind: 'subtotal',
      label: 'Psychometric modifier (corrected)',
      amount: correctedPsych,
    });
  }

  const finalScore =
    finiteOrNull(attempt.modified_weighted_score_with_psychometrics) ??
    (interviewOnlyModified != null && correctedPsych != null
      ? round2(interviewOnlyModified + correctedPsych)
      : interviewOnlyModified);

  lines.push({ kind: 'section', label: 'Final' });
  lines.push({
    kind: 'total',
    label: 'Final modified score',
    detail:
      correctedPsych != null
        ? 'Interview-only modified score + psychometric modifier'
        : 'Interview-only modified score (psychometrics pending)',
    amount: finalScore,
  });
  lines.push({ kind: 'threshold', label: 'Pass threshold', amount: threshold });

  const gateFailReasons = asStringArray(attempt.gate_fail_reasons);
  const gateDetail = parseGateFailDetail(attempt.gate_fail_detail);
  const psychFloors = gateDetail?.psychometric_floors ?? {};
  const psychFloorIds = gateFailReasons.filter((id) =>
    (ALL_PSYCHOMETRIC_GATE_FAIL_FLOOR_CODES as readonly string[]).includes(id),
  );

  if (psychFloorIds.length > 0 || gateFailReasons.some((r) => !psychFloorIds.includes(r))) {
    lines.push({ kind: 'section', label: 'Gate failures (not score deductions)' });
    for (const floorId of psychFloorIds) {
      const stored = psychFloors[floorId];
      const score = stored?.score;
      lines.push({
        kind: 'gate_fail',
        label: floorId,
        detail:
          stored?.description ??
          (typeof score === 'number'
            ? formatPsychometricGateFailDescription(floorId, score)
            : formatPsychometricGateFailDescription(floorId, 0)),
      });
    }
    for (const reason of gateFailReasons) {
      if (psychFloorIds.includes(reason)) continue;
      if (reason === 'weighted_score') {
        const w = gateDetail?.weighted_score;
        lines.push({
          kind: 'gate_fail',
          label: 'Weighted score below threshold',
          detail: w
            ? `Score ${w.score.toFixed(2)} below required ${w.requiredMin.toFixed(2)}`
            : undefined,
        });
        continue;
      }
      lines.push({ kind: 'gate_fail', label: reason.replace(/_/g, ' ') });
    }
  }

  const finalPass = attempt.final_gate_pass;
  const interviewPass = attempt.passed;
  if (finalPass != null) {
    lines.push({
      kind: 'outcome',
      label: 'Final gate decision',
      detail:
        interviewPass != null && finalPass !== interviewPass
          ? `Interview-only ${interviewPass ? 'PASS' : 'FAIL'} → final ${finalPass ? 'PASS' : 'FAIL'} after psychometrics`
          : undefined,
      amount: finalPass ? 1 : 0,
    });
  } else if (interviewPass != null) {
    lines.push({
      kind: 'outcome',
      label: 'Interview gate (pre-psychometric)',
      amount: interviewPass ? 1 : 0,
    });
  }

  return { lines };
}
