/**
 * Re-run Claude scenario + personal-moment scoring from a stored transcript, then aggregate + gate.
 */
import {
  recalculateAttemptScoresFromStoredSlices,
  type AdminRecalculateAttemptInput,
  type AdminRecalculateResult,
} from '../../src/features/aria/adminRecalculateAttemptScores';
import { buildPersonalMomentScoringPrompt } from '../../src/features/aria/personalMomentScoringPrompt';
import {
  buildMoment5AccountabilityScoringPrompt,
  type Moment5ClientScoringMetadata,
} from '../../src/features/aria/moment5AccountabilityScoringPrompt';
import { buildScenarioScoringPrompt } from '../../src/features/aria/scenarioScoringPrompt';
import { postProcessScenarioScoreFromModelText } from '../../src/features/aria/scenarioScorePostParse';
import { inferPersonalMomentSlices, trimMoment5SliceForScoring } from '../../src/features/aria/personalMomentSlices';
import {
  promoteMoment5LegacyContemptForScoringResult,
  sanitizeMoment5PersonalScoresForAggregate,
  sanitizePersonalMomentScoresForAggregate,
} from '../../src/features/aria/personalMomentSliceSanitize';
import { personalMomentBundleWasScored } from '../../src/features/aria/interviewCompletionGate';
import {
  applyElaborationAbsencePenaltiesMoment4,
  applyElaborationAbsencePenaltiesMoment5,
} from '../../src/features/aria/elaborationAbsencePenaltiesHeuristic';
import {
  applyMoment4PostParseCoercionAndSalvage,
  applyMoment5PostParseCoercionAndSalvage,
  backfillMoment4KeyEvidenceIfScoresOtherwiseUnpersistable,
  backfillMoment5KeyEvidenceIfScoresOtherwiseUnpersistable,
  extractScenario3UserCorpusAfterLastRepairPrompt,
  fillMoment5KeyEvidenceWhenNumericScoreButMissingQuote,
  normalizeScoresByEvidence,
  sliceTranscriptForScenario3Scoring,
  classifyConflictValidity,
  extractPriorM5TranscriptBeforeClarification,
  looksLikeMoment5ConflictValidityClarificationPrompt,
  type ScenarioCorpusMessageSlice,
} from '../../src/features/aria/probeAndScoringUtils';
import { parseJsonObjectFromModelText } from '../../src/utilities/parseHolisticModelJson';
import { callAnthropicUserPrompt } from './anthropicScriptClient';
import { logScenarioSliceDebug } from './rescoreDebugLogging';
import { FLOOR_AND_BONUS_SCORING_PHILOSOPHY } from '../../src/features/aria/holisticScoringPrompt';
import {
  aggregateMarkerScoresFromSlicesDetailed,
  combinedContemptFromScenarioPillarScores,
  PILLAR_ROLLUP_ALGORITHM_VERSION,
} from '../../src/features/aria/aggregateMarkerScoresFromSlices';

export type TranscriptTurn = {
  role: string;
  content: string;
  scenarioNumber?: number;
  interviewMoment?: number;
};

export type LlmRescorePromptPreview = {
  label: string;
  charCount: number;
  preview: string;
};

export type LlmRescorePipelineResult = {
  recalculate: AdminRecalculateResult;
  scenarioScores: Record<1 | 2 | 3, Record<string, unknown> | null>;
  moment4Scores: Record<string, unknown> | null;
  moment5Scores: Record<string, unknown> | null;
  prompts?: LlmRescorePromptPreview[];
};

const SCENARIO_MARKER_IDS: Record<1 | 2 | 3, string[]> = {
  1: ['mentalizing', 'accountability', 'contempt_recognition', 'contempt_expression', 'repair', 'attunement'],
  2: ['appreciation', 'attunement', 'mentalizing', 'repair', 'accountability', 'contempt_expression'],
  3: ['regulation', 'repair', 'mentalizing', 'attunement', 'accountability', 'contempt_expression'],
};

function messagesForScenario(transcript: TranscriptTurn[], scenarioNum: 1 | 2 | 3): TranscriptTurn[] {
  const corpus =
    scenarioNum === 3 ? sliceTranscriptForScenario3Scoring(transcript as ScenarioCorpusMessageSlice[]) : transcript;
  const tagged = corpus.filter((m) => m.scenarioNumber === scenarioNum);
  return tagged.length >= 2 ? tagged : corpus;
}

function bundleScenario(n: 1 | 2 | 3, parsed: Record<string, unknown>): Record<string, unknown> {
  return {
    scenarioNumber: n,
    pillarScores: parsed.pillarScores ?? {},
    pillarConfidence: parsed.pillarConfidence ?? {},
    keyEvidence: parsed.keyEvidence ?? {},
    mentalizing_overcertainty: parsed.mentalizing_overcertainty === true,
  };
}

async function scoreScenarioLlm(
  scenarioNumber: 1 | 2 | 3,
  transcript: TranscriptTurn[],
  priorMentalizing: { s1?: number; s2?: number },
): Promise<{ parsed: Record<string, unknown>; prompt: string }> {
  const scoringMessages = messagesForScenario(transcript, scenarioNumber);
  const repairFocus =
    scenarioNumber === 3
      ? extractScenario3UserCorpusAfterLastRepairPrompt(scoringMessages as ScenarioCorpusMessageSlice[]) || null
      : null;
  const prior =
    scenarioNumber === 3
      ? {
          s1: typeof priorMentalizing.s1 === 'number' ? priorMentalizing.s1 : undefined,
          s2: typeof priorMentalizing.s2 === 'number' ? priorMentalizing.s2 : undefined,
        }
      : null;
  const prompt = buildScenarioScoringPrompt(
    scenarioNumber,
    scoringMessages,
    prior,
    repairFocus,
  );
  const raw = await callAnthropicUserPrompt(prompt, {
    maxTokens: scenarioNumber === 1 ? 800 : 1200,
  });
  const parsed = parseJsonObjectFromModelText(raw) as Record<string, unknown>;
  postProcessScenarioScoreFromModelText({
    scenarioNumber,
    rawModelText: raw,
    parsed,
    scoringMessages,
  });
  return { parsed, prompt };
}

async function scoreMoment4Llm(slice: TranscriptTurn[]): Promise<{ parsed: Record<string, unknown>; prompt: string }> {
  const prompt = buildPersonalMomentScoringPrompt(slice, null);
  const raw = await callAnthropicUserPrompt(prompt, { maxTokens: 900 });
  const parsed = parseJsonObjectFromModelText(raw) as Record<string, unknown>;
  applyMoment4PostParseCoercionAndSalvage(raw, parsed);
  const m4Norm = normalizeScoresByEvidence(
    (parsed.pillarScores as Record<string, number | null>) ?? {},
    (parsed.keyEvidence as Record<string, string>) ?? {},
  );
  const m4Elabor = applyElaborationAbsencePenaltiesMoment4(
    m4Norm,
    (parsed.keyEvidence as Record<string, string>) ?? {},
    null,
    0,
  );
  parsed.pillarScores = m4Elabor.pillarScores;
  parsed.keyEvidence = m4Elabor.keyEvidence;
  backfillMoment4KeyEvidenceIfScoresOtherwiseUnpersistable(
    parsed as { pillarScores?: Record<string, number | null>; keyEvidence?: Record<string, string> },
  );
  return { parsed, prompt };
}

async function scoreMoment5Llm(
  slice: TranscriptTurn[],
  meta: Moment5ClientScoringMetadata | null,
): Promise<{ parsed: Record<string, unknown>; prompt: string }> {
  const conflictValidityUsed =
    meta?.conflictValidity ??
    (meta?.conflictValidityLow === true ? 'no_conflict' : null);
  const prompt = buildMoment5AccountabilityScoringPrompt(slice, meta);
  console.log('[M5_SCORING_PROMPT_CONFLICT_VALIDITY] value used in prompt:', conflictValidityUsed);
  console.log('[M5_SCORING_PROMPT_CONFLICT_VALIDITY] prompt excerpt (first 500 chars):', prompt.slice(0, 500));
  const raw = await callAnthropicUserPrompt(prompt, { maxTokens: 900 });
  const parsed = parseJsonObjectFromModelText(raw) as Record<string, unknown>;
  applyMoment5PostParseCoercionAndSalvage(raw, parsed);
  promoteMoment5LegacyContemptForScoringResult(parsed);
  fillMoment5KeyEvidenceWhenNumericScoreButMissingQuote(parsed as never);
  parsed.pillarScores = normalizeScoresByEvidence(
    (parsed.pillarScores as Record<string, number | null>) ?? {},
    (parsed.keyEvidence as Record<string, string>) ?? {},
  );
  const m5UserText = slice.filter((m) => m.role === 'user').map((m) => m.content).join(' ');
  const m5Elabor = applyElaborationAbsencePenaltiesMoment5(
    m5UserText,
    (parsed.pillarScores as Record<string, number | null>) ?? {},
    (parsed.keyEvidence as Record<string, string>) ?? {},
    0,
  );
  parsed.pillarScores = m5Elabor.pillarScores;
  parsed.keyEvidence = m5Elabor.keyEvidence;
  backfillMoment5KeyEvidenceIfScoresOtherwiseUnpersistable(
    parsed as { pillarScores?: Record<string, number | null>; keyEvidence?: Record<string, string> },
  );
  if (meta) parsed.scoringMetadata = meta;
  return { parsed, prompt };
}

function moment5MetaFromStored(patterns: unknown): Moment5ClientScoringMetadata | null {
  if (!patterns || typeof patterns !== 'object' || Array.isArray(patterns)) return null;
  const m5 = (patterns as Record<string, unknown>).moment_5_scores;
  if (!m5 || typeof m5 !== 'object' || Array.isArray(m5)) return null;
  const meta = (m5 as Record<string, unknown>).scoringMetadata;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return null;
  return meta as Moment5ClientScoringMetadata;
}

/** Same clarification Q+A detection as the live interview pipeline (AriaScreen processUserSpeech). */
function findMoment5ConflictValidityClarificationAnswerInSlice(m5Slice: TranscriptTurn[]): {
  clarificationAnswer: string | null;
  priorTranscriptBeforeAnswer: TranscriptTurn[];
} {
  let clarificationAssistantIdx = -1;
  for (let i = m5Slice.length - 1; i >= 0; i--) {
    const m = m5Slice[i];
    if (m.role !== 'assistant') continue;
    if (looksLikeMoment5ConflictValidityClarificationPrompt((m.content ?? '').trim())) {
      clarificationAssistantIdx = i;
      break;
    }
  }
  if (clarificationAssistantIdx < 0) {
    return { clarificationAnswer: null, priorTranscriptBeforeAnswer: m5Slice };
  }
  const after = m5Slice.slice(clarificationAssistantIdx + 1);
  const firstUser = after.find((m) => m.role === 'user' && (m.content ?? '').trim().length > 0);
  return {
    clarificationAnswer: firstUser?.content?.trim() ?? null,
    priorTranscriptBeforeAnswer: m5Slice.slice(0, clarificationAssistantIdx + 1),
  };
}

/**
 * Re-run classifyConflictValidity from the M5 transcript slice before building the M5 scoring prompt.
 * Falls back to stored metadata when no clarification answer turn is present.
 */
function reclassifyMoment5ConflictValidityMeta(
  m5Slice: TranscriptTurn[],
  storedMeta: Moment5ClientScoringMetadata | null,
  debug?: boolean,
): Moment5ClientScoringMetadata | null {
  const { clarificationAnswer, priorTranscriptBeforeAnswer } =
    findMoment5ConflictValidityClarificationAnswerInSlice(m5Slice);

  if (!clarificationAnswer) {
    if (debug) {
      console.log('[M5_CONFLICT_VALIDITY] stored:', storedMeta?.conflictValidity);
      console.log('[M5_CONFLICT_VALIDITY] reclassified: (none — no clarification answer in M5 slice)');
      console.log('[M5_CONFLICT_VALIDITY] prior transcript excerpt:', '');
      console.log('[M5_CONFLICT_VALIDITY] clarification answer:', null);
      console.log('[M5_CONFLICT_VALIDITY] using stored metadata (no clarification answer turn found)');
    }
    return storedMeta;
  }

  const priorM5 = extractPriorM5TranscriptBeforeClarification(priorTranscriptBeforeAnswer);
  const reclassifiedResult = classifyConflictValidity(clarificationAnswer, priorM5);

  if (debug) {
    console.log('[M5_CONFLICT_VALIDITY] stored:', storedMeta?.conflictValidity);
    console.log('[M5_CONFLICT_VALIDITY] reclassified:', reclassifiedResult);
    console.log('[M5_CONFLICT_VALIDITY] prior transcript excerpt:', priorM5.slice(0, 300));
    console.log('[M5_CONFLICT_VALIDITY] clarification answer:', clarificationAnswer);
  }

  const storedEffective =
    storedMeta?.conflictValidity ??
    (storedMeta?.conflictValidityLow === true ? 'no_conflict' : null);
  if (storedEffective != null && storedEffective !== reclassifiedResult) {
    console.log(
      `[M5_CONFLICT_VALIDITY] RECOMPUTED differs from stored — using reclassified "${reclassifiedResult}" (stored was "${storedEffective}")`,
    );
  }

  return {
    ...(storedMeta ?? { accountabilityProbeFired: false }),
    conflictValidityClarificationAsked: true,
    conflictValidity: reclassifiedResult,
  };
}

function promptPreview(label: string, prompt: string): LlmRescorePromptPreview {
  return {
    label,
    charCount: prompt.length,
    preview: prompt.slice(0, 480).replace(/\s+/g, ' ').trim() + (prompt.length > 480 ? '…' : ''),
  };
}

function logScenarioRescorePillarDebug(scenarioNum: 1 | 2 | 3, parsed: Record<string, unknown>): void {
  const pillarScores = (parsed.pillarScores as Record<string, unknown>) ?? {};
  const keyEvidence = (parsed.keyEvidence as Record<string, string>) ?? {};
  console.log(`[S${scenarioNum}_RESCORE_DEBUG] mentalizing:`, pillarScores.mentalizing);
  console.log(`[S${scenarioNum}_RESCORE_DEBUG] contempt_expression:`, pillarScores.contempt_expression);
  console.log(`[S${scenarioNum}_RESCORE_DEBUG] contempt_recognition:`, pillarScores.contempt_recognition);
  console.log(
    `[S${scenarioNum}_RESCORE_DEBUG] mentalizing_evidence:`,
    typeof keyEvidence.mentalizing === 'string' ? keyEvidence.mentalizing.slice(0, 200) : keyEvidence.mentalizing,
  );
  console.log(
    `[S${scenarioNum}_RESCORE_DEBUG] contempt_evidence:`,
    typeof keyEvidence.contempt_expression === 'string'
      ? keyEvidence.contempt_expression.slice(0, 200)
      : keyEvidence.contempt_expression,
  );
  const combinedContempt = combinedContemptFromScenarioPillarScores(
    pillarScores as Record<string, number | null>,
    keyEvidence,
  );
  console.log(`[S${scenarioNum}_RESCORE_DEBUG] combined_contempt_60_40:`, combinedContempt);
}

function logMoment5RescorePillarDebug(parsed: Record<string, unknown>): void {
  const pillarScores = (parsed.pillarScores as Record<string, unknown>) ?? {};
  const keyEvidence = (parsed.keyEvidence as Record<string, string>) ?? {};
  console.log('[M5_RESCORE_DEBUG] mentalizing:', pillarScores.mentalizing);
  console.log('[M5_RESCORE_DEBUG] contempt_expression:', pillarScores.contempt_expression);
  console.log('[M5_RESCORE_DEBUG] accountability:', pillarScores.accountability);
  console.log(
    '[M5_RESCORE_DEBUG] mentalizing_evidence:',
    typeof keyEvidence.mentalizing === 'string' ? keyEvidence.mentalizing.slice(0, 200) : keyEvidence.mentalizing,
  );
  console.log(
    '[M5_RESCORE_DEBUG] contempt_evidence:',
    typeof keyEvidence.contempt_expression === 'string'
      ? keyEvidence.contempt_expression.slice(0, 200)
      : keyEvidence.contempt_expression,
  );
}

function logRollupPillarTrace(opts: {
  scenarioScores: Record<1 | 2 | 3, Record<string, unknown>>;
  moment4Scores: Record<string, unknown> | null;
  moment5Scores: Record<string, unknown> | null;
}): void {
  const { scenarioScores, moment4Scores, moment5Scores } = opts;
  const sliceLabels = ['S1', 'S2', 'S3', 'M4', 'M5'] as const;
  const slices = [
    scenarioScores[1],
    scenarioScores[2],
    scenarioScores[3],
    moment4Scores,
    moment5Scores,
  ].map((row) =>
    row
      ? {
          pillarScores: (row.pillarScores as Record<string, number | null>) ?? {},
          keyEvidence: (row.keyEvidence as Record<string, string>) ?? {},
        }
      : null,
  );

  console.log(`[ROLLUP_DEBUG] algorithm: ${PILLAR_ROLLUP_ALGORITHM_VERSION}`);
  console.log('[ROLLUP_DEBUG] mentalizing rollup uses S1+S2+S3 only (M4/M5 excluded per STANDARD_MARKER_ALLOWED_MOMENTS)');

  for (let i = 0; i < sliceLabels.length; i++) {
    const ps = slices[i]?.pillarScores ?? {};
    console.log(
      `[ROLLUP_DEBUG] ${sliceLabels[i]} slice mentalizing=${ps.mentalizing ?? 'null'} contempt_expression=${ps.contempt_expression ?? 'null'} contempt_recognition=${ps.contempt_recognition ?? 'null'}`,
    );
  }

  const expressionVals = [1, 2, 3].map((n) => {
    const ps = scenarioScores[n as 1 | 2 | 3].pillarScores as Record<string, number | null>;
    const ke = scenarioScores[n as 1 | 2 | 3].keyEvidence as Record<string, string>;
    return ps?.contempt_expression ?? null;
  }).filter((v): v is number => typeof v === 'number');
  const recognitionVals: number[] = [];
  const s1Ps = scenarioScores[1].pillarScores as Record<string, number | null>;
  const s1Ke = scenarioScores[1].keyEvidence as Record<string, string>;
  if (typeof s1Ps?.contempt_recognition === 'number') recognitionVals.push(s1Ps.contempt_recognition);
  const m4Ps = moment4Scores?.pillarScores as Record<string, number | null> | undefined;
  if (typeof m4Ps?.contempt_recognition === 'number') recognitionVals.push(m4Ps.contempt_recognition);

  const exprAvg =
    expressionVals.length > 0
      ? Math.round(expressionVals.reduce((a, b) => a + b, 0) / expressionVals.length)
      : null;
  const recAvg =
    recognitionVals.length > 0
      ? Math.round(recognitionVals.reduce((a, b) => a + b, 0) / recognitionVals.length)
      : null;
  const manualContempt =
    exprAvg != null && recAvg != null
      ? Math.round(0.6 * exprAvg + 0.4 * recAvg)
      : exprAvg ?? recAvg;

  console.log('[ROLLUP_DEBUG] contempt expression pool (S1+S2+S3):', expressionVals, 'avg=', exprAvg);
  console.log('[ROLLUP_DEBUG] contempt recognition pool (S1+M4):', recognitionVals, 'avg=', recAvg);
  console.log('[ROLLUP_DEBUG] manual contempt aggregate (60% expr + 40% rec):', manualContempt);

  const agg = aggregateMarkerScoresFromSlicesDetailed(slices);
  console.log('[ROLLUP_DEBUG] aggregate mentalizing:', agg.scores.mentalizing, `(n=${agg.contributorCounts.mentalizing ?? 0} scenario slices)`);
  console.log('[ROLLUP_DEBUG] aggregate contempt:', agg.scores.contempt, `(n=${agg.contributorCounts.contempt ?? 0} pools)`);
  console.log('[ROLLUP_DEBUG] aggregate attunement:', agg.scores.attunement);
}

function logCalibrationPreservationNoteCheck(): void {
  const holisticPrompt = FLOOR_AND_BONUS_SCORING_PHILOSOPHY;
  console.log(
    '[CALIBRATION_NOTE_CHECK] holisticPrompt excerpt around calibration:',
    holisticPrompt.includes('CALIBRATION PRESERVATION NOTE')
      ? 'FOUND'
      : 'NOT FOUND - prompt changes may not have landed',
  );
  if (holisticPrompt.includes('Do not compress scores toward the middle')) {
    console.log('[CALIBRATION_NOTE_CHECK] "Do not compress scores toward the middle" text: FOUND');
  } else {
    console.log('[CALIBRATION_NOTE_CHECK] "Do not compress scores toward the middle" text: NOT FOUND');
  }
}

export async function runLlmRescorePipeline(opts: {
  transcript: TranscriptTurn[];
  recalculateInput: Omit<
    AdminRecalculateAttemptInput,
    'scenario_1_scores' | 'scenario_2_scores' | 'scenario_3_scores' | 'scenario_specific_patterns'
  >;
  storedScenarioPatterns?: unknown;
  storedScenarioScores?: {
    scenario_1_scores?: unknown;
    scenario_2_scores?: unknown;
    scenario_3_scores?: unknown;
  };
  dryRun?: boolean;
  debug?: boolean;
}): Promise<LlmRescorePipelineResult> {
  const { transcript, recalculateInput, storedScenarioPatterns, storedScenarioScores, dryRun, debug } = opts;
  const personal = inferPersonalMomentSlices(transcript);
  const storedM5Meta = moment5MetaFromStored(storedScenarioPatterns);
  const m5SliceForDebug = trimMoment5SliceForScoring(personal.moment5);
  /** Rescore replays classification from transcript so calibration reflects current rules (not stale stored meta). */
  const m5Meta = reclassifyMoment5ConflictValidityMeta(m5SliceForDebug, storedM5Meta, debug);

  logCalibrationPreservationNoteCheck();

  const promptPlans: Array<{ label: string; build: () => string | Promise<string> }> = [
    {
      label: 'Scenario 1',
      build: () =>
        buildScenarioScoringPrompt(1, messagesForScenario(transcript, 1), null, null),
    },
    {
      label: 'Scenario 2',
      build: () =>
        buildScenarioScoringPrompt(2, messagesForScenario(transcript, 2), null, null),
    },
    {
      label: 'Scenario 3',
      build: () => {
        const msgs = messagesForScenario(transcript, 3);
        return buildScenarioScoringPrompt(
          3,
          msgs,
          { s1: undefined, s2: undefined },
          extractScenario3UserCorpusAfterLastRepairPrompt(msgs as ScenarioCorpusMessageSlice[]) || null,
        );
      },
    },
    {
      label: 'Moment 4',
      build: () => buildPersonalMomentScoringPrompt(personal.moment4, null),
    },
    {
      label: 'Moment 5',
      build: () => buildMoment5AccountabilityScoringPrompt(trimMoment5SliceForScoring(personal.moment5), m5Meta),
    },
  ];

  if (dryRun) {
    const prompts = promptPlans.map((p) => {
      const text = p.build();
      return promptPreview(p.label, typeof text === 'string' ? text : '');
    });
    return {
      recalculate: {
        kind: 'incomplete',
        gate: { pass: false, weightedScore: null, modifiedWeightedScore: null, failReasonCodes: [] },
        notes: ['dry-run: no LLM calls'],
        completionFailure: {
          ok: false,
          incomplete_reason: 'dry_run',
          missingScenarioNumbers: [],
          missingMoment4: false,
          detail: 'dry-run',
        },
      },
      scenarioScores: { 1: null, 2: null, 3: null },
      moment4Scores: null,
      moment5Scores: null,
      prompts,
    };
  }

  const prompts: LlmRescorePromptPreview[] = [];
  const prior: { s1?: number; s2?: number } = {};

  const s1 = await scoreScenarioLlm(1, transcript, prior);
  prompts.push(promptPreview('Scenario 1', s1.prompt));
  logScenarioRescorePillarDebug(1, s1.parsed);
  if (debug) {
    logScenarioSliceDebug({
      scenarioNumber: 1,
      parsed: s1.parsed,
      storedScenarioScores: storedScenarioScores?.scenario_1_scores,
    });
  }
  prior.s1 = (s1.parsed.pillarScores as Record<string, number>)?.mentalizing ?? undefined;

  const s2 = await scoreScenarioLlm(2, transcript, prior);
  prompts.push(promptPreview('Scenario 2', s2.prompt));
  logScenarioRescorePillarDebug(2, s2.parsed);
  if (debug) {
    logScenarioSliceDebug({
      scenarioNumber: 2,
      parsed: s2.parsed,
      storedScenarioScores: storedScenarioScores?.scenario_2_scores,
    });
  }
  prior.s2 = (s2.parsed.pillarScores as Record<string, number>)?.mentalizing ?? undefined;

  const s3 = await scoreScenarioLlm(3, transcript, prior);
  prompts.push(promptPreview('Scenario 3', s3.prompt));
  logScenarioRescorePillarDebug(3, s3.parsed);

  let moment4Scores: Record<string, unknown> | null = null;
  if (personal.moment4.filter((m) => m.role === 'user').length >= 1) {
    const m4 = await scoreMoment4Llm(personal.moment4);
    prompts.push(promptPreview('Moment 4', m4.prompt));
    const sanitized = sanitizePersonalMomentScoresForAggregate({
      pillarScores: (m4.parsed.pillarScores as Record<string, number | null>) ?? {},
      keyEvidence: (m4.parsed.keyEvidence as Record<string, string>) ?? {},
      response_concreteness: (m4.parsed.response_concreteness as string) ?? null,
      mentalizing_overcertainty: m4.parsed.mentalizing_overcertainty === true,
    });
    moment4Scores =
      sanitized && personalMomentBundleWasScored(sanitized)
        ? {
            momentNumber: 4,
            pillarScores: sanitized.pillarScores,
            keyEvidence: sanitized.keyEvidence,
            response_concreteness: sanitized.response_concreteness ?? null,
            mentalizing_overcertainty: sanitized.mentalizing_overcertainty === true,
          }
        : null;
  }

  let moment5Scores: Record<string, unknown> | null = null;
  const m5Slice = m5SliceForDebug;
  if (m5Slice.filter((m) => m.role === 'user').length >= 1) {
    const m5 = await scoreMoment5Llm(m5Slice, m5Meta);
    prompts.push(promptPreview('Moment 5', m5.prompt));
    logMoment5RescorePillarDebug(m5.parsed);
    const sanitized = sanitizeMoment5PersonalScoresForAggregate({
      pillarScores: (m5.parsed.pillarScores as Record<string, number | null>) ?? {},
      keyEvidence: (m5.parsed.keyEvidence as Record<string, string>) ?? {},
      response_concreteness: (m5.parsed.response_concreteness as string) ?? null,
      mentalizing_overcertainty: m5.parsed.mentalizing_overcertainty === true,
    });
    moment5Scores =
      sanitized && personalMomentBundleWasScored(sanitized)
        ? {
            momentNumber: 5,
            pillarScores: sanitized.pillarScores,
            keyEvidence: sanitized.keyEvidence,
            response_concreteness: sanitized.response_concreteness ?? null,
            mentalizing_overcertainty: sanitized.mentalizing_overcertainty === true,
            scoringMetadata: m5.parsed.scoringMetadata ?? m5Meta,
          }
        : null;
  }

  const scenarioScores = {
    1: bundleScenario(1, s1.parsed),
    2: bundleScenario(2, s2.parsed),
    3: bundleScenario(3, s3.parsed),
  } as Record<1 | 2 | 3, Record<string, unknown>>;

  logRollupPillarTrace({ scenarioScores, moment4Scores, moment5Scores });

  const recalculate = recalculateAttemptScoresFromStoredSlices(
    {
      ...recalculateInput,
      scenario_1_scores: scenarioScores[1],
      scenario_2_scores: scenarioScores[2],
      scenario_3_scores: scenarioScores[3],
      scenario_specific_patterns: {
        ...(typeof storedScenarioPatterns === 'object' && storedScenarioPatterns != null
          ? (storedScenarioPatterns as Record<string, unknown>)
          : {}),
        moment_4_scores: moment4Scores,
        moment_5_scores: moment5Scores,
      },
    },
    /** Fresh LLM slices: reconcile + contempt heuristic inside admin recalculate (matches live completion). */
    { skipScenarioTranscriptMutations: false, usePersistedGateContext: false },
  );

  if (recalculate.kind === 'complete') {
    console.log('[ROLLUP_DEBUG] post-reconcile gate pillar_scores:', recalculate.pillar_scores);
    console.log('[ROLLUP_DEBUG] post-reconcile weighted_score:', recalculate.gate.weightedScore);
  }

  return {
    recalculate,
    scenarioScores,
    moment4Scores,
    moment5Scores,
    prompts,
  };
}

export { SCENARIO_MARKER_IDS };
