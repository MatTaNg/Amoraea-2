/**
 * Flags passed interview_attempts that would fail under mentalizing/repair dual-scenario floors (< 4 in 2+ scenarios).
 * Independent of scenario_floor_grandfather_review. Does not change `passed`.
 *
 * Usage: npm run flag-mentalizing-repair-floor-grandfather
 */
import { createClient } from '@supabase/supabase-js';
import { mentalizingRepairFloorTriggered } from '../src/features/aria/mentalizingRepairScenarioFloor';

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
  let mentalizingOnly = 0;
  let repairOnly = 0;
  let both = 0;

  for (;;) {
    const { data: rows, error } = await admin
      .from('interview_attempts')
      .select('id, scenario_1_scores, scenario_2_scores, scenario_3_scores, gate_fail_detail')
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
      gate_fail_detail?: unknown;
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

      const mr = mentalizingRepairFloorTriggered(scenarioPillarScoresByScenario);
      if (!mr.mentalizingFloorFails && !mr.repairFloorFails) continue;

      if (mr.mentalizingFloorFails && mr.repairFloorFails) both++;
      else if (mr.mentalizingFloorFails) mentalizingOnly++;
      else repairOnly++;

      flagged++;
      const existingDetail =
        row.gate_fail_detail != null && typeof row.gate_fail_detail === 'object' && !Array.isArray(row.gate_fail_detail)
          ? (row.gate_fail_detail as Record<string, unknown>)
          : {};

      const gate_fail_detail = {
        ...existingDetail,
        ...(mr.mentalizingFloorFails ? { mentalizing_floor: { lowScenarios: mr.mentalizingLowScenarios } } : {}),
        ...(mr.repairFloorFails ? { repair_floor: { lowScenarios: mr.repairLowScenarios } } : {}),
      };

      const { error: upErr } = await admin
        .from('interview_attempts')
        .update({
          mentalizing_repair_floor_grandfather_review: true,
          gate_fail_detail,
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
    `[mentalizing-repair-floor-grandfather] Done. Scanned ${scanned} completed passed attempts; flagged ${flagged}. Breakdown — mentalizing_floor only: ${mentalizingOnly}, repair_floor only: ${repairOnly}, both: ${both}.`,
  );
}

void main();
