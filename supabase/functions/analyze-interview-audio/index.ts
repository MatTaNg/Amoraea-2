import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0.5;
  return Math.max(0, Math.min(1, v));
}

function normalizeRate(value: number, low: number, high: number): number {
  if (!Number.isFinite(value) || high <= low) return 0.5;
  return clamp01((value - low) / (high - low));
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function buildStyleVector(row: Record<string, unknown>): number[] {
  return [
    clamp01(Number(row.emotional_analytical_score ?? 0.5)),
    clamp01(Number(row.narrative_conceptual_score ?? 0.5)),
    clamp01(Number(row.certainty_ambiguity_score ?? 0.5)),
    clamp01(Number(row.relational_individual_score ?? 0.5)),
    clamp01(Number(row.warmth_score ?? 0.5)),
    clamp01(Number(row.emotional_expressiveness ?? 0.5)),
    normalizeRate(Number(row.speech_rate ?? NaN), 90, 180),
    normalizeRate(Number(row.energy_variation ?? NaN), 0.1, 0.8),
  ];
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function extractProsodyMetrics(result: Record<string, unknown>): Record<string, number | null> {
  const utterances = (((result?.predictions as Record<string, unknown> | undefined)?.prosody as Record<string, unknown> | undefined)
    ?.grouped_predictions as Array<Record<string, unknown>> | undefined) ?? [];
  const pitchMeans: number[] = [];
  const speechRates: number[] = [];
  const pauses: number[] = [];
  const energies: number[] = [];
  const warmthSignals: number[] = [];
  const emotionalSpread: number[] = [];

  for (const utt of utterances) {
    const predictions = (utt.predictions as Array<Record<string, unknown>> | undefined) ?? [];
    for (const p of predictions) {
      const emotions = (p.emotions as Array<Record<string, unknown>> | undefined) ?? [];
      const scores = emotions.map((e) => Number(e.score ?? NaN)).filter(Number.isFinite);
      const names = emotions.map((e) => String(e.name ?? '').toLowerCase());
      if (scores.length) emotionalSpread.push(Math.max(...scores) - Math.min(...scores));
      emotions.forEach((e) => {
        const name = String(e.name ?? '').toLowerCase();
        const score = Number(e.score ?? NaN);
        if (!Number.isFinite(score)) return;
        if (name === 'admiration' || name === 'contentment' || name === 'joy') warmthSignals.push(score);
      });
      const f0 = Number((p as Record<string, unknown>).f0_hz ?? NaN);
      if (Number.isFinite(f0)) pitchMeans.push(f0);
      const wpm = Number((p as Record<string, unknown>).words_per_minute ?? NaN);
      if (Number.isFinite(wpm)) speechRates.push(wpm);
      const pause = Number((p as Record<string, unknown>).pause_count ?? NaN);
      if (Number.isFinite(pause)) pauses.push(pause);
      const energy = Number((p as Record<string, unknown>).energy ?? NaN);
      if (Number.isFinite(energy)) energies.push(energy);
      if (!names.length) continue;
    }
  }

  const pitchMean = pitchMeans.length ? mean(pitchMeans) : null;
  const pitchRange = pitchMeans.length ? Math.max(...pitchMeans) - Math.min(...pitchMeans) : null;
  const speechRate = speechRates.length ? mean(speechRates) : null;
  const pauseFrequency = pauses.length ? mean(pauses) : null;
  const energyVariation = energies.length ? Math.max(...energies) - Math.min(...energies) : null;
  const emotionalExpressiveness = emotionalSpread.length ? clamp01(mean(emotionalSpread)) : null;
  const warmthScore = warmthSignals.length ? clamp01(mean(warmthSignals)) : null;

  return {
    pitch_mean: pitchMean,
    pitch_range: pitchRange,
    speech_rate: speechRate,
    pause_frequency: pauseFrequency,
    energy_variation: energyVariation,
    emotional_expressiveness: emotionalExpressiveness,
    warmth_score: warmthScore,
  };
}

type Body = {
  action?: 'process_turn' | 'log_turn_failure' | 'finalize_session';
  user_id?: string;
  session_id?: string;
  attempt_id?: string;
  turn_index?: number;
  scenario_number?: number;
  audio_duration_seconds?: number;
  mime_type?: string;
  audio_base64?: string;
  error_message?: string;
};

async function logStyle(
  admin: ReturnType<typeof createClient>,
  userId: string,
  processingType: string,
  status: 'success' | 'failed' | 'partial',
  errorMessage: string | null,
  features: Record<string, unknown> | null,
) {
  await admin.from('style_processing_log').insert({
    user_id: userId,
    processing_type: processingType,
    status,
    error_message: errorMessage,
    features_extracted: features ?? {},
  });
}

async function setAudioConfidenceZero(
  admin: ReturnType<typeof createClient>,
  userId: string,
  reason: string
) {
  const { data: existing } = await admin
    .from('communication_style_profiles')
    .select('text_confidence, emotional_analytical_score, narrative_conceptual_score, certainty_ambiguity_score, relational_individual_score')
    .eq('user_id', userId)
    .maybeSingle();
  const textConfidence = Number(existing?.text_confidence ?? 0);
  const overallConfidence = (textConfidence * 0.5);
  const merged = { ...(existing ?? {}), audio_confidence: 0 };
  const styleVector = buildStyleVector(merged);
  await admin.from('communication_style_profiles').upsert({
    user_id: userId,
    audio_confidence: 0,
    overall_confidence: overallConfidence,
    style_vector: `[${styleVector.map((n) => Number.isFinite(n) ? n.toFixed(6) : '0.500000').join(',')}]`,
    processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  await logStyle(admin, userId, 'audio', 'partial', reason, { audio_confidence: 0 });
}

async function processTurn(body: Body, admin: ReturnType<typeof createClient>, humeApiKey: string | null) {
  const userId = String(body.user_id ?? '').trim();
  const sessionId = String(body.session_id ?? '').trim();
  const turnIndex = Number(body.turn_index ?? -1);
  const scenarioNumber = Number(body.scenario_number ?? 0);
  const audioB64 = String(body.audio_base64 ?? '').trim();
  const mime = String(body.mime_type ?? 'audio/mp4');
  const duration = Number(body.audio_duration_seconds ?? 0);
  if (!userId || !sessionId || turnIndex < 0 || !audioB64) {
    return new Response(JSON.stringify({ error: 'Missing required turn payload fields.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!humeApiKey) {
    await admin.from('interview_turn_audio_features').insert({
      user_id: userId,
      session_id: sessionId,
      turn_index: turnIndex,
      scenario_number: Number.isFinite(scenarioNumber) ? scenarioNumber : null,
      audio_duration_seconds: Number.isFinite(duration) ? duration : null,
      processing_status: 'failed',
      error_message: 'HUME_API_KEY not set.',
    });
    await logStyle(admin, userId, 'audio_turn', 'failed', 'HUME_API_KEY not set.', { turn_index: turnIndex });
    return new Response(JSON.stringify({ ok: true, partial: true, reason: 'missing-hume-key' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const bucket = 'interview-audio';
  const ext = mime.includes('webm') ? 'webm' : mime.includes('ogg') ? 'ogg' : 'm4a';
  const storagePath = `${userId}/turn_${sessionId}_${turnIndex}_${Date.now()}.${ext}`;
  try {
    const bytes = Uint8Array.from(atob(audioB64), (c) => c.charCodeAt(0));
    const { error: uploadErr } = await admin.storage.from(bucket).upload(storagePath, bytes, {
      contentType: mime,
      upsert: true,
    });
    if (uploadErr) throw new Error(`Storage upload failed: ${uploadErr.message}`);
    const { data: publicData } = admin.storage.from(bucket).getPublicUrl(storagePath);
    const createRes = await fetch('https://api.hume.ai/v0/batch/jobs', {
      method: 'POST',
      headers: {
        'X-Hume-Api-Key': humeApiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        models: { prosody: { granularity: 'utterance' } },
        urls: [publicData.publicUrl],
      }),
    });
    if (!createRes.ok) throw new Error(`Hume create job failed: ${createRes.status} ${await createRes.text()}`);
    const create = await createRes.json() as { job_id?: string; jobId?: string; id?: string };
    const jobId = create.job_id ?? create.jobId ?? create.id;
    if (!jobId) throw new Error('Hume job id missing');
    const started = Date.now();
    while (true) {
      if (Date.now() - started > 120000) throw new Error('Hume polling timed out for turn');
      await sleep(3000);
      const pollRes = await fetch(`https://api.hume.ai/v0/batch/jobs/${jobId}`, {
        headers: { 'X-Hume-Api-Key': humeApiKey },
      });
      if (!pollRes.ok) continue;
      const poll = await pollRes.json() as Record<string, unknown>;
      const status = String(poll.state ?? poll.status ?? '').toLowerCase();
      if (status === 'failed' || status === 'error') throw new Error(`Hume job failed: ${status}`);
      if (status !== 'completed' && status !== 'done' && status !== 'success') continue;
      const predRes = await fetch(`https://api.hume.ai/v0/batch/jobs/${jobId}/predictions`, {
        headers: { 'X-Hume-Api-Key': humeApiKey },
      });
      if (!predRes.ok) throw new Error(`Hume predictions failed: ${predRes.status} ${await predRes.text()}`);
      const pred = await predRes.json() as { results?: Array<Record<string, unknown>> };
      const metrics = extractProsodyMetrics(pred.results?.[0] ?? {});
      await admin.from('interview_turn_audio_features').insert({
        user_id: userId,
        session_id: sessionId,
        turn_index: turnIndex,
        scenario_number: Number.isFinite(scenarioNumber) ? scenarioNumber : null,
        ...metrics,
        audio_duration_seconds: Number.isFinite(duration) ? duration : null,
        processing_status: 'success',
      });
      await logStyle(admin, userId, 'audio_turn', 'success', null, {
        session_id: sessionId,
        turn_index: turnIndex,
        ...metrics,
      });
      return new Response(JSON.stringify({ ok: true, status: 'success' }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin.from('interview_turn_audio_features').insert({
      user_id: userId,
      session_id: sessionId,
      turn_index: turnIndex,
      scenario_number: Number.isFinite(scenarioNumber) ? scenarioNumber : null,
      processing_status: 'failed',
      error_message: msg,
      audio_duration_seconds: Number.isFinite(duration) ? duration : null,
    });
    await logStyle(admin, userId, 'audio_turn', 'failed', msg, {
      session_id: sessionId,
      turn_index: turnIndex,
    });
    return new Response(JSON.stringify({ ok: true, status: 'failed', error: msg }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } finally {
    await admin.storage.from(bucket).remove([storagePath]);
  }
}

async function logTurnFailure(body: Body, admin: ReturnType<typeof createClient>) {
  const userId = String(body.user_id ?? '').trim();
  const sessionId = String(body.session_id ?? '').trim();
  const turnIndex = Number(body.turn_index ?? -1);
  const scenarioNumber = Number(body.scenario_number ?? 0);
  const message = String(body.error_message ?? 'Unknown turn processing failure').trim();
  if (!userId || !sessionId || turnIndex < 0) {
    return new Response(JSON.stringify({ error: 'Missing required failure payload fields.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  await admin.from('interview_turn_audio_features').insert({
    user_id: userId,
    session_id: sessionId,
    turn_index: turnIndex,
    scenario_number: Number.isFinite(scenarioNumber) ? scenarioNumber : null,
    processing_status: 'failed',
    error_message: message,
  });
  await logStyle(admin, userId, 'audio_turn', 'failed', message, {
    session_id: sessionId,
    turn_index: turnIndex,
  });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function finalizeSession(body: Body, admin: ReturnType<typeof createClient>) {
  const userId = String(body.user_id ?? '').trim();
  const attemptId = String(body.attempt_id ?? '').trim();
  const sessionId = String(body.session_id ?? '').trim();
  if (!userId || !attemptId) {
    return new Response(JSON.stringify({ error: 'user_id and attempt_id are required.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  if (sessionId) {
    await admin
      .from('interview_turn_audio_features')
      .update({ attempt_id: attemptId })
      .eq('user_id', userId)
      .eq('session_id', sessionId)
      .is('attempt_id', null);
  }

  const { data: turns, error: turnsErr } = await admin
    .from('interview_turn_audio_features')
    .select('*')
    .eq('attempt_id', attemptId)
    .eq('processing_status', 'success');
  if (turnsErr) throw turnsErr;

  const { count: totalTurns } = await admin
    .from('interview_turn_audio_features')
    .select('*', { count: 'exact', head: true })
    .eq('attempt_id', attemptId);

  if (!turns || turns.length === 0) {
    await setAudioConfidenceZero(admin, userId, 'No successful turn audio features for this session.');
    return new Response(JSON.stringify({ ok: true, partial: true, audio_confidence: 0 }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const totalDuration = turns.reduce((sum, t) => sum + (Number(t.audio_duration_seconds ?? 1) || 1), 0) || 1;
  const weightedAverage = (field: string) =>
    turns.reduce((sum, t) => {
      const weight = (Number(t.audio_duration_seconds ?? 1) || 1) / totalDuration;
      const value = Number((t as Record<string, unknown>)[field] ?? 0) || 0;
      return sum + value * weight;
    }, 0);

  const averaged = {
    pitch_mean: weightedAverage('pitch_mean'),
    pitch_range: weightedAverage('pitch_range'),
    speech_rate: weightedAverage('speech_rate'),
    pause_frequency: weightedAverage('pause_frequency'),
    energy_variation: weightedAverage('energy_variation'),
    emotional_expressiveness: weightedAverage('emotional_expressiveness'),
    warmth_score: weightedAverage('warmth_score'),
  };

  const confidenceDen = Number(totalTurns ?? turns.length) || turns.length;
  const audioConfidence = confidenceDen > 0 ? turns.length / confidenceDen : 0;

  const { data: existing } = await admin
    .from('communication_style_profiles')
    .select('text_confidence, emotional_analytical_score, narrative_conceptual_score, certainty_ambiguity_score, relational_individual_score')
    .eq('user_id', userId)
    .maybeSingle();
  const textConfidence = Number(existing?.text_confidence ?? 0);
  const merged = { ...(existing ?? {}), ...averaged, audio_confidence: audioConfidence };
  const styleVector = buildStyleVector(merged);
  const overallConfidence = (textConfidence * 0.5) + (audioConfidence * 0.5);

  await admin.from('communication_style_profiles').upsert({
    user_id: userId,
    ...averaged,
    audio_confidence: audioConfidence,
    overall_confidence: overallConfidence,
    style_vector: `[${styleVector.map((n) => Number.isFinite(n) ? n.toFixed(6) : '0.500000').join(',')}]`,
    processed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });

  await logStyle(admin, userId, 'audio_session_finalized', 'success', null, {
    turns_processed: turns.length,
    total_turns: confidenceDen,
    audio_confidence: audioConfidence,
    ...averaged,
  });
  return new Response(JSON.stringify({ ok: true, audio_confidence: audioConfidence }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  const humeApiKey = Deno.env.get('HUME_API_KEY')?.trim() ?? null;
  if (!supabaseUrl || !serviceRole) {
    return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const admin = createClient(supabaseUrl, serviceRole);

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const action = body.action ?? 'process_turn';

  try {
    if (action === 'process_turn') return await processTurn(body, admin, humeApiKey);
    if (action === 'log_turn_failure') return await logTurnFailure(body, admin);
    if (action === 'finalize_session') return await finalizeSession(body, admin);
    return new Response(JSON.stringify({ error: 'Unsupported action.' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

