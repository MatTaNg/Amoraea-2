/**
 * Flags passed interview_attempts that would fail under the per-scenario composite floor (≥ 4.5).
 * Does not change `passed`. Sets `scenario_floor_grandfather_review` and updates `scenario_composites` snapshot.
 *
 * Usage: npm run flag-scenario-floor-grandfather
 */
import { createClient } from '@supabase/supabase-js';
import {
  buildScenarioCompositesTriple,
  scenarioCompositesToStorageJson,
  scenarioFloorBreaches,
} from '../src/features/aria/scenarioCompositeFloor';

function pillarScoresFromScenarioCell(raw: unknown): Record<string, number | null | undefined> | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const ps = (raw as { pillarScores?: unknown }).pillarScores;
  if (!ps || typeof ps !== 'object' || Array.isArray(ps)) return undefined;
  return ps as Record<string, number | null | undefined>;
}

async function main(): Promise<void> {
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    console.error('Set SUPABASE_URL (or EXPO_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  const pageSize = 500;
  let offset = 0;
  let flagged = 0;
  let scanned = 0;

  for (;;) {
    const { data: rows, error } = await admin
      .from('interview_attempts')
      .select(
        'id, scenario_1_scores, scenario_2_scores, scenario_3_scores, scenario_floor_grandfather_review'
      )
      .eq('passed', true)
      .not('completed_at', 'is', null)
      .order('created_at', { ascending: true })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('Query failed:', error.message);
      process.exit(1);
    }
    const batch = rows ?? [];
    if (batch.length === 0) break;

    for (const row of batch as Array<{
      id: string;
      scenario_1_scores?: unknown;
      scenario_2_scores?: unknown;
      scenario_3_scores?: unknown;
      scenario_floor_grandfather_review?: boolean | null;
    }>) {
      scanned++;
      const scenarioPillarScoresByScenario: Partial<
        Record<1 | 2 | 3, Record<string, number | null | undefined>>
      > = {};
      const p1 = pillarScoresFromScenarioCell(row.scenario_1_scores);
      const p2 = pillarScoresFromScenarioCell(row.scenario_2_scores);
      const p3 = pillarScoresFromScenarioCell(row.scenario_3_scores);
      if (p1) scenarioPillarScoresByScenario[1] = p1;
      if (p2) scenarioPillarScoresByScenario[2] = p2;
      if (p3) scenarioPillarScoresByScenario[3] = p3;

      const composites = buildScenarioCompositesTriple(scenarioPillarScoresByScenario);
      const noScenarioData =
        composites['1'] == null && composites['2'] == null && composites['3'] == null;
      if (noScenarioData) continue;

      if (scenarioFloorBreaches(composites).length === 0) continue;

      flagged++;
      const { error: upErr } = await admin
        .from('interview_attempts')
        .update({
          scenario_floor_grandfather_review: true,
          scenario_composites: scenarioCompositesToStorageJson(composites),
        })
        .eq('id', row.id);
      if (upErr) {
        console.error(`Update failed id=${row.id}:`, upErr.message);
        process.exit(1);
      }
    }

    offset += pageSize;
    if (batch.length < pageSize) break;
  }

  console.log(
    `[scenario-floor-grandfather] Done. Scanned ${scanned} completed passed attempts; flagged ${flagged} for review.`,
  );
}

void main();
