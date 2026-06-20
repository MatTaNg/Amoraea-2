/**
 * One-off: print stored partial_report_markdown for an attempt id.
 * Usage: npx tsx --env-file=.env scripts/fetch-partial-report.ts <attemptId>
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

function loadEnv(): void {
  const envPath = join(process.cwd(), '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i <= 0) continue;
    const k = t.slice(0, i).trim();
    const v = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[k]) process.env[k] = v;
  }
}

loadEnv();

const attemptId = process.argv[2];
if (!attemptId) {
  console.error('Usage: npx tsx --env-file=.env scripts/fetch-partial-report.ts <attemptId>');
  process.exit(1);
}

const url = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main(): Promise<void> {
  const { data, error } = await supabase
    .from('interview_attempts')
    .select('partial_report_markdown, user_id, partial_report_generated_at')
    .eq('id', attemptId)
    .maybeSingle();
  if (error) throw error;
  console.log('user_id:', data?.user_id ?? 'null');
  console.log('generated_at:', data?.partial_report_generated_at ?? 'null');
  const md = data?.partial_report_markdown;
  if (typeof md === 'string' && md.trim().length > 0) {
    console.log('---PARTIAL_REPORT_START---');
    console.log(md);
    console.log('---PARTIAL_REPORT_END---');
  } else {
    console.log('NO_PARTIAL_REPORT_STORED');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
