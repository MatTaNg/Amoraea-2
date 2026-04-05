import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { styleProfileFromDbRow, translateStyleProfile } from '../_shared/styleTranslations.ts';

function styleLabelsColumnsFromRow(row: Record<string, unknown>) {
  const t = translateStyleProfile(styleProfileFromDbRow(row));
  return {
    style_labels_primary: t.primary,
    style_labels_secondary: t.secondary,
    matchmaker_summary: t.matchmaker_summary,
    low_confidence_note: t.low_confidence_note,
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

const EMOTIONAL_WORDS = [
  'felt',
  'feel',
  'feeling',
  'feelings',
  'hurt',
  'hurting',
  'hurts',
  'scared',
  'afraid',
  'fear',
  'fearful',
  'warm',
  'warmth',
  'excited',
  'sad',
  'sadness',
  'angry',
  'anger',
  'happy',
  'happiness',
  'love',
  'loved',
  'pain',
  'painful',
  'joy',
  'grief',
  'grieving',
  'shame',
  'ashamed',
  'guilt',
  'guilty',
  'proud',
  'lonely',
  'loneliness',
  'confused',
  'overwhelmed',
  'overwhelm',
  'flooded',
  'flooding',
  'moved',
  'touched',
  'heartbroken',
  'relieved',
  'anxious',
  'anxiety',
  'nervous',
  'tender',
  'tenderness',
  'vulnerable',
  'vulnerability',
  'connected',
  'disconnected',
  'distant',
  'numb',
  'alive',
  'empty',
  'full',
  'aching',
  'ache',
  'aches',
  'longing',
  'hopeful',
  'hopeless',
  'devastated',
  'devastating',
  'grateful',
  'resentful',
  'resentment',
  'bitter',
  'bitterness',
  'healing',
  'healed',
  'raw',
  'exhausted',
  'exhaustion',
  'invisible',
  'dread',
  'dreading',
  'contempt',
  'rage',
  'furious',
  'crushed',
  'broken',
  'sinking',
  'sank',
  'sunk',
  'tightness',
  'tight',
  'weight',
  'heavy',
  'heaviness',
  'lit',
  'lit up',
  'crying',
  'cried',
  'tears',
  'tearful',
  'sobbing',
];

/** Strip leading/trailing punctuation so "hurt," and "hurt" both match lexicon. */
function lexiconToken(raw: string): string {
  return raw.replace(/^[^a-z]+/gi, '').replace(/[^a-z]+$/gi, '').toLowerCase();
}

const ANALYTICAL_WORDS = [
  'because', 'therefore', 'structure', 'framework', 'logically', 'pattern',
  'dynamic', 'mechanism', 'construct', 'analysis', 'system', 'process',
  'strategy', 'approach', 'technique', 'method', 'principle', 'theory',
  'concept', 'model', 'factor', 'variable', 'outcome', 'evidence',
  'objective', 'rational', 'reasonably', 'technically', 'specifically',
  'notably', 'effectively', 'fundamentally', 'essentially', 'categorically',
];

const QUALIFIER_WORDS = [
  'maybe', 'perhaps', 'possibly', 'i think', 'i guess',
  'sort of', 'kind of', 'not sure', 'might', 'could be', 'it depends',
  'both things', 'at the same time', 'complicated', 'nuanced', 'complex',
];

const CLOSURE_WORDS = [
  'clearly', 'obviously', 'definitely', 'certainly',
  'absolutely', 'without doubt', 'the problem is', 'the issue is',
  'they need to', 'should have', 'wrong', 'right', 'always', 'never',
];

function countPhraseHits(text: string, phrases: string[]): number {
  return phrases.reduce((acc, phrase) => acc + (text.split(phrase).length - 1), 0);
}

function safeRatio(num: number, den: number, fallback = 0.5): number {
  if (!Number.isFinite(num) || !Number.isFinite(den) || den <= 0) return fallback;
  return num / den;
}

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0.5;
  return Math.max(0, Math.min(1, v));
}

function normalizeRate(value: number, low: number, high: number): number {
  if (!Number.isFinite(value)) return 0.5;
  if (high <= low) return 0.5;
  return clamp01((value - low) / (high - low));
}

function storyMarkerCount(text: string): number {
  const markers = [
    /\bone time\b/g,
    /\bi remember\b/g,
    /\bthere was a moment\b/g,
    /\bwhat happened was\b/g,
    /\blast year\b/g,
    /\bthat night\b/g,
    /\blast (week|month)\b/g,
    /\b(yesterday|earlier)\b/g,
    /\b(then|after that|when that happened)\b/g,
  ];
  return markers.reduce((acc, re) => acc + (text.match(re)?.length ?? 0), 0);
}

function conceptualMarkerCount(text: string): number {
  const markers = [
    /\bin general\b/g,
    /\bpeople tend to\b/g,
    /\brelationships often\b/g,
    /\btypically\b/g,
    /\busually\b/g,
    /\bthe thing about\b/g,
    /\bwhat matters is\b/g,
    /\bthe key is\b/g,
    /\bin principle\b/g,
  ];
  return markers.reduce((acc, re) => acc + (text.match(re)?.length ?? 0), 0);
}

function buildStyleVector(row: Record<string, unknown>): number[] {
  const speechRate = Number(row.speech_rate ?? NaN);
  const energyVariation = Number(row.energy_variation ?? NaN);
  return [
    clamp01(Number(row.emotional_analytical_score ?? 0.5)),
    clamp01(Number(row.narrative_conceptual_score ?? 0.5)),
    clamp01(Number(row.certainty_ambiguity_score ?? 0.5)),
    clamp01(Number(row.relational_individual_score ?? 0.5)),
    clamp01(Number(row.warmth_score ?? 0.5)),
    clamp01(Number(row.emotional_expressiveness ?? 0.5)),
    normalizeRate(speechRate, 90, 180),
    normalizeRate(energyVariation, 0.1, 0.8),
  ];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')?.trim();
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')?.trim();
  if (!supabaseUrl || !serviceRole) {
    return new Response(JSON.stringify({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const admin = createClient(supabaseUrl, serviceRole);

  let body: { user_id?: string; attempt_id?: string } = {};
  try {
    body = await req.json();
  } catch {
    // keep default
  }
  const userId = (body.user_id ?? '').trim();
  const requestedAttemptId = (body.attempt_id ?? '').trim();
  if (!userId) {
    return new Response(JSON.stringify({ error: 'user_id is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const log = async (
    status: 'success' | 'failed' | 'partial',
    errorMessage: string | null,
    features: Record<string, unknown> | null,
  ) => {
    await admin.from('style_processing_log').insert({
      user_id: userId,
      processing_type: 'text',
      status,
      error_message: errorMessage,
      features_extracted: features ?? {},
    });
  };

  try {
    let attempt: {
      id: string;
      transcript: unknown;
      passed: boolean | null;
      scenario_1_scores: unknown;
      scenario_2_scores: unknown;
      scenario_3_scores: unknown;
      scenario_specific_patterns: unknown;
    } | null = null;
    let attemptError: Error | null = null;

    if (requestedAttemptId) {
      const { data, error } = await admin
        .from('interview_attempts')
        .select('id, transcript, passed, scenario_1_scores, scenario_2_scores, scenario_3_scores, scenario_specific_patterns')
        .eq('id', requestedAttemptId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) attemptError = new Error(error.message);
      else attempt = data as typeof attempt;
    } else {
      const { data, error } = await admin
        .from('interview_attempts')
        .select('id, transcript, passed, scenario_1_scores, scenario_2_scores, scenario_3_scores, scenario_specific_patterns')
        .eq('user_id', userId)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) attemptError = new Error(error.message);
      else attempt = data as typeof attempt;
    }

    if (attemptError) throw attemptError;
    if (!attempt) {
      const failFeatures = { text_confidence: 0, reason: 'no-attempt-for-user' };
      const partialRow = {
        user_id: userId,
        text_confidence: 0,
        audio_confidence: 0,
        processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await admin
        .from('communication_style_profiles')
        .upsert(
          {
            ...partialRow,
            ...styleLabelsColumnsFromRow(partialRow),
          },
          { onConflict: 'user_id' },
        );
      await log('partial', 'No interview attempt found for text style analysis.', failFeatures);
      const noAttemptBody = JSON.stringify({
        ok: false,
        partial: true,
        reason: 'no-attempt',
        error: 'No interview attempt found for text style analysis.',
      });
      return new Response(noAttemptBody, {
        status: requestedAttemptId ? 404 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const transcript = Array.isArray(attempt.transcript) ? attempt.transcript : [];
    const userTurns = transcript
      .filter((m: Record<string, unknown>) => m?.role === 'user' && typeof m?.content === 'string')
      .map((m: Record<string, unknown>) => String(m.content).trim())
      .filter(Boolean);
    const corpus = userTurns.join(' ').toLowerCase();
    const words = corpus.split(/\s+/).filter(Boolean);
    const tokens = words.map((w) => lexiconToken(w)).filter(Boolean);
    const totalWords = tokens.length || 1;

    const emotionalPhraseHits = [
      'lit up',
      'worn down',
      'wearing thin',
      'wore me down',
      'chewed up',
      'ripped open',
      'wearing on',
      'broke me',
      'broke open',
    ].reduce((acc, p) => acc + Math.max(0, corpus.split(p).length - 1), 0);
    const emotionalWords =
      tokens.filter((w) => EMOTIONAL_WORDS.includes(w)).length + emotionalPhraseHits;
    const analyticalWords = tokens.filter((w) => ANALYTICAL_WORDS.includes(w)).length;
    const qualifierCount = countPhraseHits(corpus, QUALIFIER_WORDS);
    const closureCount = countPhraseHits(corpus, CLOSURE_WORDS);

    const relationalMarkers = countPhraseHits(corpus, [
      'we', 'us', 'together', 'both', 'each other', 'between them',
      'their relationship', 'the dynamic', 'how they',
    ]);
    const individualMarkers = tokens.filter((w) => w === 'i' || w === 'me' || w === 'my' || w === 'myself').length;

    const pronounsTotal =
      tokens.filter((w) => ['i', 'me', 'my', 'myself', 'we', 'us', 'they', 'them'].includes(w)).length || 1;
    const firstPersonSingular = tokens.filter((w) => ['i', 'me', 'my', 'myself'].includes(w)).length;

    const storyMarkers = storyMarkerCount(corpus);
    const conceptMarkers = conceptualMarkerCount(corpus);

    const relationalShare = clamp01(safeRatio(relationalMarkers, relationalMarkers + individualMarkers, 0.5));
    const styleFeatures = {
      emotional_analytical_score: clamp01(safeRatio(emotionalWords, emotionalWords + analyticalWords, 0.5)),
      narrative_conceptual_score: clamp01(safeRatio(storyMarkers, storyMarkers + conceptMarkers, 0.5)),
      certainty_ambiguity_score: clamp01(safeRatio(qualifierCount, qualifierCount + closureCount, 0.5)),
      // Store individual-orientation: 0 = strongly relational (we-language), 1 = strongly individual (I/me).
      relational_individual_score: clamp01(1 - relationalShare),
      emotional_vocab_density: (emotionalWords / totalWords) * 100,
      qualifier_density: (qualifierCount / totalWords) * 100,
      first_person_ratio: safeRatio(firstPersonSingular, pronounsTotal, 0.5),
      avg_response_length: totalWords / Math.max(userTurns.length, 1),
    };

    const scenarioCount =
      (attempt.scenario_1_scores ? 1 : 0) +
      (attempt.scenario_2_scores ? 1 : 0) +
      (attempt.scenario_3_scores ? 1 : 0);
    const personal = typeof attempt.scenario_specific_patterns === 'object' && attempt.scenario_specific_patterns
      ? attempt.scenario_specific_patterns as Record<string, unknown>
      : {};
    const hasMoment4 = Boolean((personal as Record<string, unknown>).moment_4_scores);
    const hasMoment5 = Boolean((personal as Record<string, unknown>).moment_5_scores);
    const momentsPresent = scenarioCount + (hasMoment4 ? 1 : 0) + (hasMoment5 ? 1 : 0);
    const textConfidence = momentsPresent >= 5 ? 1.0 : momentsPresent >= 3 ? 0.7 : 0.4;

    const { data: existing } = await admin
      .from('communication_style_profiles')
      .select('audio_confidence, warmth_score, emotional_expressiveness, speech_rate, energy_variation')
      .eq('user_id', userId)
      .maybeSingle();

    const merged = {
      ...existing,
      ...styleFeatures,
      text_confidence: textConfidence,
      processed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const overallConfidence =
      ((Number(merged.text_confidence ?? 0) * 0.5) + (Number(merged.audio_confidence ?? 0) * 0.5));
    const styleVector = buildStyleVector(merged);

    const rowForLabels = { ...merged, ...styleFeatures, text_confidence: textConfidence };
    const upsertRow = {
      user_id: userId,
      source_attempt_id: attempt.id,
      ...styleFeatures,
      text_confidence: textConfidence,
      overall_confidence: overallConfidence,
      style_vector: `[${styleVector.map((n) => Number.isFinite(n) ? n.toFixed(6) : '0.500000').join(',')}]`,
      processed_at: merged.processed_at,
      updated_at: merged.updated_at,
      ...styleLabelsColumnsFromRow(rowForLabels),
    };

    const { error: upsertErr } = await admin
      .from('communication_style_profiles')
      .upsert(upsertRow, { onConflict: 'user_id' });
    if (upsertErr) {
      console.error(
        `[analyze-interview-text] communication_style_profiles upsert FAILED user_id=${userId} attempt_id=${attempt.id}:`,
        upsertErr.message
      );
      throw new Error(upsertErr.message);
    }
    console.log(
      `[analyze-interview-text] communication_style_profiles upsert OK user_id=${userId} attempt_id=${attempt.id}`
    );

    await log('success', null, {
      attempt_id: attempt.id,
      moments_present: momentsPresent,
      text_confidence: textConfidence,
      ...styleFeatures,
    });

    return new Response(JSON.stringify({ ok: true, user_id: userId, attempt_id: attempt.id, text_confidence: textConfidence }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await log('failed', msg, null);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

