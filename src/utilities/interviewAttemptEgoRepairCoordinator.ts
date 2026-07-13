import Constants from 'expo-constants';
import { supabase } from '@data/supabase/client';
import { remoteLog } from '@utilities/remoteLog';
import { repairInterviewAttemptEgoFromTranscript } from '@utilities/repairInterviewAttemptEgoFromTranscript';

/** Always use proxy when set — direct api.anthropic.com fails on native (CORS). Mirrors AriaScreen env resolution. */
function getPublicEnv(varName: string, extraKey?: string): string {
  const fromProcess =
    typeof process !== 'undefined' && process.env ? (process.env[varName] as string | undefined) : undefined;
  const expoConfigExtra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const legacyManifestExtra =
    (Constants as unknown as { manifest?: { extra?: Record<string, unknown> } }).manifest?.extra;
  const manifest2Extra =
    (
      Constants as unknown as {
        manifest2?: { extra?: { expoClient?: { extra?: Record<string, unknown> } } };
      }
    ).manifest2?.extra?.expoClient?.extra;
  const easConfig = (Constants as unknown as { easConfig?: Record<string, unknown> }).easConfig;
  const key = extraKey ?? '';
  const fromConfig =
    (typeof key === 'string' && key ? (expoConfigExtra?.[key] as string | undefined) : undefined) ??
    (expoConfigExtra?.[varName] as string | undefined) ??
    (typeof key === 'string' && key ? (legacyManifestExtra?.[key] as string | undefined) : undefined) ??
    (legacyManifestExtra?.[varName] as string | undefined) ??
    (typeof key === 'string' && key ? (manifest2Extra?.[key] as string | undefined) : undefined) ??
    (manifest2Extra?.[varName] as string | undefined) ??
    (typeof key === 'string' && key ? (easConfig?.[key] as string | undefined) : undefined) ??
    (easConfig?.[varName] as string | undefined);
  return (fromProcess || fromConfig || '').trim();
}

function getResolvedSupabaseUrl(): string {
  const configured = getPublicEnv('EXPO_PUBLIC_SUPABASE_URL', 'supabaseUrl');
  if (configured) return configured;
  const maybeSupabase = supabase as unknown as { supabaseUrl?: string; rest?: { url?: string } };
  if (typeof maybeSupabase.supabaseUrl === 'string' && maybeSupabase.supabaseUrl.trim()) {
    return maybeSupabase.supabaseUrl.trim();
  }
  const restUrl = maybeSupabase.rest?.url;
  if (typeof restUrl === 'string' && restUrl.trim()) {
    return restUrl.replace(/\/rest\/v1\/?$/, '').trim();
  }
  return '';
}

function getResolvedAnthropicProxyUrl(): string {
  const configured = getPublicEnv('EXPO_PUBLIC_ANTHROPIC_PROXY_URL', 'anthropicProxyUrl');
  if (configured) return configured;
  const supabaseUrl = getResolvedSupabaseUrl().replace(/\/+$/, '');
  return supabaseUrl ? `${supabaseUrl}/functions/v1/anthropic-proxy` : '';
}

function getResolvedSupabaseAnonKey(): string {
  const configured = getPublicEnv('EXPO_PUBLIC_SUPABASE_ANON_KEY', 'supabaseAnonKey');
  if (configured) return configured;
  const maybeSupabase = supabase as unknown as {
    supabaseKey?: string;
    rest?: { headers?: Record<string, string> };
  };
  const fromClientKey = typeof maybeSupabase.supabaseKey === 'string' ? maybeSupabase.supabaseKey.trim() : '';
  if (fromClientKey) return fromClientKey;
  const fromRestHeader =
    (maybeSupabase.rest?.headers?.apikey ?? maybeSupabase.rest?.headers?.Authorization ?? '')
      .replace(/^Bearer\s+/i, '')
      .trim();
  return fromRestHeader;
}

function getAnthropicEndpoint(): string {
  const proxyUrl = getResolvedAnthropicProxyUrl();
  if (!proxyUrl && __DEV__) {
    console.warn('Anthropic proxy URL is not set; direct API may fail on native.');
  }
  return proxyUrl || 'https://api.anthropic.com/v1/messages';
}

const ANTHROPIC_API_KEY = getPublicEnv('EXPO_PUBLIC_ANTHROPIC_API_KEY', 'anthropicApiKey');
const ANTHROPIC_PROXY_URL = getResolvedAnthropicProxyUrl();
const SUPABASE_ANON_KEY = getResolvedSupabaseAnonKey();

type TranscriptMsg = { role: string; content?: string; scenarioNumber?: number | null };

/** Dedupe transcript-based ego repair across Amoraea + post-interview screens (same session). */
export const egoRepairHandledAttemptIds = new Set<string>();

/**
 * If `users.latest_attempt_id` points at a completed attempt with missing ego, re-run holistic from transcript once.
 * Safe to call from any mounted screen; uses module-level dedupe by attempt id.
 */
export async function runInterviewAttemptEgoRepairFromLatestAttempt(opts: {
  userId: string;
  isAdmin: boolean;
  typologyContext?: string;
  /** For debug_logs breadcrumb only. */
  sourceScreen: string;
  signal?: AbortSignal;
}): Promise<void> {
  const { userId, isAdmin, typologyContext = '', sourceScreen, signal } = opts;
  if (!userId || isAdmin) return;
  if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) return;
  if (signal?.aborted) return;

  const { data: urow } = await supabase
    .from('users')
    .select('latest_attempt_id')
    .eq('id', userId)
    .maybeSingle();
  if (signal?.aborted || !urow) return;
  const aid = urow.latest_attempt_id as string | null | undefined;
  if (typeof aid !== 'string' || aid.length === 0) return;
  if (egoRepairHandledAttemptIds.has(aid)) return;

  const { data: att, error: attErr } = await supabase
    .from('interview_attempts')
    .select('id, user_id, ego_development_level, completed_at, transcript, scoring_deferred')
    .eq('id', aid)
    .eq('user_id', userId)
    .maybeSingle();
  if (signal?.aborted || attErr || !att) return;
  if (att.ego_development_level != null) return;
  if (!att.completed_at) return;
  if (att.scoring_deferred === true) return;

  let tx = att.transcript as TranscriptMsg[] | string | null | undefined;
  if (typeof tx === 'string') {
    try {
      tx = JSON.parse(tx) as TranscriptMsg[];
    } catch {
      tx = null;
    }
  }
  if (!Array.isArray(tx) || tx.length < 10) return;

  void remoteLog('[EGO_REPAIR] invoking', {
    attemptId: aid,
    transcriptTurns: tx.length,
    sourceScreen,
  });
  egoRepairHandledAttemptIds.add(aid);

  const apiUrl = getAnthropicEndpoint();
  const useProxy = apiUrl !== '' && apiUrl !== 'https://api.anthropic.com/v1/messages';
  const hdrs: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useProxy && SUPABASE_ANON_KEY) {
    hdrs.Authorization = `Bearer ${SUPABASE_ANON_KEY}`;
  } else if (!useProxy && ANTHROPIC_API_KEY) {
    hdrs['x-api-key'] = ANTHROPIC_API_KEY;
    hdrs['anthropic-version'] = '2023-06-01';
  }
  const ctx = typologyContext || 'No typology context — score from transcript only.';
  const out = await repairInterviewAttemptEgoFromTranscript({
    supabase,
    attemptId: aid,
    userId,
    transcript: tx,
    typologyContext: ctx,
    apiUrl,
    headers: hdrs,
  });
  if (!out.ok) {
    egoRepairHandledAttemptIds.delete(aid);
  }
}
