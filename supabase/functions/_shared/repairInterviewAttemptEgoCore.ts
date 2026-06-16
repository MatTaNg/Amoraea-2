/**
 * Holistic ego re-score for completed attempts missing `ego_development_level`.
 * Keep aligned with `src/utilities/repairInterviewAttemptEgoFromTranscript.ts`.
 */
import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { coerceHolisticInterviewModelObject } from './coerceHolisticInterviewModelObject.ts';
import { buildScoringPrompt } from './holisticScoringPrompt.ts';
import { CLAUDE_SONNET_MODEL } from './anthropicModel.ts';

const HOLISTIC_FETCH_TIMEOUT_MS = 180_000;

function getAnthropicEndpoint(): string {
  const proxy = Deno.env.get('ANTHROPIC_PROXY_URL') ?? '';
  return proxy && proxy.length > 0 ? proxy : 'https://api.anthropic.com/v1/messages';
}

function extractEgoFromHolisticParsed(parsed: Record<string, unknown>): number | null {
  const raw = parsed.ego_development_level ?? parsed.egoDevelopmentLevel;
  if (raw === null || raw === undefined) return null;
  const n =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string' && String(raw).trim() !== ''
        ? Number(String(raw).trim())
        : NaN;
  if (!Number.isFinite(n)) return null;
  const r = Math.round(n);
  if (r < 1 || r > 5) return null;
  return r;
}

function parseHolisticTextFromModel(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  try {
    return coerceHolisticInterviewModelObject(JSON.parse(candidate));
  } catch {
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return coerceHolisticInterviewModelObject(JSON.parse(candidate.slice(start, end + 1)));
      } catch {
        return { pillarScores: {} };
      }
    }
    return { pillarScores: {} };
  }
}

export async function repairInterviewAttemptEgoCore(opts: {
  supabase: SupabaseClient;
  attemptId: string;
  userId: string;
  transcript: Array<{ role: string; content?: string; scenarioNumber?: number | null; interviewMoment?: number }>;
  typologyContext: string;
}): Promise<{ ok: boolean; ego: number | null; skipped?: string; error?: string }> {
  const { supabase, attemptId, userId, transcript, typologyContext } = opts;
  if (transcript.length < 8) {
    return { ok: false, ego: null, skipped: 'short_transcript' };
  }

  const apiUrl = getAnthropicEndpoint();
  const useProxy = apiUrl !== 'https://api.anthropic.com/v1/messages';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useProxy) {
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    if (!anon) return { ok: false, ego: null, error: 'missing_supabase_anon_for_proxy' };
    headers['Authorization'] = `Bearer ${anon}`;
  } else {
    const key = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
    if (!key.trim()) return { ok: false, ego: null, error: 'missing_anthropic_api_key' };
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
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

  let data: { content?: Array<{ text?: string }>; error?: { message?: string } };
  try {
    data = await res.json();
  } catch {
    return { ok: false, ego: null, error: `holistic_non_json: HTTP ${res.status}` };
  }
  if (!res.ok) {
    const msg = data?.error?.message ?? `HTTP ${res.status}`;
    return { ok: false, ego: null, error: msg };
  }

  const raw = data.content?.[0]?.text ?? '{}';
  const coerced = parseHolisticTextFromModel(raw);
  const ego = extractEgoFromHolisticParsed(coerced);
  if (ego == null) {
    console.warn('[EGO_REPAIR] no ego in holistic output', { attemptId, rawLen: raw.length });
    return { ok: false, ego: null, skipped: 'no_ego_in_model_output' };
  }

  const { error } = await supabase
    .from('interview_attempts')
    .update({ ego_development_level: ego })
    .eq('id', attemptId)
    .eq('user_id', userId);
  if (error) {
    return { ok: false, ego: null, error: error.message };
  }
  console.log('[EGO_REPAIR] ok', { attemptId, ego });
  return { ok: true, ego };
}
