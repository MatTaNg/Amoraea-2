/**
 * Verify scoring-prompt anchors (deterministic) without importing app RN graph.
 * Usage: npx tsx --env-file=.env scripts/verifyScoreAnchorFix8d110d29.ts
 */
import { createClient } from '@supabase/supabase-js';
import {
  FLOOR_AND_BONUS_SCORING_PHILOSOPHY,
  SCENARIO_MENTALIZING_CONTEMPT_FLOOR_CLARIFICATIONS,
} from '../supabase/functions/_shared/holisticScoringPrompt.ts';
import { SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS } from '../supabase/functions/_shared/interviewScoringCalibration.ts';
import { BEHAVIORAL_VS_EMOTIONAL_INTERIOR_SCENARIO } from '../src/features/aria/elaborationAbsencePenaltiesRubric.ts';

const ATTEMPT_ID = '8d110d29-9e67-41fb-a58f-665b561a7b53';

async function main() {
  const checks: Array<[string, boolean]> = [
    ['has CANONICAL SCORE ANCHORS', FLOOR_AND_BONUS_SCORING_PHILOSOPHY.includes('CANONICAL SCORE ANCHORS')],
    ['no BONUS PRINCIPLE', !FLOOR_AND_BONUS_SCORING_PHILOSOPHY.includes('BONUS PRINCIPLE')],
    [
      'no complete-answer=5-6 deflation',
      !/complete answer deserving a score of 5/.test(FLOOR_AND_BONUS_SCORING_PHILOSOPHY),
    ],
    [
      'follow-through example is a 7',
      FLOOR_AND_BONUS_SCORING_PHILOSOPHY.includes('actually follow through') &&
        FLOOR_AND_BONUS_SCORING_PHILOSOPHY.includes('is a **7**, not a 5'),
    ],
    [
      'sustained calm regulation is 8',
      FLOOR_AND_BONUS_SCORING_PHILOSOPHY.includes(
        'Consistently calm, analytical tone maintained across the full interview',
      ),
    ],
    [
      'repair 7 does not require emotional acknowledgment',
      FLOOR_AND_BONUS_SCORING_PHILOSOPHY.includes(
        'Does **not** require emotional acknowledgment or a detailed plan',
      ),
    ],
    [
      'accountability 7 is ownership + forward commitment',
      FLOOR_AND_BONUS_SCORING_PHILOSOPHY.includes(
        'Explicit first-person ownership of the failure or gap in behavior',
      ),
    ],
    [
      'attunement 6 is specific unmet need',
      FLOOR_AND_BONUS_SCORING_PHILOSOPHY.includes('they needed X') &&
        SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS.includes('Attunement score anchors'),
    ],
    [
      'S2 appreciation 7 anchors',
      SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS.includes('Appreciation score anchors') &&
        SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS.includes('**7:**') &&
        SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS.includes(
          'just been happy for her and appreciated her efforts',
        ),
    ],
    [
      'Level 1 mentalizing/attunement band is 3-5',
      BEHAVIORAL_VS_EMOTIONAL_INTERIOR_SCENARIO.includes(
        'Level 1 — Behavioral observation (mentalizing & attunement scores 3–5)',
      ),
    ],
    [
      'Level 2 mentalizing/attunement band is 6-7',
      BEHAVIORAL_VS_EMOTIONAL_INTERIOR_SCENARIO.includes(
        'Level 2 — Emotional-interior / meaning inference (mentalizing & attunement scores 6–7 typical',
      ) && BEHAVIORAL_VS_EMOTIONAL_INTERIOR_SCENARIO.includes('**never 3–5**'),
    ],
    [
      'canonical mentalizing 7 S2 / attunement 6 anchors',
      BEHAVIORAL_VS_EMOTIONAL_INTERIOR_SCENARIO.includes('**Mentalizing 7 (S2):**') &&
        BEHAVIORAL_VS_EMOTIONAL_INTERIOR_SCENARIO.includes('**Attunement 6:**') &&
        BEHAVIORAL_VS_EMOTIONAL_INTERIOR_SCENARIO.includes('**Mentalizing 7:**'),
    ],
    [
      'scenario mentalizing floor uses Level 2 = 5-7 not Score 7+ only',
      SCENARIO_MENTALIZING_CONTEMPT_FLOOR_CLARIFICATIONS.includes('typically **6**') &&
        !SCENARIO_MENTALIZING_CONTEMPT_FLOOR_CLARIFICATIONS.includes(
          'Score **7** when the user infers emotional interior states — what the character is feeling',
        ),
    ],
  ];

  for (const [label, ok] of checks) {
    console.log(ok ? 'PASS' : 'FAIL', label);
    if (!ok) process.exitCode = 1;
  }

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log('Skipping attempt fetch (no Supabase env).');
    return;
  }

  const sb = createClient(url, key);
  const { data, error } = await sb
    .from('interview_attempts')
    .select(
      'id, user_id, weighted_score, passed, scenario_composites, scenario_1_scores, scenario_2_scores, scenario_3_scores',
    )
    .eq('id', ATTEMPT_ID)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    console.log('Attempt not found:', ATTEMPT_ID);
    return;
  }

  console.log('');
  console.log('Reference attempt', ATTEMPT_ID);
  console.log('user_id', data.user_id);
  console.log('stored weighted_score', data.weighted_score, 'passed', data.passed);
  console.log('stored scenario_composites', data.scenario_composites);
  const s1 = (data.scenario_1_scores as any)?.pillarScores ?? {};
  const s2 = (data.scenario_2_scores as any)?.pillarScores ?? {};
  const s3 = (data.scenario_3_scores as any)?.pillarScores ?? {};
  console.log('stored S1 repair', s1.repair, 'accountability', s1.accountability, 'regulation', s1.regulation);
  console.log('stored S2 attunement', s2.attunement, 'appreciation', s2.appreciation, 'accountability', s2.accountability);
  console.log('stored S3 mentalizing', s3.mentalizing, 'regulation', s3.regulation);
  console.log(
    'targets: S1 repair=7 accountability=7 regulation=8; S2 attunement=6 appreciation=7 accountability=7; S3 mentalizing=7; weighted≥6.5 pass=true',
  );
  console.log('');
  console.log('To LLM-rescore this user (no commit):');
  console.log(`  npm run rescore-users -- --mode llm ${data.user_id}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
