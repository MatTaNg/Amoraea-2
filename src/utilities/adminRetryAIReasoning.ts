/**
 * Admin console: regenerate narrative AI reasoning for an interview_attempts row (service scores already stored).
 */
import { supabase } from '@data/supabase/client';

const ADMIN_AI_REASONING_EDGE_TIMEOUT_MS = 150_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      // #region agent log
      fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7605c3'},body:JSON.stringify({sessionId:'7605c3',runId:'admin-retry-pending-v1',hypothesisId:'H1_client_timeout_not_observed',location:'src/utilities/adminRetryAIReasoning.ts:withTimeout',message:'admin_retry_client_timeout_fired',data:{timeoutMs},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      reject(new Error(`Admin AI reasoning retry timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export async function adminRetryAIReasoningForAttempt(attemptId: string): Promise<{ ok: true } | { error: string }> {
  const startedAt = Date.now();
  try {
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7605c3'},body:JSON.stringify({sessionId:'7605c3',runId:'admin-retry-pending-v1',hypothesisId:'H1_client_timeout_not_observed,H4_request_blocked_before_handler',location:'src/utilities/adminRetryAIReasoning.ts:adminRetryAIReasoningForAttempt',message:'admin_retry_invoke_start',data:{attemptIdPresent:Boolean(attemptId),timeoutMs:ADMIN_AI_REASONING_EDGE_TIMEOUT_MS},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const { data, error } = await withTimeout(
      supabase.functions.invoke('admin-retry-ai-reasoning', { body: { attemptId } }),
      ADMIN_AI_REASONING_EDGE_TIMEOUT_MS
    );
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7605c3'},body:JSON.stringify({sessionId:'7605c3',runId:'admin-retry-pending-v1',hypothesisId:'H1_client_timeout_not_observed,H2_edge_generation_hang,H5_db_update_hang',location:'src/utilities/adminRetryAIReasoning.ts:adminRetryAIReasoningForAttempt',message:'admin_retry_invoke_resolved',data:{elapsedMs:Date.now()-startedAt,hasError:Boolean(error),hasData:Boolean(data),payloadKeys:data && typeof data==='object'?Object.keys(data as Record<string,unknown>):null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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
    // #region agent log
    fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'7605c3'},body:JSON.stringify({sessionId:'7605c3',runId:'admin-retry-pending-v1',hypothesisId:'H1_client_timeout_not_observed,H4_request_blocked_before_handler',location:'src/utilities/adminRetryAIReasoning.ts:adminRetryAIReasoningForAttempt',message:'admin_retry_invoke_caught',data:{elapsedMs:Date.now()-startedAt,error:raw.slice(0,300),isTimeout:/timeout/i.test(raw)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (/timeout/i.test(raw)) {
      return { error: `${raw}. The browser stopped waiting; refresh the attempt in a moment to see whether the server finished or wrote an error.` };
    }
    return { error: raw };
  }
}
