/**
 * Admin console: regenerate narrative AI reasoning for an interview_attempts row (service scores already stored).
 */
import { supabase } from '@data/supabase/client';

const ADMIN_AI_REASONING_EDGE_TIMEOUT_MS = 150_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Admin AI reasoning retry timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function adminRetryAIReasoningForAttempt(attemptId: string): Promise<{ ok: true } | { error: string }> {
  try {
    const { data, error } = await withTimeout(
      supabase.functions.invoke('admin-retry-ai-reasoning', { body: { attemptId } }),
      ADMIN_AI_REASONING_EDGE_TIMEOUT_MS
    );
    if (error) {
      return {
        error: `${error.message} — The dashboard now retries through the admin Edge Function instead of calling anthropic-proxy directly. Make sure admin-retry-ai-reasoning is deployed and has SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY, and ANTHROPIC_API_KEY secrets set.`,
      };
    }
    const payload = data as { ok?: boolean; error?: string } | null;
    if (payload?.error) {
      return { error: payload.error };
    }
    return { ok: true };
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    if (/timeout/i.test(raw)) {
      return { error: `${raw}. The browser stopped waiting; refresh the attempt in a moment to see whether the server finished or wrote an error.` };
    }
    return { error: raw };
  }
}
