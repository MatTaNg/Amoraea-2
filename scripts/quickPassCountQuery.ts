/** Quick stored DB pass counts — no recompute. Usage: npx tsx --env-file=.env scripts/quickPassCountQuery.ts */
import { createClient } from '@supabase/supabase-js';

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL?.trim() ?? process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ??
    process.env.EXPO_PUBLIC_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    console.error('Missing Supabase env');
    process.exit(1);
  }

  const sb = createClient(url, key);
  const { data, error } = await sb
    .from('interview_attempts')
    .select('passed,final_gate_pass,weighted_score,modified_weighted_score')
    .not('completed_at', 'is', null)
    .or('is_phantom.eq.false,is_phantom.is.null');
  if (error) throw error;

  const rows = data ?? [];
  const score = (r: (typeof rows)[0]) => r.modified_weighted_score ?? r.weighted_score ?? 0;

  console.log('STORED DB PASS COUNTS (no recompute)');
  console.log('====================================');
  console.log('n', rows.length);
  console.log('stored passed', rows.filter((r) => r.passed === true).length);
  console.log('stored final_gate_pass', rows.filter((r) => r.final_gate_pass === true).length);
  console.log('weighted>=6.0', rows.filter((r) => score(r) >= 6.0).length);
  console.log('weighted>=6.5', rows.filter((r) => score(r) >= 6.5).length);
  console.log('modified>=6.0', rows.filter((r) => (r.modified_weighted_score ?? 0) >= 6.0).length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
