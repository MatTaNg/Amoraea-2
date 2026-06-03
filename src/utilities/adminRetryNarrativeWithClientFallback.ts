/**
 * Admin narrative retry: prefer `admin-retry-ai-reasoning` edge (background), fall back to in-browser generation
 * when the edge function is unreachable or the background job does not finish.
 */
import { supabase } from '@data/supabase/client';
import { adminRetryAIReasoningForAttempt } from '@utilities/adminRetryAIReasoning';
import {
  interviewAiReasoningIsSubstantive,
  kickClientInterviewNarrativeIfPending,
} from '@utilities/kickClientInterviewNarrativeIfPending';

const EDGE_NARRATIVE_POLL_INTERVAL_MS = 10_000;
const EDGE_NARRATIVE_POLL_MAX_MS = 180_000;

export type AdminNarrativeRetryResult =
  | { ok: true; via: 'edge' | 'client' }
  | { error: string; via: 'edge' | 'client' | 'edge_then_client' };

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchAttemptNarrativeState(
  attemptId: string
): Promise<{ substantive: boolean; reasoning_pending: boolean }> {
  const { data: row } = await supabase
    .from('interview_attempts')
    .select('ai_reasoning, reasoning_pending')
    .eq('id', attemptId)
    .maybeSingle();
  const ar = (row?.ai_reasoning ?? null) as Record<string, unknown> | null;
  return {
    substantive: interviewAiReasoningIsSubstantive(ar),
    reasoning_pending: row?.reasoning_pending === true,
  };
}

/** Wait for edge `waitUntil` narrative job; run client generation if it never completes. */
async function waitForEdgeNarrativeOrClientFallback(
  attemptId: string,
  ownerUserId: string
): Promise<AdminNarrativeRetryResult> {
  const deadline = Date.now() + EDGE_NARRATIVE_POLL_MAX_MS;
  while (Date.now() < deadline) {
    await delay(EDGE_NARRATIVE_POLL_INTERVAL_MS);
    const state = await fetchAttemptNarrativeState(attemptId);
    if (state.substantive) {
      if (state.reasoning_pending) {
        await supabase
          .from('interview_attempts')
          .update({ reasoning_pending: false })
          .eq('id', attemptId);
      }
      return { ok: true, via: 'edge' };
    }
  }
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '4b3376' },
    body: JSON.stringify({
      sessionId: '4b3376',
      hypothesisId: 'H_admin_auto_retry',
      location: 'adminRetryNarrativeWithClientFallback.ts',
      message: 'admin_auto_retry_edge_poll_timeout_client_fallback',
      data: { attemptId, waitedMs: EDGE_NARRATIVE_POLL_MAX_MS },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  const client = await kickClientInterviewNarrativeIfPending(
    ownerUserId,
    attemptId,
    'admin_edge_poll_timeout_client_fallback'
  );
  if (!client.skipped && client.ok) {
    return { ok: true, via: 'client' };
  }
  return {
    error: `Edge narrative still incomplete after ${EDGE_NARRATIVE_POLL_MAX_MS / 1000}s — ${
      client.error ?? 'client fallback failed'
    }`,
    via: 'edge_then_client',
  };
}

export async function adminRetryNarrativeWithClientFallback(
  attemptId: string,
  ownerUserId: string
): Promise<AdminNarrativeRetryResult> {
  const edge = await adminRetryAIReasoningForAttempt(attemptId);
  if ('ok' in edge && edge.ok) {
    const immediate = await fetchAttemptNarrativeState(attemptId);
    if (immediate.substantive) {
      return { ok: true, via: 'edge' };
    }
    return waitForEdgeNarrativeOrClientFallback(attemptId, ownerUserId);
  }

  const edgeError = 'error' in edge ? edge.error : 'edge_invoke_failed';
  // #region agent log
  fetch('http://127.0.0.1:7789/ingest/668e0bd5-3283-4492-9f48-e33846c18218', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '4b3376' },
    body: JSON.stringify({
      sessionId: '4b3376',
      hypothesisId: 'H_admin_auto_retry',
      location: 'adminRetryNarrativeWithClientFallback.ts',
      message: 'admin_auto_retry_client_fallback_start',
      data: { attemptId, edgeError: edgeError.slice(0, 200) },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  const client = await kickClientInterviewNarrativeIfPending(
    ownerUserId,
    attemptId,
    'admin_dashboard_client_fallback'
  );

  if (!client.skipped && client.ok) {
    return { ok: true, via: 'client' };
  }

  if (!client.skipped && client.ok === false) {
    return {
      error: `${edgeError} — Client fallback also failed: ${client.error ?? 'unknown'}`,
      via: 'edge_then_client',
    };
  }

  if (client.skipped && client.error) {
    return {
      error: `${edgeError} — Client fallback skipped: ${client.error}`,
      via: 'edge_then_client',
    };
  }

  return { error: edgeError, via: 'edge' };
}
