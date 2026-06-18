/**
 * Audit cumulative penalty stacking from low M4/M5 disclosure and M4 contempt pool composition.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/auditPenaltyStacking.ts
 *   npx tsx --env-file=.env scripts/auditPenaltyStacking.ts af88b820 ad23da2d e725cdad
 */
import { createClient } from '@supabase/supabase-js';
import {
  aggregateMarkerScoresFromLabeledSlices,
  aggregatePillarScoresWithCommitmentMergeDetailed,
  markerSliceFromStoredScenarioMoment,
  personalMomentWordCountsForDisclosure,
  type LabeledMarkerSlice,
  type PillarMomentLabel,
} from '../src/features/aria/aggregateMarkerScoresFromSlices';
import {
  recalculateAttemptScoresFromStoredSlices,
  type AdminRecalculateAttemptInput,
} from '../src/features/aria/adminRecalculateAttemptScores';
import { GATE_MARKER_BASE_WEIGHTS } from '../src/features/aria/computeGateResultCore';
import { buildDepthSignalModifierLines, sumDepthSignalModifierLines } from '../src/features/admin/depthSignalModifierLines';
import {
  moment4Moment5ConcretenessDepthSignalDelta,
  normalizeMoment4Concreteness,
} from '../src/features/aria/moment4ConcretenessClassification';
import {
  computeDisclosureCalibration,
  computeAvgScenarioTotalUserWords,
} from '../src/features/aria/disclosureCalibration';
import { normalizeResponseConcreteness } from '../src/features/aria/personalMomentConcreteness';

const M4_CONTEMPT_MARKER_IDS = ['contempt_recognition', 'contempt_expression'];

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

const ATTEMPT_SELECT = `
  id,
  user_id,
  completed_at,
  transcript,
  scenario_1_scores,
  scenario_2_scores,
  scenario_3_scores,
  scenario_specific_patterns,
  ego_development_level,
  language_markers,
  skip_count,
  skip_penalty_total,
  auto_failed,
  defense_patterns,
  mentalizing_overcertainty_count,
  personal_moment_emotional_vocab_density,
  personal_moment_emotional_vocab_low,
  weighted_score,
  modified_weighted_score,
  moment_4_concreteness,
  moment_5_concreteness,
  depth_signal_modifier,
  disclosure_calibration
`;

type RawRow = AdminRecalculateAttemptInput & {
  id: string;
  user_id: string;
  weighted_score: number | null;
  modified_weighted_score: number | null;
  moment_4_concreteness: string | null;
  moment_5_concreteness: string | null;
  depth_signal_modifier: number | null;
  disclosure_calibration: string | null;
  ego_development_level: unknown;
};

function parseObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null) return null;
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw as Record<string, unknown>;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      return typeof p === 'object' && p != null && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function ceilingDetected(keyEvidence: Record<string, string> | undefined, marker: string): { yes: boolean; note: string } {
  const ev = keyEvidence?.[marker] ?? '';
  const lower = ev.toLowerCase();
  const hit =
    lower.includes('ceiling:') ||
    lower.includes('low specificity') ||
    lower.includes('insufficient personal narrative') ||
    lower.includes('response-depth modifier');
  return { yes: hit, note: ev.slice(0, 120) || '(no evidence)' };
}

function depthModifierFromKeyEvidence(keyEvidence: Record<string, string> | undefined, marker: string): number {
  const ev = keyEvidence?.[marker] ?? '';
  return /response-depth modifier.*\(?−1\)?/i.test(ev) || /response-depth modifier.*\(-1\)/i.test(ev) ? -1 : 0;
}

function labeled(
  moment: PillarMomentLabel,
  pillarScores: Record<string, number | null>,
  keyEvidence: Record<string, string>,
): LabeledMarkerSlice {
  return { moment, pillarScores, keyEvidence };
}

function auditContemptPools(
  s1: Record<string, unknown> | null,
  s2: Record<string, unknown> | null,
  s3: Record<string, unknown> | null,
  m4: Record<string, unknown> | null,
): void {
  const rows: LabeledMarkerSlice[] = [
    labeled('scenario_1', (s1?.pillarScores as Record<string, number>) ?? {}, (s1?.keyEvidence as Record<string, string>) ?? {}),
    labeled('scenario_2', (s2?.pillarScores as Record<string, number>) ?? {}, (s2?.keyEvidence as Record<string, string>) ?? {}),
    labeled('scenario_3', (s3?.pillarScores as Record<string, number>) ?? {}, (s3?.keyEvidence as Record<string, string>) ?? {}),
    labeled('moment_4', (m4?.pillarScores as Record<string, number>) ?? {}, (m4?.keyEvidence as Record<string, string>) ?? {}),
  ];

  const expressionMoments: string[] = [];
  const recognitionMoments: string[] = [];
  for (const row of rows) {
    const ps = row.pillarScores ?? {};
    const ke = row.keyEvidence ?? {};
    const expr = ps.contempt_expression ?? ps.contempt;
    const rec = ps.contempt_recognition ?? (row.moment === 'scenario_1' ? ps.contempt : undefined);
    if (row.moment !== 'moment_4' && expr != null) expressionMoments.push(`${row.moment}=${expr}`);
    if (rec != null) recognitionMoments.push(`${row.moment}=${rec}`);
  }

  const agg = aggregateMarkerScoresFromLabeledSlices(rows);
  const m4Ps = (m4?.pillarScores as Record<string, number>) ?? {};

  console.log('M4 CONTEMPT FIELD AUDIT');
  console.log('=========================');
  console.log('M4 scoring prompt outputs these contempt-related fields:', M4_CONTEMPT_MARKER_IDS.join(', '));
  console.log('contempt_expression pool composition: scenario_1 + scenario_2 + scenario_3 ONLY (moment_4 excluded)');
  console.log(`  samples in pool: ${expressionMoments.length ? expressionMoments.join(', ') : '(none)'}`);
  console.log('contempt_recognition pool composition: scenario_1 + moment_4');
  console.log(`  samples in pool: ${recognitionMoments.length ? recognitionMoments.join(', ') : '(none)'}`);
  console.log(
    `M4 slice stored contempt_expression=${m4Ps.contempt_expression ?? 'null'} (NOT pooled into aggregate contempt)`,
  );
  console.log(
    `M4 slice stored contempt_recognition=${m4Ps.contempt_recognition ?? 'null'} (pooled into aggregate contempt)`,
  );
  console.log(`Aggregate contempt pillar (60% expression + 40% recognition): ${agg.scores.contempt ?? 'n/a'}`);
  console.log('');
  console.log(
    'Interpretation: M4 contempt_expression is scored but structurally separable — it does NOT enter the',
  );
  console.log(
    'aggregate contempt pillar. M4 contempt_recognition is the M4-specific signal (ongoing bitterness',
  );
  console.log(
    'toward a real person). Removing contempt_expression from M4 scoring would not affect rollup;',
  );
  console.log('removing contempt_recognition would reduce the recognition pool to scenario_1 only.');
  console.log('');
}

function auditAttempt(row: RawRow): void {
  const recalc = recalculateAttemptScoresFromStoredSlices(row, {
    skipScenarioTranscriptMutations: true,
    usePersistedGateContext: false,
  });
  if (recalc.kind !== 'success') {
    console.log(`PENALTY STACKING AUDIT — ${row.id} (${row.user_id})`);
    console.log('====================================');
    console.log('INCOMPLETE — cannot audit:', recalc.notes.join('; '));
    console.log('');
    return;
  }

  const patterns = parseObject(row.scenario_specific_patterns);
  const m4Raw = parseObject(patterns?.moment_4_scores);
  const m5Raw = parseObject(patterns?.moment_5_scores);
  const m4Ke = (m4Raw?.keyEvidence as Record<string, string>) ?? {};
  const m5Ke = (m5Raw?.keyEvidence as Record<string, string>) ?? {};
  const m4Ps = (m4Raw?.pillarScores as Record<string, number>) ?? {};
  const m5Ps = (m5Raw?.pillarScores as Record<string, number>) ?? {};

  const tx = Array.isArray(row.transcript) ? row.transcript : [];
  const agg = aggregatePillarScoresWithCommitmentMergeDetailed(
    [
      markerSliceFromStoredScenarioMoment(row.scenario_1_scores),
      markerSliceFromStoredScenarioMoment(row.scenario_2_scores),
      markerSliceFromStoredScenarioMoment(row.scenario_3_scores),
      markerSliceFromStoredScenarioMoment(m4Raw),
      markerSliceFromStoredScenarioMoment(m5Raw),
    ],
    { disclosureCalibrationTranscript: tx as Array<{ role?: string; content?: string; interviewMoment?: number }> },
  );

  const m4c =
    recalc.moment_4_concreteness ??
    agg.moment4Concreteness ??
    normalizeMoment4Concreteness(m4Raw?.response_concreteness ?? m4Raw?.specificity);
  const m5c =
    recalc.moment_5_concreteness ??
    agg.moment5Concreteness ??
    normalizeResponseConcreteness(m5Raw?.response_concreteness ?? m5Raw?.specificity);
  const wordCounts = personalMomentWordCountsForDisclosure(
    [
      null,
      null,
      null,
      markerSliceFromStoredScenarioMoment(m4Raw),
      markerSliceFromStoredScenarioMoment(m5Raw),
    ],
    tx,
  );
  const avgScenario = computeAvgScenarioTotalUserWords(tx);
  const disclosure =
    recalc.disclosure_calibration ??
    computeDisclosureCalibration(
      m4c,
      m5c,
      wordCounts.moment4WordCount,
      wordCounts.moment5WordCount,
      avgScenario > 0 ? avgScenario : null,
      tx,
    );

  const egoForGate = recalc.ego_development_level ?? agg.egoDevelopmentLevel;

  const gateDisclosure = recalc.disclosure_calibration ?? disclosure;
  const gateM4c = recalc.moment_4_concreteness ?? m4c;
  const gateM5c = recalc.moment_5_concreteness ?? m5c;
  const gateVocabLow = recalc.personal_moment_emotional_vocab_low ?? agg.personal_moment_emotional_vocab_low;

  const gateOpts = {
    egoDevelopmentLevel: egoForGate,
    defensePatterns: recalc.defense_patterns ?? agg.defensePatterns,
    moment4Concreteness: gateM4c,
    moment5Concreteness: gateM5c,
    disclosureCalibration: gateDisclosure,
    mentalizingOvercertaintyCount: recalc.mentalizingOvercertaintyCount ?? agg.mentalizingOvercertaintyCount,
    personalMomentEmotionalVocabLow: gateVocabLow,
    personalMomentEmotionalVocabDensity:
      recalc.personal_moment_emotional_vocab_density ?? agg.personal_moment_emotional_vocab_density,
    moment4WordCount: wordCounts.moment4WordCount,
    moment5WordCount: wordCounts.moment5WordCount,
  };
  const depthLines = buildDepthSignalModifierLines(gateOpts);
  const depthTotal = recalc.gate.depthSignalModifier ?? sumDepthSignalModifierLines(depthLines);

  const concretenessDelta = moment4Moment5ConcretenessDepthSignalDelta(m4c, m5c);
  const disclosureLine = depthLines.find((l) => l.label === 'Disclosure calibration');
  const concretenessLine = depthLines.find((l) => l.label === 'Personal moment concreteness');
  const vocabLine = depthLines.find((l) => l.label === 'Personal moment emotional vocabulary');

  const weighted = recalc.gate.weightedScore ?? row.weighted_score ?? 0;
  const modified = recalc.gate.modifiedWeightedScore ?? row.modified_weighted_score ?? 0;
  const gap = Math.round((weighted - modified) * 100) / 100;

  const m4MentalizingCeiling = ceilingDetected(m4Ke, 'mentalizing');
  const m4AccountabilityCeiling = ceilingDetected(m4Ke, 'accountability');
  const m5MentalizingCeiling = ceilingDetected(m5Ke, 'mentalizing');
  const m5RepairCeiling = ceilingDetected(m5Ke, 'repair');

  const m4DepthMentalizing = depthModifierFromKeyEvidence(m4Ke, 'mentalizing');
  const m4DepthAccountability = depthModifierFromKeyEvidence(m4Ke, 'accountability');
  const m5DepthMentalizing = depthModifierFromKeyEvidence(m5Ke, 'mentalizing');
  const m5DepthRepair = depthModifierFromKeyEvidence(m5Ke, 'repair');

  const disclosurePenaltySum =
    (concretenessLine?.delta ?? 0) + (disclosureLine?.delta ?? 0) + (vocabLine?.delta ?? 0);

  const nonDisclosureDepth = depthTotal - disclosurePenaltySum;
  const pctOfGap = gap > 0 ? Math.round((Math.abs(disclosurePenaltySum) / gap) * 1000) / 10 : 0;

  const commitmentScore = recalc.pillar_scores.commitment_threshold ?? m4Ps.commitment_threshold;
  const commitmentWeight = GATE_MARKER_BASE_WEIGHTS.commitment_threshold;
  const commitmentContribution =
    typeof commitmentScore === 'number' ? Math.round(commitmentScore * commitmentWeight * 100) / 100 : null;

  console.log(`PENALTY STACKING AUDIT — ${row.id}`);
  console.log(`user_id: ${row.user_id}`);
  console.log('====================================');
  console.log(`Raw M4 concreteness: ${m4c ?? 'null'}`);
  console.log(`Raw M5 concreteness: ${m5c ?? 'null'}`);
  console.log(`M4 user words: ${wordCounts.moment4WordCount ?? 'n/a'} | M5 user words: ${wordCounts.moment5WordCount ?? 'n/a'}`);
  console.log(`Avg scenario user words: ${avgScenario > 0 ? avgScenario.toFixed(1) : 'n/a'}`);
  console.log(`disclosure_calibration: ${disclosure}`);
  console.log(`weighted_score: ${weighted} → modified_weighted_score: ${modified} (gap ${gap})`);
  console.log(`depth_signal_modifier (recomputed): ${depthTotal} (stored: ${row.depth_signal_modifier})`);
  console.log('');

  console.log('Mechanism 1 — Pillar-level cap/penalty within M4/M5 scoring prompt:');
  console.log(
    `  Rollup note: mentalizing & accountability aggregate from scenarios 1–3 ONLY — M4/M5 slice caps do NOT change final pillar_scores for those markers.`,
  );
  console.log(
    `  mentalizing (M4 slice): stored=${m4Ps.mentalizing ?? 'null'}, ceiling applied=${m4MentalizingCeiling.yes ? 'yes' : 'no'}`,
  );
  if (m4MentalizingCeiling.yes) console.log(`    evidence: ${m4MentalizingCeiling.note}`);
  console.log(
    `  accountability (M4 slice): stored=${m4Ps.accountability ?? 'null'}, ceiling applied=${m4AccountabilityCeiling.yes ? 'yes' : 'no'}`,
  );
  if (m4AccountabilityCeiling.yes) console.log(`    evidence: ${m4AccountabilityCeiling.note}`);
  console.log(
    `  mentalizing (M5 slice): stored=${m5Ps.mentalizing ?? 'null'}, ceiling applied=${m5MentalizingCeiling.yes ? 'yes' : 'no'}`,
  );
  console.log(
    `  repair (M5 slice): stored=${m5Ps.repair ?? 'null'}, ceiling applied=${m5RepairCeiling.yes ? 'yes' : 'no'}`,
  );
  console.log(
    `  Word-count −1 depth modifier in slice (stored keyEvidence, NOT depth_signal_modifier): M4 mentalizing ${m4DepthMentalizing}, accountability ${m4DepthAccountability}; M5 mentalizing ${m5DepthMentalizing}, repair ${m5DepthRepair}`,
  );
  console.log(
    `  commitment_threshold (M4-only → rollup): ${commitmentScore ?? 'n/a'} × weight ${commitmentWeight} = ${commitmentContribution ?? 'n/a'} weighted contribution`,
  );
  console.log(
    `  → Impact on weighted_score from M4/M5 pillar caps: 0 for mentalizing/accountability (excluded from rollup); commitment_threshold may reflect low disclosure indirectly via LLM scoring.`,
  );
  console.log('');

  console.log('Mechanism 2 — disclosure_calibration penalty:');
  console.log(
    `  underdisclosure contributes: ${disclosureLine?.delta ?? 0} to depth_signal_modifier (NOT a separate weighted_score column)`,
  );
  console.log(
    `  formula: avg(M4,M5 words) < 0.4×avg(scenario words) → underdisclosure → depth_signal_modifier −0.2 (concreteness labels not used)`,
  );
  console.log(
    `  inputs: m4=${m4c}, m5=${m5c}, m4Words=${wordCounts.moment4WordCount}, m5Words=${wordCounts.moment5WordCount}, avgScenario=${avgScenario.toFixed(1)}`,
  );
  console.log('');

  console.log('Mechanism 3 — depth_signal_modifier (personal moment concreteness pair):');
  console.log(`  low M4 + low M5 pair delta: ${concretenessDelta} (via moment4Moment5ConcretenessDepthSignalDelta)`);
  console.log(`  line item: ${concretenessLine?.detail ?? 'n/a'} → ${concretenessLine?.delta ?? 0}`);
  console.log(`  applied as: modified_weighted_score = weighted_score + depth_signal_modifier`);
  console.log('');

  console.log('Mechanism 4 — other concreteness-derived penalties:');
  console.log(
    `  personal_moment_emotional_vocab_low: ${agg.personal_moment_emotional_vocab_low} (density ${agg.personal_moment_emotional_vocab_density ?? 'null'}%) → depth modifier ${vocabLine?.delta ?? 0}`,
  );
  console.log(
    `  response_concreteness fields on slices: M4=${m4Raw?.response_concreteness ?? m4Raw?.specificity ?? 'n/a'}, M5=${m5Raw?.response_concreteness ?? m5Raw?.specificity ?? 'n/a'}`,
  );
  console.log(
    `  personalMomentConcretenessModifier (legacy, computeGateResultCore): hardcoded 0 — superseded by depth_signal_modifier concreteness pair`,
  );
  console.log('');

  console.log('Full depth_signal_modifier line items:');
  for (const line of depthLines) {
    console.log(`  ${line.label}: ${line.delta}${line.detail ? ` (${line.detail})` : ''}`);
  }
  console.log(`  TOTAL depth_signal_modifier: ${depthTotal}`);
  console.log('');

  console.log('TOTAL CUMULATIVE IMPACT (disclosure-related only):');
  console.log(`  Concreteness pair: ${concretenessLine?.delta ?? 0}`);
  console.log(`  Disclosure calibration: ${disclosureLine?.delta ?? 0}`);
  console.log(`  Emotional vocab low: ${vocabLine?.delta ?? 0}`);
  console.log(`  Sum of distinct depth-modifier penalties from low disclosure: ${disclosurePenaltySum}`);
  console.log(`  Non-disclosure depth modifier (ego, defense, ER, etc.): ${nonDisclosureDepth}`);
  console.log(`  As % of weighted→modified gap (${gap}): ${pctOfGap}%`);
  console.log('');

  console.log('INTERPRETATION');
  console.log(
    'disclosure_calibration (underdisclosure) now uses word-count ratio only; concreteness pair delta',
  );
  console.log(
    'covers content-quality. Remaining overlap: emotional_vocab_low may still correlate with short answers.',
  );
  console.log('');

  auditContemptPools(
    parseObject(row.scenario_1_scores),
    parseObject(row.scenario_2_scores),
    parseObject(row.scenario_3_scores),
    m4Raw,
  );
}

async function main(): Promise<void> {
  const idPrefixes = process.argv.slice(2);
  const targets = idPrefixes.length > 0 ? idPrefixes : ['af88b820', 'ad23da2d', 'e725cdad'];

  const { data, error } = await supabase
    .from('interview_attempts')
    .select(ATTEMPT_SELECT)
    .not('completed_at', 'is', null);

  if (error) {
    console.error(error);
    process.exit(1);
  }

  for (const prefix of targets) {
    const row = (data ?? []).find((a) => String((a as { id: string }).id).startsWith(prefix)) as RawRow | undefined;
    if (!row) {
      console.log(`No completed attempt found matching prefix: ${prefix}`);
      console.log('');
      continue;
    }
    auditAttempt(row);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
