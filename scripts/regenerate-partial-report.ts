/**
 * Regenerate and persist partial report for a user (latest completed attempt).
 * Usage: npx tsx --env-file=.env scripts/regenerate-partial-report.ts <userId>
 */
import { createClient } from '@supabase/supabase-js';
import {
  buildPartialReportPrompt,
  buildPartialSystemPrompt,
} from '../src/features/psychometrics/partialReportPrompt';
import { computePartialReportSourceHash } from '../src/features/psychometrics/persistedInterviewReportLogic';
import { fetchPartialReportDataForUser } from '../src/features/psychometrics/partialReportData';
import { REPORT_NARRATIVE_TOKEN_BUDGETS } from '../src/utilities/reportNarrativeGeneration';
import {
  getAnthropicEndpointForScript,
  getAnthropicHeadersForScript,
} from './lib/anthropicScriptClient';

const CLAUDE_SONNET_MODEL = 'claude-sonnet-4-6';

const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: npx tsx --env-file=.env scripts/regenerate-partial-report.ts <userId>');
  process.exit(1);
}

const supabase = createClient(url, key);

async function callAnthropic(system: string, userPrompt: string): Promise<string> {
  const res = await fetch(getAnthropicEndpointForScript(), {
    method: 'POST',
    headers: getAnthropicHeadersForScript(),
    body: JSON.stringify({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: REPORT_NARRATIVE_TOKEN_BUDGETS.personal_partial_report.initial,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { content?: Array<{ text?: string }> };
  const text = json.content?.[0]?.text?.trim();
  if (!text) throw new Error('Empty Anthropic response');
  return text;
}

async function main(): Promise<void> {
  const { data, attemptId } = await fetchPartialReportDataForUser(supabase, userId);
  if (!attemptId) throw new Error('No completed attempt for user');

  const markdown = await callAnthropic(buildPartialSystemPrompt(), buildPartialReportPrompt(data));
  const hash = computePartialReportSourceHash(data);
  const { error } = await supabase
    .from('interview_attempts')
    .update({
      partial_report_markdown: markdown,
      partial_report_source_hash: hash,
      partial_report_generated_at: new Date().toISOString(),
    })
    .eq('id', attemptId)
    .eq('user_id', userId);
  if (error) throw error;
  console.log('attempt_id:', attemptId);
  console.log('---PARTIAL_REPORT_START---');
  console.log(markdown);
  console.log('---PARTIAL_REPORT_END---');
  const liveBehaviorHits = [
    /when it shows up in a real relationship/i,
    /in a real relationship/i,
    /under live conflict/i,
    /in the heat of the moment/i,
  ].filter((re) => re.test(markdown));
  console.log('live-behavior phrase hits:', liveBehaviorHits.length ? liveBehaviorHits.map(String) : 'none');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
