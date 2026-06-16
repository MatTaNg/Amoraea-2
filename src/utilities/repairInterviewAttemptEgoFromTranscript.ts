import type { SupabaseClient } from '@supabase/supabase-js';
import { extractEgoDevelopmentLevel } from '@features/aria/aggregateMarkerScoresFromSlices';
import { buildScoringPrompt } from '@features/aria/holisticScoringPrompt';
import { parseHolisticInterviewModelObjectFromModelText } from '@utilities/parseHolisticModelJson';
import { remoteLog } from '@utilities/remoteLog';
import { CLAUDE_SONNET_MODEL } from '@utilities/anthropicMessagesClient';

type TranscriptMsg = { role: string; content?: string; scenarioNumber?: number | null };

const HOLISTIC_FETCH_TIMEOUT_MS = 180_000;

/**
 * Re-runs holistic scoring from a stored transcript and patches `ego_development_level` only.
 * Used when an attempt row completed but ego was never persisted (e.g. interrupted tail, RLS mismatch).
 */
export async function repairInterviewAttemptEgoFromTranscript(opts: {
  supabase: SupabaseClient;
  attemptId: string;
  userId: string;
  transcript: TranscriptMsg[];
  typologyContext: string;
  apiUrl: string;
  headers: Record<string, string>;
}): Promise<{ ok: boolean; ego: number | null; skipped?: string; error?: string }> {
  const { supabase, attemptId, userId, transcript, typologyContext, apiUrl, headers } = opts;
  if (!apiUrl || transcript.length < 8) {
    return { ok: false, ego: null, skipped: 'missing_api_or_short_transcript' };
  }
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), HOLISTIC_FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(apiUrl, {
      method: 'POST',
      headers,
      signal: abort.signal,
      body: JSON.stringify({
        model: CLAUDE_SONNET_MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: buildScoringPrompt(transcript, typologyContext) }],
      }),
    });
  } finally {
    clearTimeout(timer);
  }
  const data = (await res.json()) as { content?: Array<{ text?: string }>; error?: { message?: string } };
  if (!res.ok) {
    const msg = data?.error?.message ?? `HTTP ${res.status}`;
    void remoteLog('[EGO_REPAIR] holistic_fetch_failed', { attemptId, message: msg });
    return { ok: false, ego: null, error: msg };
  }
  const raw = (data.content?.[0]?.text ?? '{}') as string;
  const coerced = parseHolisticInterviewModelObjectFromModelText(raw);
  const ego = extractEgoDevelopmentLevel(coerced);
  if (ego == null) {
    void remoteLog('[EGO_REPAIR] holistic_no_ego', { attemptId, rawLen: raw.length });
    return { ok: false, ego: null, skipped: 'no_ego_in_model_output' };
  }
  const { error } = await supabase
    .from('interview_attempts')
    .update({ ego_development_level: ego })
    .eq('id', attemptId)
    .eq('user_id', userId);
  if (error) {
    void remoteLog('[EGO_REPAIR] update_failed', { attemptId, message: error.message });
    return { ok: false, ego: null, error: error.message };
  }
  void remoteLog('[EGO_REPAIR] ok', { attemptId, ego });
  return { ok: true, ego };
}
