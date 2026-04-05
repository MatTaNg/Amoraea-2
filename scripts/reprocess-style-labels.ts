/**
 * Recompute style_labels_* and matchmaker_summary from feature columns using translateStyleProfile.
 * Run after migrations that change relational_individual_score semantics.
 *
 * Usage (repo root, Deno):
 *   deno run --allow-net --allow-env --allow-read scripts/reprocess-style-labels.ts
 *
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import {
  styleProfileFromDbRow,
  translateStyleProfile,
} from '../supabase/functions/_shared/styleTranslations.ts';

const url = Deno.env.get('SUPABASE_URL')?.trim();
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  Deno.exit(1);
}

const admin = createClient(url, key);

const { data: rows, error: selErr } = await admin.from('communication_style_profiles').select('*');
if (selErr) {
  console.error(selErr.message);
  Deno.exit(1);
}

let ok = 0;
let fail = 0;
for (const row of rows ?? []) {
  const r = row as Record<string, unknown>;
  const t = translateStyleProfile(styleProfileFromDbRow(r));
  const { error: upErr } = await admin
    .from('communication_style_profiles')
    .update({
      style_labels_primary: t.primary,
      style_labels_secondary: t.secondary,
      matchmaker_summary: t.matchmaker_summary,
      low_confidence_note: t.low_confidence_note,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', r.user_id as string);
  if (upErr) {
    console.error('update failed', r.user_id, upErr.message);
    fail++;
  } else {
    ok++;
  }
}

console.log(`reprocess-style-labels: ${ok} ok, ${fail} failed, ${rows?.length ?? 0} total`);
