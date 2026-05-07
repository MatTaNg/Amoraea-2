/**
 * Retroactively set interview_attempts.communication_floor_* from stored transcripts.
 * Does not change pass/fail or dismiss fields.
 *
 * Usage (repo root):
 *   npx tsx --env-file=.env scripts/backfill-communication-floor-flags.ts
 */
import { createClient } from '@supabase/supabase-js';
import {
  communicationFloorFieldsFromTranscript,
  type CommunicationFloorTranscriptLine,
} from '../src/features/aria/communicationFloorFromTranscript';

const PAGE = 150;

async function main(): Promise<void> {
  const supabaseUrl =
    process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !serviceKey) {
    console.error('Set SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceKey);
  let from = 0;
  let processed = 0;
  let flagged = 0;
  let updated = 0;

  for (;;) {
    const { data, error } = await admin
      .from('interview_attempts')
      .select('id, transcript')
      .not('completed_at', 'is', null)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);

    if (error) {
      console.error(error.message);
      process.exit(1);
    }
    const rows = data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      processed++;
      const transcript = row.transcript as CommunicationFloorTranscriptLine[] | null | undefined;
      const fields = communicationFloorFieldsFromTranscript(transcript);
      if (fields.communication_floor_flag) flagged++;

      const { error: upErr } = await admin
        .from('interview_attempts')
        .update({
          communication_floor_flag: fields.communication_floor_flag,
          communication_floor_avg_unprompted_words: fields.communication_floor_avg_unprompted_words,
        })
        .eq('id', row.id);
      if (upErr) {
        console.error(`Update failed ${row.id}: ${upErr.message}`);
        process.exit(1);
      }
      updated++;
    }

    from += PAGE;
    if (rows.length < PAGE) break;
  }

  console.log(
    `[communication-floor backfill] Completed attempts processed: ${processed}, rows updated: ${updated}, flagged (avg < threshold): ${flagged}`
  );
}

void main();
