import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system';

import type {
  ProcessTurnAudioParams,
  ProcessTurnAudioWithRetryDeps,
} from '@features/aria/interviewTurnAudioTypes';

export async function runDeleteTurnAudioFile(nativeUri: string | null): Promise<void> {
  if (!nativeUri || Platform.OS === 'web') return;
  try {
    await FileSystem.deleteAsync(nativeUri, { idempotent: true });
  } catch {
    // non-critical cleanup
  }
}

export async function runProcessTurnAudioWithRetry(
  deps: ProcessTurnAudioWithRetryDeps,
  params: ProcessTurnAudioParams,
): Promise<{ success: boolean }> {
  const { audioBlob, nativeUri, turnIndex, scenarioNumber } = params;
  if (!deps.userId) {
    await deps.deleteTurnAudioFile(nativeUri);
    return { success: false };
  }
  const supabaseUrl = deps.getResolvedSupabaseUrl();
  if (!supabaseUrl || !deps.supabaseAnonKey) {
    await deps.deleteTurnAudioFile(nativeUri);
    return { success: false };
  }

  const MAX_RETRIES = 3;
  const RETRY_DELAYS = [3000, 8000, 15000];
  let lastError: unknown = null;
  const startedAtMs = Date.now();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    try {
      let audioBase64 = '';
      let mimeType = 'audio/mp4';
      if (nativeUri) {
        audioBase64 = await FileSystem.readAsStringAsync(nativeUri, {
          encoding: 'base64' as unknown as never,
        });
        mimeType = 'audio/mp4';
      } else if (audioBlob && typeof audioBlob.arrayBuffer === 'function') {
        const arr = new Uint8Array(await audioBlob.arrayBuffer());
        audioBase64 = deps.bytesToBase64(arr);
        mimeType = audioBlob.type || 'audio/webm';
      }
      if (!audioBase64) throw new Error('No audio data for turn.');
      const durationSec = Math.max(0, (Date.now() - startedAtMs) / 1000);

      const res = await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/analyze-interview-audio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${deps.supabaseAnonKey}`,
          apikey: deps.supabaseAnonKey,
        },
        body: JSON.stringify({
          action: 'process_turn',
          user_id: deps.userId,
          session_id: deps.interviewSessionIdRef.current,
          turn_index: turnIndex,
          scenario_number: scenarioNumber,
          audio_duration_seconds: durationSec,
          mime_type: mimeType,
          audio_base64: audioBase64,
        }),
      });
      if (!res.ok) throw new Error(`Edge function failed: ${res.status} ${await res.text()}`);
      await deps.deleteTurnAudioFile(nativeUri);
      return { success: true };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS[attempt]));
      }
    }
  }

  try {
    const message = lastError instanceof Error ? lastError.message : String(lastError);
    await fetch(`${supabaseUrl.replace(/\/+$/, '')}/functions/v1/analyze-interview-audio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deps.supabaseAnonKey}`,
        apikey: deps.supabaseAnonKey,
      },
      body: JSON.stringify({
        action: 'log_turn_failure',
        user_id: deps.userId,
        session_id: deps.interviewSessionIdRef.current,
        turn_index: turnIndex,
        scenario_number: scenarioNumber,
        error_message: `All ${MAX_RETRIES} attempts failed. Last error: ${message}`,
      }),
    });
  } catch {
    // Non-blocking logging only.
  } finally {
    await deps.deleteTurnAudioFile(nativeUri);
  }
  return { success: false };
}
