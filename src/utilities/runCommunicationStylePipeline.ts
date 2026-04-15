/**
 * Post-interview communication style: analyze-interview-text + analyze-interview-audio finalize.
 * Uses supabase.functions.invoke (same as Admin dashboard) so the client sets auth consistently on web.
 */
import { supabase } from '@data/supabase/client';
import { remoteLog } from '@utilities/remoteLog';
import { logCommunicationStylePipelineOutcome } from '@utilities/sessionLogging/sessionLogInterview';
import type { SessionPlatform } from '@utilities/sessionLogging/writeSessionLog';

/** Browser CORS on preflight often means the gateway returned non-2xx (e.g. 404 if the function is not deployed). */
function warnIfEdgeFunctionsProbablyMissing(errs: string[]): void {
  const joined = errs.join(' ');
  if (
    joined.includes('Failed to send a request to the Edge Function') ||
    joined.includes('Failed to fetch') ||
    joined.includes('ERR_FAILED')
  ) {
    console.warn(
      '[COMMUNICATION_STYLE] Preflight/CORS errors usually mean the Supabase gateway returned a non-OK status. ' +
        'A 404 "Requested function was not found" means these Edge Functions are not deployed to this project. ' +
        'From the repo: `npx supabase functions deploy analyze-interview-text` and `npx supabase functions deploy analyze-interview-audio` (project linked).'
    );
  }
}

async function safeUpdateCommunicationStyleError(
  attemptId: string,
  uid: string,
  errorText: string | null
): Promise<void> {
  const { error } = await supabase
    .from('interview_attempts')
    .update({ communication_style_error: errorText })
    .eq('id', attemptId)
    .eq('user_id', uid);
  if (!error) return;
  if (
    error.code === 'PGRST204' ||
    (typeof error.message === 'string' && error.message.includes('communication_style_error'))
  ) {
    return;
  }
  console.error('[COMMUNICATION_STYLE] failed to update interview_attempts.communication_style_error', error);
  void remoteLog('[COMMUNICATION_STYLE] attempt column update failed', { attemptId, message: error.message });
}

/**
 * After an interview attempt row exists: run analyze-interview-text then analyze-interview-audio finalize.
 * Logs to console/remoteLog; sets interview_attempts.communication_style_error when that column exists.
 */
export async function runCommunicationStylePipelineAfterSave(
  uid: string,
  attemptId: string,
  sessionId: string,
  sessionLog?: { platform: SessionPlatform | null }
): Promise<void> {
  const errs: string[] = [];
  console.log('[COMMUNICATION_STYLE] pipeline start', { attemptId, sessionIdPresent: Boolean(sessionId?.trim()) });
  void remoteLog('[COMMUNICATION_STYLE] pipeline start', { attemptId });

  try {
    const textResult = await supabase.functions.invoke('analyze-interview-text', {
      body: { user_id: uid, attempt_id: attemptId },
    });
    if (textResult.error) {
      errs.push(`analyze-interview-text: ${textResult.error.message}`);
    } else {
      const body = textResult.data as { ok?: boolean; error?: string; partial?: boolean; reason?: string } | null;
      if (body && typeof body === 'object') {
        if (body.error) errs.push(`analyze-interview-text: ${body.error}`);
        else if (body.partial === true && body.reason === 'no-attempt') {
          errs.push('analyze-interview-text: no interview attempt matched (no-attempt)');
        }
      }
      if (errs.length === 0) {
        const dbg = body as {
          narrative_conceptual_score?: number;
          user_corpus_char_count?: number;
          user_turn_count?: number;
          nc_lexicon_debug?: Record<string, number>;
          matchmaker_fog_runon?: boolean;
        };
        const payload = {
          attemptId,
          narrative_conceptual_score: dbg.narrative_conceptual_score,
          user_corpus_char_count: dbg.user_corpus_char_count,
          user_turn_count: dbg.user_turn_count,
          nc_lexicon_debug: dbg.nc_lexicon_debug,
          matchmaker_fog_runon: dbg.matchmaker_fog_runon,
        };
        console.log('[COMMUNICATION_STYLE] analyze-interview-text ok', payload);
        void remoteLog('[COMMUNICATION_STYLE] analyze-interview-text ok', payload);
      }
    }
  } catch (e) {
    errs.push(`analyze-interview-text: ${e instanceof Error ? e.message : String(e)}`);
  }

  try {
    const audioResult = await supabase.functions.invoke('analyze-interview-audio', {
      body: {
        action: 'finalize_session',
        user_id: uid,
        attempt_id: attemptId,
        session_id: sessionId,
      },
    });
    if (audioResult.error) {
      errs.push(`analyze-interview-audio: ${audioResult.error.message}`);
    } else {
      const body = audioResult.data as {
        error?: string;
        narrative_conceptual_score?: number;
        nc_lexicon_debug?: Record<string, number>;
        matchmaker_fog_runon?: boolean;
        audio_confidence?: number;
      } | null;
      if (body && typeof body === 'object' && body.error) {
        errs.push(`analyze-interview-audio: ${body.error}`);
      } else if (body && typeof body === 'object' && !body.error) {
        const audioPayload = {
          attemptId,
          narrative_conceptual_score: body.narrative_conceptual_score,
          audio_confidence: body.audio_confidence,
          nc_lexicon_debug: body.nc_lexicon_debug,
          matchmaker_fog_runon: body.matchmaker_fog_runon,
        };
        console.log('[COMMUNICATION_STYLE] analyze-interview-audio finalize ok', audioPayload);
      }
    }
  } catch (e) {
    errs.push(`analyze-interview-audio: ${e instanceof Error ? e.message : String(e)}`);
  }

  const errorText = errs.length > 0 ? errs.join(' | ') : null;
  if (errorText) {
    warnIfEdgeFunctionsProbablyMissing(errs);
    console.error('[COMMUNICATION_STYLE] pipeline finished with errors', { attemptId, errorText });
    void remoteLog('[COMMUNICATION_STYLE] pipeline errors', { attemptId, errorText });
  } else {
    console.log('[COMMUNICATION_STYLE] pipeline completed successfully', { attemptId });
    void remoteLog('[COMMUNICATION_STYLE] pipeline ok', { attemptId });
  }

  await safeUpdateCommunicationStyleError(attemptId, uid, errorText);

  let matchmakerSummary: string | null = null;
  try {
    const { data: row } = await supabase
      .from('communication_style_profiles')
      .select('matchmaker_summary, source_attempt_id')
      .eq('user_id', uid)
      .eq('source_attempt_id', attemptId)
      .maybeSingle();
    const raw = row as { matchmaker_summary?: string | null; source_attempt_id?: string | null } | null;
    matchmakerSummary = typeof raw?.matchmaker_summary === 'string' ? raw.matchmaker_summary : null;
  } catch {
    matchmakerSummary = null;
  }
  const summaryLen = matchmakerSummary?.trim().length ?? 0;
  logCommunicationStylePipelineOutcome(
    { userId: uid, attemptId, platform: sessionLog?.platform ?? null },
    {
      source_attempt_id: attemptId,
      matchmaker_summary_generated: summaryLen > 0,
      matchmaker_summary_length: summaryLen,
      pipeline_error: errorText,
    }
  );
  if (summaryLen > 0) {
    void remoteLog('[COMMUNICATION_STYLE] matchmaker_summary', { attemptId, length: summaryLen });
  }
}
