/**
 * Read-only diagnostic: appreciation pooling + disclosure calibration for one attempt.
 *
 * Usage:
 *   npx tsx --env-file=.env scripts/diagnoseAttemptRollupDisclosure.ts b8928107-aea5-408b-9a20-d0e45bc9486e
 */
import { createClient } from '@supabase/supabase-js';
import {
  aggregateMarkerScoresFromSlicesDetailed,
  markerSliceFromStoredScenarioMoment,
  PILLAR_ROLLUP_ALGORITHM_VERSION,
  type LabeledMarkerSlice,
  type PillarMomentLabel,
} from '../src/features/aria/aggregateMarkerScoresFromSlices';
import {
  computeDisclosureCalibration,
  computeAvgScenarioTotalUserWords,
  sumUserWordsForInterviewMoment,
} from '../src/features/aria/disclosureCalibration';
import { normalizeMoment4Concreteness } from '../src/features/aria/moment4ConcretenessClassification';
import { normalizeResponseConcreteness } from '../src/features/aria/personalMomentConcreteness';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

const ATTEMPT_ID = process.argv[2] ?? 'b8928107-aea5-408b-9a20-d0e45bc9486e';

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

function scoredAppreciation(ps: Record<string, number | null> | undefined): number | null {
  const v = ps?.appreciation;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function labeled(
  moment: PillarMomentLabel,
  pillarScores: Record<string, number | null>,
  keyEvidence: Record<string, string>,
): LabeledMarkerSlice {
  return { moment, pillarScores, keyEvidence };
}

type ResponseTimingRow = { question_id?: string; word_count?: number; moment_number?: number };

const APPRECIATION_ALLOWED_MOMENTS: PillarMomentLabel[] = ['scenario_1', 'scenario_2'];

async function main(): Promise<void> {
  const { data, error } = await supabase
    .from('interview_attempts')
    .select(
      `
      id,
      user_id,
      pillar_scores,
      scenario_1_scores,
      scenario_2_scores,
      scenario_3_scores,
      scenario_specific_patterns,
      transcript,
      response_timings,
      disclosure_calibration,
      moment_4_concreteness,
      moment_5_concreteness
    `,
    )
    .eq('id', ATTEMPT_ID)
    .maybeSingle();

  if (error || !data) {
    console.error('Failed to load attempt:', error?.message ?? 'not found');
    process.exit(1);
  }

  const s1 = parseObject(data.scenario_1_scores);
  const s2 = parseObject(data.scenario_2_scores);
  const s3 = parseObject(data.scenario_3_scores);
  const patterns = parseObject(data.scenario_specific_patterns);
  const m4 = parseObject(patterns?.moment_4_scores);
  const m5 = parseObject(patterns?.moment_5_scores);
  const storedPillarScores = parseObject(data.pillar_scores) ?? {};
  const tx = Array.isArray(data.transcript) ? data.transcript : [];

  const s1Ps = (s1?.pillarScores as Record<string, number | null>) ?? {};
  const s2Ps = (s2?.pillarScores as Record<string, number | null>) ?? {};
  const s5Ps = (m5?.pillarScores as Record<string, number | null>) ?? {};

  const s1Appreciation = scoredAppreciation(s1Ps);
  const s2Appreciation = scoredAppreciation(s2Ps);
  const m5Appreciation = scoredAppreciation(s5Ps);

  const appreciationPoolSources = APPRECIATION_ALLOWED_MOMENTS;
  const appreciationPoolValues: Array<{ moment: string; value: number }> = [];
  for (const moment of appreciationPoolSources) {
    const row =
      moment === 'scenario_1'
        ? s1
        : moment === 'scenario_2'
          ? s2
          : null;
    const ps = (row?.pillarScores as Record<string, number | null>) ?? {};
    const v = scoredAppreciation(ps);
    if (v != null) appreciationPoolValues.push({ moment, value: v });
  }

  const slices = [
    markerSliceFromStoredScenarioMoment(s1),
    markerSliceFromStoredScenarioMoment(s2),
    markerSliceFromStoredScenarioMoment(s3),
    markerSliceFromStoredScenarioMoment(m4),
    markerSliceFromStoredScenarioMoment(m5),
  ];
  const agg = aggregateMarkerScoresFromSlicesDetailed(slices);
  const aggregateAppreciation = agg.scores.appreciation;
  const contributorCount = agg.contributorCounts.appreciation ?? 0;

  const poolVals = appreciationPoolValues.map((x) => x.value);
  const rawMean = poolVals.length > 0 ? poolVals.reduce((a, b) => a + b, 0) / poolVals.length : null;
  const roundedMean = rawMean != null ? Math.round(rawMean) : null;

  let formulaDescription: string;
  if (contributorCount === 0) {
    formulaDescription = 'no contributing slices';
  } else if (contributorCount === 1) {
    formulaDescription = `single-slice value from ${appreciationPoolValues[0]?.moment ?? 'unknown'}`;
  } else {
    formulaDescription = `Math.round(mean(${poolVals.join(' + ')}) / ${poolVals.length}) = Math.round(${rawMean}) = ${roundedMean}`;
  }

  console.log('[APPRECIATION_POOL_DEBUG] pool composition:', appreciationPoolSources);
  console.log(
    '[APPRECIATION_POOL_DEBUG] S1 appreciation:',
    s1Appreciation,
    '| S2 appreciation:',
    s2Appreciation,
    '| M5 appreciation:',
    m5Appreciation,
  );
  console.log(
    '[APPRECIATION_POOL_DEBUG] computed aggregate:',
    aggregateAppreciation,
    '| formula used:',
    formulaDescription,
  );
  console.log('[APPRECIATION_POOL_DEBUG] contributorCount:', contributorCount);
  console.log('[APPRECIATION_POOL_DEBUG] stored pillar_scores.appreciation:', storedPillarScores.appreciation);
  console.log('[APPRECIATION_POOL_DEBUG] rollup algorithm:', PILLAR_ROLLUP_ALGORITHM_VERSION);

  const m4WordsStored =
    typeof m4?.user_slice_word_count === 'number' ? (m4.user_slice_word_count as number) : null;
  const m5WordsStored =
    typeof m5?.user_slice_word_count === 'number' ? (m5.user_slice_word_count as number) : null;
  const m4WordsTranscript = sumUserWordsForInterviewMoment(tx, 4);
  const m5WordsTranscript = sumUserWordsForInterviewMoment(tx, 5);
  const m4Words = m4WordsStored ?? (m4WordsTranscript > 0 ? m4WordsTranscript : null);
  const m5Words = m5WordsStored ?? (m5WordsTranscript > 0 ? m5WordsTranscript : null);

  const avgScenarioWordsTranscript = computeAvgScenarioTotalUserWords(tx);
  const s1Total = sumUserWordsForInterviewMoment(tx, 1);
  const s2Total = sumUserWordsForInterviewMoment(tx, 2);
  const s3Total = sumUserWordsForInterviewMoment(tx, 3);

  const timings = Array.isArray(data.response_timings)
    ? (data.response_timings as ResponseTimingRow[])
    : [];
  const unpromptedQIds = ['q_1', 'q_4', 'q_7'];
  const unpromptedFromTimings = unpromptedQIds
    .map((qid) => {
      const row = timings.find((t) => t.question_id === qid);
      return row?.word_count != null ? { qid, words: row.word_count } : null;
    })
    .filter(Boolean) as Array<{ qid: string; words: number }>;
  const avgUnpromptedTimings =
    unpromptedFromTimings.length > 0
      ? unpromptedFromTimings.reduce((a, b) => a + b.words, 0) / unpromptedFromTimings.length
      : null;

  const m4Concreteness =
    normalizeMoment4Concreteness(
      data.moment_4_concreteness ?? m4?.response_concreteness ?? m4?.specificity,
    ) ?? null;
  const m5Concreteness =
    normalizeResponseConcreteness(m5?.response_concreteness ?? m5?.specificity) ?? null;

  const avgPersonal =
    m4Words != null && m5Words != null ? (m4Words + m5Words) / 2 : null;
  const ratioTranscriptAvg =
    avgPersonal != null && avgScenarioWordsTranscript > 0
      ? avgPersonal / avgScenarioWordsTranscript
      : null;

  const calibrationResult = computeDisclosureCalibration(
    m4Concreteness,
    m5Concreteness,
    m4Words,
    m5Words,
    avgScenarioWordsTranscript > 0 ? avgScenarioWordsTranscript : null,
    tx,
  );

  console.log('[DISCLOSURE_DEBUG] moment4WordCount:', m4Words, '| moment5WordCount:', m5Words);
  console.log('[DISCLOSURE_DEBUG] avgScenarioWordCount (transcript moment totals 1–3):', avgScenarioWordsTranscript);
  console.log('[DISCLOSURE_DEBUG] scenario moment totals S1/S2/S3:', s1Total, s2Total, s3Total);
  console.log(
    '[DISCLOSURE_DEBUG] response_timings unprompted q_1/q_4/q_7:',
    unpromptedFromTimings,
    '| avg unprompted (informational only):',
    avgUnpromptedTimings,
  );
  console.log(
    '[DISCLOSURE_DEBUG] ratio (uses transcript avg):',
    ratioTranscriptAvg != null ? ratioTranscriptAvg.toFixed(4) : 'n/a',
    '| threshold:',
    0.4,
  );
  console.log(
    '[DISCLOSURE_DEBUG] moment4Concreteness:',
    m4Concreteness,
    '(substantive concreteness can override low word-count ratio)',
  );
  console.log('[DISCLOSURE_DEBUG] moment5Concreteness:', m5Concreteness);
  console.log('[DISCLOSURE_DEBUG] result:', calibrationResult);
  console.log('[DISCLOSURE_DEBUG] stored disclosure_calibration:', data.disclosure_calibration);

  const s1InPool = appreciationPoolSources.includes('scenario_1');
  const s1Contributing =
    s1Appreciation != null && appreciationPoolValues.some((x) => x.moment === 'scenario_1');

  let appreciationConclusion: string;
  if (!s1InPool) {
    appreciationConclusion = 'fix did not deploy — scenario_1 missing from appreciation pool Set';
  } else if (!s1Contributing && s1Appreciation == null) {
    appreciationConclusion = 'fix deployed but S1 appreciation null / no evidence — not pooled numerically';
  } else if (contributorCount >= 2 && aggregateAppreciation === roundedMean) {
    appreciationConclusion = 'fix landed correctly — S1+S2 mean pooled into holistic appreciation';
  } else if (contributorCount === 1 && aggregateAppreciation === s2Appreciation) {
    appreciationConclusion =
      'fix deployed but only one slice contributed — holistic equals sole contributor (check S1 evidence)';
  } else if (aggregateAppreciation === s2Appreciation && contributorCount >= 2) {
    appreciationConclusion = 'fix deployed but aggregate matches S2 only — investigate rounding or evidence gating';
  } else {
    appreciationConclusion = 'inconclusive — inspect pool values and contributorCount above';
  }

  const eitherSubstantive =
    (m4Concreteness === 'high' || m4Concreteness === 'valid_non_applicable') ||
    (m5Concreteness === 'high' || m5Concreteness === 'valid_non_applicable');

  const concretenessAffectsResult =
    calibrationResult === 'calibrated' &&
    ratioTranscriptAvg != null &&
    ratioTranscriptAvg < 0.4 &&
    eitherSubstantive
      ? 'YES (substantive concreteness overrode low ratio — eitherSubstantive gate)'
      : calibrationResult === 'underdisclosure'
        ? 'NO (ratio low and neither moment substantive)'
        : 'N/A';

  let disclosureConclusion: string;
  if (
    calibrationResult === 'calibrated' &&
    ratioTranscriptAvg != null &&
    ratioTranscriptAvg < 0.4 &&
    eitherSubstantive
  ) {
    disclosureConclusion =
      'calibrated — low ratio overridden by substantive personal-moment concreteness (eitherSubstantive gate)';
  } else if (calibrationResult === 'underdisclosure' && ratioTranscriptAvg != null && ratioTranscriptAvg < 0.4) {
    disclosureConclusion =
      'underdisclosure — low ratio and no substantive concreteness on either personal moment';
  } else if (calibrationResult === 'underdisclosure' && ratioTranscriptAvg != null && ratioTranscriptAvg >= 0.4) {
    disclosureConclusion =
      'underdisclosure stored but ratio >= 0.4 — investigate non-ratio path or stale stored value';
  } else if (calibrationResult === 'calibrated') {
    disclosureConclusion = 'calibrated on current transcript word counts and concreteness';
  } else {
    disclosureConclusion = `result is ${calibrationResult}`;
  }

  console.log('');
  console.log(`DIAGNOSTIC RESULTS — attempt ${ATTEMPT_ID.slice(0, 8)}`);
  console.log('=========================================');
  console.log('APPRECIATION POOLING:');
  console.log(`  Pool composition confirmed: [${appreciationPoolSources.join(', ')}]`);
  console.log(`  S1 appreciation contributing: ${s1Contributing ? 'YES' : 'NO'} (S1 score=${s1Appreciation ?? 'null'})`);
  console.log(`  Pool numeric samples: ${appreciationPoolValues.map((x) => `${x.moment}=${x.value}`).join(', ') || '(none)'}`);
  console.log(`  Computed aggregate: ${aggregateAppreciation} | stored: ${storedPillarScores.appreciation} | n=${contributorCount}`);
  console.log(`  Conclusion: ${appreciationConclusion}`);
  console.log('');
  console.log('DISCLOSURE CALIBRATION:');
  console.log(`  M4 words: ${m4Words} | M5 words: ${m5Words} | avg scenario words (transcript): ${avgScenarioWordsTranscript.toFixed(1)}`);
  console.log(
    `  Computed ratio: ${ratioTranscriptAvg != null ? ratioTranscriptAvg.toFixed(2) : 'n/a'} | threshold: 0.4`,
  );
  console.log(`  Result: ${calibrationResult}`);
  console.log(`  Does valid_non_applicable/concreteness label affect this result: ${concretenessAffectsResult}`);
  console.log(`  Conclusion: ${disclosureConclusion}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
