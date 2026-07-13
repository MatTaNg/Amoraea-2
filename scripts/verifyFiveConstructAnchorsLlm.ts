/**
 * LLM-verify the five construct anchors against attempt 8d110d29 transcript.
 * Avoids RN graph by building a minimal scenario prompt from shared modules.
 *
 * Usage: npx tsx --env-file=.env scripts/verifyFiveConstructAnchorsLlm.ts
 */
import { createClient } from '@supabase/supabase-js';
import {
  FLOOR_AND_BONUS_SCORING_PHILOSOPHY,
  SCENARIO_MENTALIZING_CONTEMPT_FLOOR_CLARIFICATIONS,
} from '../supabase/functions/_shared/holisticScoringPrompt.ts';
import {
  ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST,
  REPAIR_AND_ACCOUNTABILITY_UNPROMPTED_VS_PROMPTED_WEIGHTING,
  REPAIR_CONDITIONAL_AND_PROMPTED_SCORING,
  SCENARIO_A_APPRECIATION_ANCHORS,
  SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS,
  SCORE_CALIBRATION_0_10,
} from '../supabase/functions/_shared/interviewScoringCalibration.ts';
import {
  BEHAVIORAL_VS_EMOTIONAL_INTERIOR_SCENARIO,
  ELABORATION_ABSENCE_SCENARIO_MARKERS,
  ELABORATION_ABSENCE_SCORING_HEADER,
} from '../src/features/aria/elaborationAbsencePenaltiesRubric.ts';
import { callAnthropicUserPrompt } from './lib/anthropicScriptClient.ts';

const ATTEMPT_ID = '8d110d29-9e67-41fb-a58f-665b561a7b53';

type Turn = { role: string; content: string; scenarioNumber?: number };

function sliceForScenario(transcript: Turn[], n: number): Turn[] {
  const tagged = transcript.filter((m) => m.scenarioNumber === n);
  return tagged.length >= 2 ? tagged : transcript;
}

function buildMinimalScenarioPrompt(scenarioNumber: 1 | 2 | 3, transcript: Turn[]): string {
  const meta = {
    1: {
      name: 'Scenario A (Emma/Ryan)',
      markers: [
        'mentalizing',
        'accountability',
        'contempt_recognition',
        'contempt_expression',
        'repair',
        'attunement',
        'appreciation',
      ],
    },
    2: {
      name: 'Scenario B (Sarah/James)',
      markers: [
        'appreciation',
        'attunement',
        'mentalizing',
        'repair',
        'accountability',
        'contempt_expression',
      ],
    },
    3: {
      name: 'Scenario C (Sophie/Daniel)',
      markers: [
        'regulation',
        'repair',
        'mentalizing',
        'attunement',
        'accountability',
        'contempt_expression',
      ],
    },
  }[scenarioNumber];

  const turns = sliceForScenario(transcript, scenarioNumber)
    .map((m) => `${m.role === 'user' ? 'User' : 'Interviewer'}: ${m.content}`)
    .join('\n\n');

  const scenarioExtras =
    scenarioNumber === 1
      ? SCENARIO_A_APPRECIATION_ANCHORS
      : scenarioNumber === 2
        ? SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS
        : `
SCENARIO C ATTUNEMENT FLOOR:
Score **7** when the user clearly recognized Daniel's emotional state with concrete evidence (even if brief).
SCENARIO C Q1 MENTALIZING: Level 2 deep interior → **7**. Clear pattern/emotional-meaning → **6**.
`;

  const ids = meta.markers;
  return `You are scoring a single scenario from a relationship assessment interview.

SCENARIO: ${meta.name}
MARKERS TO SCORE IN THIS SLICE: ${ids.join(', ')}

${SCORE_CALIBRATION_0_10}
${FLOOR_AND_BONUS_SCORING_PHILOSOPHY}
${SCENARIO_MENTALIZING_CONTEMPT_FLOOR_CLARIFICATIONS}

TRANSCRIPT OF THIS SCENARIO ONLY:
${turns}

SCORING INSTRUCTIONS:
Score only the listed markers, based only on this transcript slice.
${BEHAVIORAL_VS_EMOTIONAL_INTERIOR_SCENARIO}
${ELABORATION_ABSENCE_SCORING_HEADER}
${ELABORATION_ABSENCE_SCENARIO_MARKERS}
${ACCOUNTABILITY_BLAME_SHIFT_VS_CLARITY_REQUEST}
${REPAIR_AND_ACCOUNTABILITY_UNPROMPTED_VS_PROMPTED_WEIGHTING}
${REPAIR_CONDITIONAL_AND_PROMPTED_SCORING}
${scenarioExtras}

Return ONLY valid JSON:
{
  "scenarioNumber": ${scenarioNumber},
  "pillarScores": { ${ids.map((id) => `"${id}": 0`).join(', ')} },
  "keyEvidence": { ${ids.map((id) => `"${id}": ""`).join(', ')} }
}`;
}

function extractJson(raw: string): Record<string, unknown> {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error(`No JSON in model output: ${raw.slice(0, 200)}`);
  let body = raw.slice(start, end + 1);
  // Tolerate trailing commas / smart quotes from model output
  body = body.replace(/,\s*([}\]])/g, '$1').replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
  try {
    return JSON.parse(body) as Record<string, unknown>;
  } catch (e) {
    // Fallback: pull pillarScores object alone if full parse fails
    const m = body.match(/"pillarScores"\s*:\s*(\{[^}]*\})/);
    if (m?.[1]) {
      try {
        return { pillarScores: JSON.parse(m[1].replace(/,\s*([}\]])/g, '$1')) };
      } catch {
        /* fall through */
      }
    }
    console.error('Raw model output (first 800 chars):', raw.slice(0, 800));
    throw e;
  }
}

async function scoreScenario(n: 1 | 2 | 3, transcript: Turn[]) {
  const prompt = buildMinimalScenarioPrompt(n, transcript);
  console.log(`Scoring S${n} (prompt ${prompt.length} chars)...`);
  const raw = await callAnthropicUserPrompt(prompt, { maxTokens: 1200, temperature: 0 });
  const parsed = extractJson(raw);
  const pillars = (parsed.pillarScores ?? {}) as Record<string, number>;
  console.log(`S${n} pillars:`, pillars);
  return pillars;
}

async function main() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase env');

  const sb = createClient(url, key);
  const { data, error } = await sb
    .from('interview_attempts')
    .select('id, transcript, weighted_score, passed')
    .eq('id', ATTEMPT_ID)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error(`Attempt not found: ${ATTEMPT_ID}`);

  const transcript = (Array.isArray(data.transcript) ? data.transcript : []) as Turn[];
  console.log('Reference attempt', ATTEMPT_ID, 'stored weighted', data.weighted_score, 'passed', data.passed);

  const s1 = await scoreScenario(1, transcript);
  const s2 = await scoreScenario(2, transcript);
  const s3 = await scoreScenario(3, transcript);

  const checks: Array<[string, number | undefined, number]> = [
    ['S1 repair', s1.repair, 7],
    ['S1 accountability', s1.accountability, 7],
    ['S1 regulation (if scored)', s1.regulation, 8],
    ['S2 attunement', s2.attunement, 7],
    ['S2 mentalizing', s2.mentalizing, 7],
    ['S2 appreciation', s2.appreciation, 7],
    ['S2 accountability', s2.accountability, 7],
    ['S3 mentalizing', s3.mentalizing, 7],
    ['S3 regulation', s3.regulation, 8],
  ];

  console.log('\n=== Anchor verification ===');
  let failed = 0;
  for (const [label, got, want] of checks) {
    if (got == null && label.includes('if scored')) {
      console.log(`SKIP ${label} (not in S1 marker list — regulation is S3)`);
      continue;
    }
    const ok = got === want;
    console.log(ok ? 'PASS' : 'FAIL', `${label}: got ${got}, want ${want}`);
    if (!ok) failed += 1;
  }
  if (failed) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
