/**
 * Server-side completion for standard onboarding: holistic score + gate + AI reasoning, then DB updates.
 * Invoked from complete-standard-interview (user JWT) or process-deferred-standard-interviews (cron).
 */
import { type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildScoringPrompt } from './holisticScoringPrompt.ts';
import { coerceHolisticInterviewModelObject } from './coerceHolisticInterviewModelObject.ts';
import {
  computeGateResultCore,
  computeInterviewWeightedCompositeFromPillars,
  GATE_PASS_WEIGHTED_MIN,
  REFERRAL_WEIGHTED_PASS_MIN,
} from './computeGateResultCore.ts';
import { scenarioCompositesToStorageJson } from './scenarioCompositeFloor.ts';
import { generateAIReasoning } from './generateAIReasoning.ts';
import {
  buildEvidenceContextFromAttemptPatterns,
  type NarrativeEvidenceContext,
} from './narrativeEvidenceGuidance.ts';
import { CLAUDE_SONNET_MODEL } from './anthropicModel.ts';
import { communicationFloorFieldsFromTranscript } from './communicationFloorFromTranscript.ts';
import { evaluateInterviewCompletionGate, type CompletionGateFailure } from './interviewCompletionGate.ts';
import { mergeMomentConcretenessForGate, normalizeMoment4Concreteness, normalizeResponseConcreteness } from './personalMomentConcreteness.ts';
import { applyPsychometricModifierToAttempt } from './applyPsychometricModifier.ts';
import { normalizeGateFailDetailForPersist } from './gateFailDetailForPersist.ts';
import { buildDefenseCrossReferenceForAttempt } from './crossReferenceDefenseDetection.ts';
import { normalizeDefensePatternsForPersist } from './defensePatternsDetection.ts';
import { markScoringStageComplete } from './ensureInterviewRollupArtifacts.ts';
import {
  computeAvgScenarioTotalUserWords,
  computeDisclosureCalibration,
  sumUserWordsForInterviewMoment,
  type DisclosureCalibration,
  type DisclosureCalibrationTurn,
  personalMomentWordCountsForDisclosure,
} from './disclosureCalibration.ts';
import { aggregatePillarScoresWithCommitmentMergeDetailed } from './aggregateMarkerScoresFromSlices.ts';
import {
  finiteNumberOrNull,
  markerSliceFromAttemptScoresField,
  markerSlicesFromAttemptRow,
  pickPersistedNumber,
  type MarkerScoreSliceParsed,
} from './attemptScoreSliceParsing.ts';
import {
  emotionRecognitionDisplayScoreFromRow,
  emotionRecognitionPersistFieldsFromRow,
  emotionRecognitionRawScoreFromRow,
} from './emotionRecognitionScoring.ts';

type MarkerScoreSliceEdge = MarkerScoreSliceParsed;

async function markAttemptIncompleteNoScore(
  supabase: SupabaseClient,
  attemptId: string,
  userId: string,
  failure: CompletionGateFailure,
): Promise<string | null> {
  console.error('[COMPLETION_GATE_FAIL]', {
    attemptId,
    incomplete_reason: failure.incomplete_reason,
    detail: failure.detail,
    missingScenarioNumbers: failure.missingScenarioNumbers,
    missingMoment4: failure.missingMoment4,
    missingMoment5: failure.missingMoment5,
  });
  const { error: upA } = await supabase
    .from('interview_attempts')
    .update({
      completed_at: new Date().toISOString(),
      weighted_score: null,
      passed: false,
      incomplete_reason: failure.incomplete_reason,
      scoring_deferred: false,
      pillar_scores: null,
      gate_fail_reasons: [],
      gate_fail_detail: { psychometric_floors: {} },
      ego_development_level: null,
      review_flags: [],
      ai_reasoning: {
        _completionHeld: true,
        incomplete_reason: failure.incomplete_reason,
        detail: failure.detail,
      },
    })
    .eq('id', attemptId)
    .eq('user_id', userId);

  if (upA) return upA.message;

  const { error: upU } = await supabase
    .from('users')
    .update({
      interview_completed: true,
      interview_passed_computed: false,
      interview_passed: false,
    })
    .eq('id', userId);

  if (upU) return upU.message;
  return null;
}

/**
 * Must leave headroom for AI reasoning + DB + cold start under Supabase Edge wall clock (~150s free/pro).
 * Previously 180s holistic alone could exceed the platform limit → gateway 504 / browser “pending” until timeout.
 */
const HOLISTIC_FETCH_TIMEOUT_MS = 65_000;

type Transcript = Array<{ role: string; content?: string; scenarioNumber?: number | null }>;

type InterviewResults = {
  pillarScores?: Record<string, number | null>;
  keyEvidence?: Record<string, string>;
  interviewSummary?: string;
  notableInconsistencies?: string[];
  skepticismModifier?: { pillarId: number | string | null; adjustment: number; reason?: string } | null;
  ego_development_level?: number | null;
};

function normalizeHolisticEgoLevelEdge(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const r = Math.round(raw);
    if (r < 1 || r > 5) return null;
    return r;
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (s === '') return null;
    if (/^-?\d+$/.test(s)) {
      const n = parseInt(s, 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 5) return n;
      return null;
    }
    const asFloat = Number(s);
    if (!Number.isFinite(asFloat)) return null;
    const r = Math.round(asFloat);
    if (r < 1 || r > 5) return null;
    return r;
  }
  return null;
}

function extractEgoDevelopmentLevelEdge(parsed: Record<string, unknown>): number | null {
  const candidates: unknown[] = [parsed.ego_development_level, parsed.egoDevelopmentLevel];
  const pillarScores = parsed.pillarScores ?? parsed.pillar_scores;
  if (pillarScores != null && typeof pillarScores === 'object' && !Array.isArray(pillarScores)) {
    const ps = pillarScores as Record<string, unknown>;
    candidates.push(ps.ego_development_level, ps.egoDevelopmentLevel);
  }
  for (const c of candidates) {
    const n = normalizeHolisticEgoLevelEdge(c);
    if (n != null) return n;
  }
  return null;
}

function normalizeHolisticInterviewParse(o: unknown): InterviewResults {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { pillarScores: {} };
  const r = o as Record<string, unknown>;
  const pillarScores = (r.pillarScores ?? r.pillar_scores) as InterviewResults['pillarScores'];
  const egoExtracted = extractEgoDevelopmentLevelEdge(r);
  const skepticismModifier = (r.skepticismModifier ?? r.skepticism_modifier) as InterviewResults['skepticismModifier'];
  return {
    pillarScores: pillarScores ?? {},
    keyEvidence: (r.keyEvidence ?? r.key_evidence) as InterviewResults['keyEvidence'],
    interviewSummary: (r.interviewSummary ?? r.interview_summary) as string | undefined,
    notableInconsistencies: (r.notableInconsistencies ?? r.notable_inconsistencies) as string[] | undefined,
    skepticismModifier: skepticismModifier ?? undefined,
    ego_development_level: egoExtracted ?? undefined,
  };
}

function userSliceWordCountFromStoredMoment(raw: unknown): number | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const w = (raw as Record<string, unknown>).user_slice_word_count;
  return typeof w === 'number' && Number.isFinite(w) && w >= 0 ? w : null;
}

function disclosureCalibrationFromTranscriptAndPatterns(
  transcript: Transcript,
  patterns: Record<string, unknown> | null | undefined,
): DisclosureCalibration {
  const tx = transcript as unknown as DisclosureCalibrationTurn[];
  const m4o = patterns?.moment_4_scores;
  const m5o = patterns?.moment_5_scores;
  const m4c =
    m4o != null && typeof m4o === 'object' && !Array.isArray(m4o)
      ? normalizeMoment4Concreteness((m4o as Record<string, unknown>).response_concreteness)
      : null;
  const m5c =
    m5o != null && typeof m5o === 'object' && !Array.isArray(m5o)
      ? normalizeResponseConcreteness((m5o as Record<string, unknown>).response_concreteness)
      : null;
  const s4 = sumUserWordsForInterviewMoment(tx, 4);
  const s5 = sumUserWordsForInterviewMoment(tx, 5);
  const w4 = userSliceWordCountFromStoredMoment(m4o) ?? (s4 > 0 ? s4 : null);
  const w5 = userSliceWordCountFromStoredMoment(m5o) ?? (s5 > 0 ? s5 : null);
  const avgScenarioRaw = computeAvgScenarioTotalUserWords(tx);
  const avgScenarioForCalibration = avgScenarioRaw > 0 ? avgScenarioRaw : null;
  return computeDisclosureCalibration(m4c, m5c, w4, w5, avgScenarioForCalibration, tx);
}

function getAnthropicEndpoint(): string {
  const proxy = Deno.env.get('ANTHROPIC_PROXY_URL') ?? '';
  return proxy && proxy.length > 0 ? proxy : 'https://api.anthropic.com/v1/messages';
}

function scenarioScoresFromAttempt(
  s1: unknown,
  s2: unknown,
  s3: unknown
): Record<number, { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined> {
  const out: Record<
    number,
    { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined
  > = {};
  ([1, 2, 3] as const).forEach((n) => {
    const raw = n === 1 ? s1 : n === 2 ? s2 : s3;
    if (!raw || typeof raw !== 'object') return;
    const o = raw as {
      pillarScores?: Record<string, number | null>;
      pillar_scores?: Record<string, number | null>;
      scenarioName?: string;
    };
    const ps = o.pillarScores ?? o.pillar_scores;
    if (!ps || typeof ps !== 'object') return;
    out[n] = { pillarScores: ps, scenarioName: o.scenarioName };
  });
  return out;
}

function toNumericPillarMap(scores: Record<string, number | null | undefined> | undefined | null): Record<string, number> {
  const out: Record<string, number> = {};
  if (!scores) return out;
  for (const [k, v] of Object.entries(scores)) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

/** Balanced `{ ... }` from a known `{` index (handles strings and escapes). */
function extractBalancedJsonObjectFrom(s: string, start: number): string | null {
  if (s[start] !== '{') return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i]!;
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (c === '\\') {
        escape = true;
        continue;
      }
      if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function tryExtractEgoLevelFromHolisticRawTextEdge(raw: string): number | null {
  const patterns: RegExp[] = [
    /"ego_development_level"\s*:\s*([1-5](?:\.\d+)?)\b/g,
    /"egoDevelopmentLevel"\s*:\s*([1-5](?:\.\d+)?)\b/g,
    /ego\s*development\s*level\s*[:=]\s*([1-5])\b/gi,
  ];
  let last: number | null = null;
  for (const re of patterns) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(raw)) !== null) {
      const n = normalizeHolisticEgoLevelEdge(Number(m[1]));
      if (n != null) last = n;
    }
  }
  return last;
}

/**
 * Prose before JSON ("Looking at…") or multiple `{` regions (embedded snippets). Try whole string,
 * then each balanced `{...}` from left to right. When several objects parse, prefer one with a valid
 * `ego_development_level` and fuller `pillarScores` (matches client `coerceHolisticInterviewModelObject` behavior).
 */
function parseHolisticJsonFromModelText(raw: string): { ok: true; parsed: InterviewResults } | { ok: false; error: string } {
  const cleaned = raw.replace(/```json|```/gi, '').trim();
  const objectAttempts: Record<string, unknown>[] = [];
  let lastErr = 'no JSON object found in model output (expected { … })';

  const pushParsed = (obj: unknown) => {
    if (obj != null && typeof obj === 'object' && !Array.isArray(obj)) {
      objectAttempts.push(coerceHolisticInterviewModelObject(obj));
    }
  };

  try {
    pushParsed(JSON.parse(cleaned));
  } catch {
    /* fall through */
  }

  let searchFrom = 0;
  const maxTries = 100;
  for (let t = 0; t < maxTries; t++) {
    const start = cleaned.indexOf('{', searchFrom);
    if (start < 0) break;
    const extracted = extractBalancedJsonObjectFrom(cleaned, start);
    if (!extracted) {
      searchFrom = start + 1;
      continue;
    }
    try {
      pushParsed(JSON.parse(extracted));
    } catch (e) {
      lastErr = e instanceof Error ? e.message : String(e);
    }
    searchFrom = start + 1;
  }

  const seen = new Set<string>();
  const unique: Record<string, unknown>[] = [];
  for (const c of objectAttempts) {
    const sig = JSON.stringify(c);
    if (seen.has(sig)) continue;
    seen.add(sig);
    unique.push(c);
  }

  if (unique.length === 0) {
    return { ok: false, error: lastErr };
  }

  const rankCoercedHolisticCandidate = (coerced: Record<string, unknown>): number => {
    const ego = extractEgoDevelopmentLevelEdge(coerced);
    const ps = coerced.pillarScores;
    const nPillars =
      ps != null && typeof ps === 'object' && !Array.isArray(ps) ? Object.keys(ps as Record<string, unknown>).length : 0;
    return (ego != null ? 1000 : 0) + nPillars;
  };

  let bestCoerced = unique[0]!;
  let bestRank = rankCoercedHolisticCandidate(bestCoerced);
  for (let i = 1; i < unique.length; i++) {
    const c = unique[i]!;
    const r = rankCoercedHolisticCandidate(c);
    if (r > bestRank) {
      bestRank = r;
      bestCoerced = c;
    }
  }

  let bestForNormalize = bestCoerced;
  if (extractEgoDevelopmentLevelEdge(bestCoerced) == null) {
    const salvaged = tryExtractEgoLevelFromHolisticRawTextEdge(raw);
    if (salvaged != null) {
      bestForNormalize = { ...bestCoerced, ego_development_level: salvaged };
    }
  }

  console.log('[EdgeEgoDev] holistic parsed keys:', Object.keys(bestForNormalize));
  console.log('[EdgeEgoDev] parsed.ego_development_level raw value:', bestForNormalize.ego_development_level);
  console.log('[EdgeEgoDev] typeof ego_development_level:', typeof bestForNormalize.ego_development_level);

  return { ok: true, parsed: normalizeHolisticInterviewParse(bestForNormalize) };
}

export type CompleteStandardInterviewResult =
  | {
      ok: true;
      attemptId: string;
      skipped?: string;
      /** Run via `EdgeRuntime.waitUntil` in the edge handler (reasoning + communication style). */
      runPostCompletionInBackground?: () => Promise<void>;
    }
  | { ok: false; error: string };

/** Matches admin-retry-ai-reasoning background budget (Tab 2 retry succeeds with this). */
const STANDARD_REASONING_BACKGROUND_TIMEOUT_MS = 300_000;

type ReasoningBackgroundInputs = {
  pillarForReasoning: Record<string, number>;
  scenarioMap: Record<
    number,
    { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined
  >;
  transcript: Transcript;
  weightedScore: number | null;
  pass: boolean;
  evidenceContext?: NarrativeEvidenceContext | null;
};

async function runStandardInterviewReasoningInBackground(
  supabase: SupabaseClient,
  attemptId: string,
  userId: string,
  inputs: ReasoningBackgroundInputs,
): Promise<void> {
  const startedAt = Date.now();
  console.log(`[narrative] Starting for attempt ${attemptId} (source=complete-standard-interview-background)`);
  try {
    console.log(`[narrative] Attempt ${attemptId} fetched, calling model`);
    const reasoning = await generateAIReasoning(
      inputs.pillarForReasoning,
      inputs.scenarioMap,
      inputs.transcript,
      inputs.weightedScore,
      inputs.pass,
      [],
      {
        perAttemptTimeoutMs: STANDARD_REASONING_BACKGROUND_TIMEOUT_MS,
        maxAttempts: 4,
        evidenceContext: inputs.evidenceContext,
      },
    );
    if (!reasoning || typeof reasoning !== 'object') {
      const error = 'model_returned_null';
      console.error(`[narrative] Model returned null for attempt ${attemptId}`);
      throw new Error(error);
    }
    console.log(`[narrative] Model returned response, writing to DB for attempt ${attemptId}`);
    const { error } = await supabase
      .from('interview_attempts')
      .update({
        ai_reasoning: reasoning as unknown as Record<string, unknown>,
        reasoning_pending: false,
      })
      .eq('id', attemptId)
      .eq('user_id', userId);
    if (error) {
      console.error(`[narrative] DB write failed for attempt ${attemptId}:`, error.message);
      try {
        await supabase
          .from('interview_attempts')
          .update({
            ai_reasoning: reasoning as unknown as Record<string, unknown>,
            reasoning_pending: false,
          })
          .eq('id', attemptId)
          .eq('user_id', userId);
        console.log('[narrative] save retry succeeded after initial failure');
      } catch (retryErr) {
        console.error('[narrative] save retry failed:', retryErr);
      }
    } else {
      console.log(`[narrative] Completed successfully for attempt ${attemptId}`, {
        elapsed_ms: Date.now() - startedAt,
      });
    }
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    if (error.includes('aborted') || (e instanceof Error && e.name === 'AbortError')) {
      console.error('[narrative] AbortError on background reasoning:', error);
    }
    console.error(`[narrative] Unhandled error for attempt ${attemptId}:`, e);
    await supabase
      .from('interview_attempts')
      .update({
        ai_reasoning: {
          _reasoningPending: false,
          _narrativeFailed: true,
          pillar_scores: inputs.pillarForReasoning,
          weighted_score: inputs.weightedScore,
          passed: inputs.pass,
          note: 'Narrative AI reasoning failed or timed out; scores saved.',
          last_error: error,
          failed_at: new Date().toISOString(),
          _failedAt: new Date().toISOString(),
        },
        reasoning_pending: false,
      })
      .eq('id', attemptId)
      .eq('user_id', userId);
  }
}

/** Await text + audio finalize so style labels exist before the edge handler returns. */
async function awaitCommunicationStylePipelines(
  userId: string,
  attemptId: string,
): Promise<void> {
  const baseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
  if (!baseUrl || (!serviceKey && !anonKey)) {
    console.warn('[complete-standard-interview] communication style skipped — missing Supabase env');
    return;
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${serviceKey || anonKey}`,
    apikey: anonKey || serviceKey,
  };
  const errs: string[] = [];
  try {
    const textRes = await fetch(`${baseUrl}/functions/v1/analyze-interview-text`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ user_id: userId, attempt_id: attemptId }),
    });
    if (!textRes.ok) {
      errs.push(`analyze-interview-text: HTTP ${textRes.status} ${(await textRes.text()).slice(0, 200)}`);
    }
  } catch (e) {
    errs.push(`analyze-interview-text: ${e instanceof Error ? e.message : String(e)}`);
  }
  try {
    const audioRes = await fetch(`${baseUrl}/functions/v1/analyze-interview-audio`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'finalize_session',
        user_id: userId,
        attempt_id: attemptId,
        session_id: '',
      }),
    });
    if (!audioRes.ok) {
      errs.push(`analyze-interview-audio: HTTP ${audioRes.status} ${(await audioRes.text()).slice(0, 200)}`);
    }
  } catch (e) {
    errs.push(`analyze-interview-audio: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (errs.length > 0) {
    console.error('[complete-standard-interview] communication style pipeline errors', { attemptId, errs });
    await createClient(baseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
      .from('interview_attempts')
      .update({ communication_style_error: errs.join(' | ') })
      .eq('id', attemptId)
      .eq('user_id', userId)
      .then(({ error }) => {
        if (error) console.error('[complete-standard-interview] communication_style_error update failed', error.message);
      });
  } else {
    console.log('[complete-standard-interview] communication style pipeline ok', { attemptId });
  }
}

/**
 * @param supabase -- service-role client
 * @param userId -- must match row.user_id (already verified by caller)
 */
export async function runCompleteStandardInterview(
  supabase: SupabaseClient,
  attemptId: string,
  userId: string
): Promise<CompleteStandardInterviewResult> {
  console.log('[CompletionPath] edge function completeStandardInterviewCore called for attempt:', attemptId);
  const { data: row, error: qErr } = await supabase
    .from('interview_attempts')
    .select(
      'id, user_id, scoring_deferred, transcript, interview_typology_context, scenario_1_scores, scenario_2_scores, scenario_3_scores, scenario_specific_patterns, response_timings, probe_log, emotion_recognition_responses, emotion_recognition_raw_score, emotion_recognition_score, skip_penalty_total, auto_failed, moment_4_concreteness, moment_5_concreteness, ego_development_level, mentalizing_overcertainty_count, defense_patterns, disclosure_calibration, personal_moment_emotional_vocab_low, personal_moment_emotional_vocab_density, depth_signal_modifier, score_modifier, modified_weighted_score'
    )
    .eq('id', attemptId)
    .maybeSingle();

  if (qErr || !row) {
    return { ok: false, error: qErr?.message ?? 'attempt not found' };
  }
  if (row.user_id !== userId) {
    return { ok: false, error: 'attempt user mismatch' };
  }
  if (row.scoring_deferred !== true) {
    return { ok: true, attemptId, skipped: 'not_deferred' };
  }

  const transcript = (row.transcript as Transcript | null) ?? [];
  if (transcript.length === 0) {
    return { ok: false, error: 'empty transcript' };
  }

  const patterns = (row as { scenario_specific_patterns?: Record<string, unknown> | null }).scenario_specific_patterns;
  /** `moment_4_scores` is produced by client Moment 4 scoring (`AriaScreen` + `probeAndScoringUtils`); this edge path reads stored JSON only — no duplicate M4 model parse here. */
  const moment4Stored = patterns?.moment_4_scores ?? null;
  if (Deno.env.get('INTERVIEW_DEBUG_M4') === '1') {
    const m4o = moment4Stored as Record<string, unknown> | null;
    console.log('[M4 Debug] edge deferred completion — moment_4_scores:', {
      present: m4o != null,
      keys: m4o && typeof m4o === 'object' && !Array.isArray(m4o) ? Object.keys(m4o) : [],
    });
  }
  const completionGate = evaluateInterviewCompletionGate({
    scenario1: row.scenario_1_scores,
    scenario2: row.scenario_2_scores,
    scenario3: row.scenario_3_scores,
    moment4: moment4Stored,
  });

  if (!completionGate.ok) {
    const errIns = await markAttemptIncompleteNoScore(supabase, attemptId, userId, completionGate);
    if (errIns) return { ok: false, error: errIns };
    return { ok: true, attemptId, skipped: 'completion_gate_incomplete' };
  }

  // Two separate `users` reads must use distinct binding names (Deno rejects duplicate `userRow` in one scope).
  const { data: userWeights } = await supabase
    .from('users')
    .select('referral_boost_active')
    .eq('id', userId)
    .maybeSingle();
  const weightedMin =
    userWeights?.referral_boost_active === true ? REFERRAL_WEIGHTED_PASS_MIN : GATE_PASS_WEIGHTED_MIN;

  const typology = (row as { interview_typology_context?: string | null }).interview_typology_context ?? '';
  const userPrompt = buildScoringPrompt(
    transcript.map((m) => ({ role: m.role, content: m.content ?? '' })),
    typology || 'No typology context — score from transcript only.'
  );

  const apiUrl = getAnthropicEndpoint();
  const useProxy = apiUrl !== 'https://api.anthropic.com/v1/messages';
  if (useProxy) {
    if (!(Deno.env.get('SUPABASE_ANON_KEY') ?? '').trim()) {
      return {
        ok: false,
        error:
          'Set SUPABASE_ANON_KEY in Edge Function secrets (needed when ANTHROPIC_PROXY_URL is set) or set ANTHROPIC_API_KEY for direct Anthropic',
      };
    }
  } else {
    if (!(Deno.env.get('ANTHROPIC_API_KEY') ?? '').trim()) {
      return {
        ok: false,
        error:
          'ANTHROPIC_API_KEY is not set in this project (Edge Function secrets) — add it, or set ANTHROPIC_PROXY_URL to the anthropic-proxy function URL',
      };
    }
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useProxy) {
    const anon = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    if (anon) headers['Authorization'] = `Bearer ${anon}`;
  } else {
    const key = Deno.env.get('ANTHROPIC_API_KEY') ?? '';
    headers['x-api-key'] = key;
    headers['anthropic-version'] = '2023-06-01';
  }

  const abort = new AbortController();
  const t = setTimeout(() => abort.abort(), HOLISTIC_FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(apiUrl, {
      method: 'POST',
      headers,
      signal: abort.signal,
      body: JSON.stringify({
        model: CLAUDE_SONNET_MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    });
  } finally {
    clearTimeout(t);
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return { ok: false, error: `holistic: HTTP ${res.status} (non-JSON error body from API)` };
  }
  if (!res.ok) {
    const msg = (data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`;
    return { ok: false, error: `holistic: ${msg}` };
  }
  const raw = (data as { content?: Array<{ text?: string }> }).content?.[0]?.text ?? '{}';
  const holisticParse = parseHolisticJsonFromModelText(raw);
  if (!holisticParse.ok) {
    return { ok: false, error: `parse holistic: ${holisticParse.error}` };
  }
  const parsed = holisticParse.parsed;

  const scenarioMap = scenarioScoresFromAttempt(
    row.scenario_1_scores,
    row.scenario_2_scores,
    row.scenario_3_scores
  );
  const scenarioPillarScoresByScenario: Partial<
    Record<1 | 2 | 3, Record<string, number | null | undefined>>
  > = {};
  for (const n of [1, 2, 3] as const) {
    const ps = scenarioMap[n]?.pillarScores;
    if (ps && typeof ps === 'object') scenarioPillarScoresByScenario[n] = ps;
  }

  const rowTyped = row as Record<string, unknown>;
  const markerSlices = markerSlicesFromAttemptRow(row);
  const existingEgo = finiteNumberOrNull(rowTyped.ego_development_level);
  const holisticEgo = extractEgoDevelopmentLevelEdge(parsed as Record<string, unknown>) ?? existingEgo;
  const p = patterns as Record<string, unknown> | null | undefined;
  const m4StoredObj = p?.moment_4_scores;
  const m5StoredObj = p?.moment_5_scores;

  const aggregatedResult = aggregatePillarScoresWithCommitmentMergeDetailed(markerSlices, {
    egoDevelopmentLevel: holisticEgo,
    defensePatternTranscript: transcript,
    disclosureCalibrationTranscript: transcript as unknown as DisclosureCalibrationTurn[],
  });

  const disclosureCalibrationForAttempt =
    aggregatedResult.disclosureCalibration ??
    disclosureCalibrationFromTranscriptAndPatterns(
      transcript,
      patterns as Record<string, unknown> | null | undefined,
    ) ??
    (typeof rowTyped.disclosure_calibration === 'string' ? rowTyped.disclosure_calibration : null);

  const egoLevelForAttempt = aggregatedResult.egoDevelopmentLevel ?? holisticEgo ?? existingEgo;
  const moment4ConcretenessForAttempt =
    mergeMomentConcretenessForGate(m4StoredObj, rowTyped.moment_4_concreteness) ??
    aggregatedResult.moment4Concreteness;
  const moment5ConcretenessForAttempt =
    mergeMomentConcretenessForGate(m5StoredObj, rowTyped.moment_5_concreteness) ??
    aggregatedResult.moment5Concreteness;
  const mentalizingOvercertaintyCountForAttempt = aggregatedResult.mentalizingOvercertaintyCount ?? 0;
  const defensePatternsForAttempt = normalizeDefensePatternsForPersist(aggregatedResult.defensePatterns);

  const emotionRow = row as {
    emotion_recognition_score?: unknown;
    emotion_recognition_raw_score?: unknown;
    emotion_recognition_responses?: unknown;
  };
  const emotionPersistFields = emotionRecognitionPersistFieldsFromRow(emotionRow);
  const emotionRawScoreForAttempt = emotionRecognitionRawScoreFromRow(emotionRow);
  const emotionScoreForAttempt = emotionRecognitionDisplayScoreFromRow(emotionRow);
  const emotionResponsesForAttempt = emotionRow.emotion_recognition_responses ?? null;

  console.log('[EdgeFunction] depth signal extraction:', {
    egoLevel: egoLevelForAttempt,
    m4: moment4ConcretenessForAttempt,
    m5: moment5ConcretenessForAttempt,
    erRaw: emotionRawScoreForAttempt,
    overcertainty: mentalizingOvercertaintyCountForAttempt,
    disclosure: disclosureCalibrationForAttempt,
  });

  const rowSkip = row as { skip_penalty_total?: unknown; auto_failed?: unknown };
  const skipPenaltyTotal =
    typeof rowSkip.skip_penalty_total === 'number' && Number.isFinite(rowSkip.skip_penalty_total)
      ? rowSkip.skip_penalty_total
      : 0;
  const skipAutoFail = rowSkip.auto_failed === true;
  console.log('[Disclosure] persisting disclosure_calibration:', disclosureCalibrationForAttempt);
  const closingIntegrationRaw = (row as Record<string, unknown>).closing_integration;
  const closingIntegrationForGate =
    typeof closingIntegrationRaw === 'string' && closingIntegrationRaw.trim() !== ''
      ? closingIntegrationRaw.trim()
      : null;

  const precomputedWeighted = computeInterviewWeightedCompositeFromPillars(
    aggregatedResult.scores,
    parsed.skepticismModifier ?? null,
    skipPenaltyTotal,
    skipAutoFail,
  );

  const rowDepthModifier = finiteNumberOrNull(rowTyped.depth_signal_modifier);
  const rowScoreModifier = finiteNumberOrNull(rowTyped.score_modifier);
  const rowModifiedWeighted = finiteNumberOrNull(rowTyped.modified_weighted_score);
  console.log('[BaseScore] passing precomputedWeightedScore:', precomputedWeighted);

  console.log('[EdgeGate] full options check:', {
    egoLevel: egoLevelForAttempt,
    m4: moment4ConcretenessForAttempt,
    m5: moment5ConcretenessForAttempt,
    erRaw: emotionRawScoreForAttempt,
    overcertainty: mentalizingOvercertaintyCountForAttempt,
    disclosure: disclosureCalibrationForAttempt,
  });
  const personalWordCounts = personalMomentWordCountsForDisclosure(markerSlices, transcript);
  const pillarScoresForGate: Record<string, number> =
    Object.keys(aggregatedResult.scores).length > 0
      ? { ...aggregatedResult.scores }
      : { ...((parsed.pillarScores ?? {}) as Record<string, number>) };
  const pillarScoresForPersist =
    Object.keys(aggregatedResult.scores).length > 0 ? aggregatedResult.scores : (parsed.pillarScores ?? null);
  console.log('[rollup] Computing scenario composites and gate for attempt', attemptId);
  const gate = computeGateResultCore(pillarScoresForGate, parsed.skepticismModifier ?? null, {
    weightedPassMin: weightedMin,
    scenarioPillarScoresByScenario,
    skipPenaltyTotal,
    skipAutoFail,
    egoDevelopmentLevel: egoLevelForAttempt,
    defensePatterns: defensePatternsForAttempt,
    moment4Concreteness: moment4ConcretenessForAttempt ?? null,
    moment5Concreteness: moment5ConcretenessForAttempt ?? null,
    disclosureCalibration: disclosureCalibrationForAttempt,
    moment4WordCount: personalWordCounts.moment4WordCount,
    moment5WordCount: personalWordCounts.moment5WordCount,
    emotionRecognitionRawScore: emotionRawScoreForAttempt,
    emotionRecognitionResponses: emotionResponsesForAttempt,
    mentalizingOvercertaintyCount: mentalizingOvercertaintyCountForAttempt,
    ...(closingIntegrationForGate != null ? { closingIntegration: closingIntegrationForGate } : {}),
    moment4AccountabilitySituationallyExempt: aggregatedResult.moment4AccountabilitySituationallyExempt === true,
    moment4AccountabilityExemptReason: aggregatedResult.moment4AccountabilityExemptReason ?? null,
    ...(typeof precomputedWeighted === 'number' && Number.isFinite(precomputedWeighted)
      ? { precomputedWeightedScore: precomputedWeighted }
      : {}),
  });
  console.log('[rollup] Gate result', {
    attemptId,
    pass: gate.pass,
    weightedScore: gate.weightedScore,
    scenarioComposites: gate.scenarioComposites ?? null,
    gateFailReasons: gate.failReasonCodes ?? [],
  });
  console.log('[EdgeEgoDev] final ego_development_level to persist:', egoLevelForAttempt);
  console.log('[EdgeGate] scoreModifier:', gate.scoreModifier, 'modifiedScore:', gate.modifiedWeightedScore);
  if (egoLevelForAttempt == null) {
    console.warn('[EdgeEgoDev] ego_development_level still null after coercion and candidate ranking');
  }

  const { data: userPsych } = await supabase
    .from('users')
    .select(
      'psychometric_straight_line_flags, psychometrics_gasp_score, psychometrics_aaq2_score, psychometrics_brs_score, psychometrics_rses_score, psychometrics_scs_sf_score, psychometrics_dweck_score, psychometrics_sd3_narcissism_score, psychometrics_rfq_score',
    )
    .eq('id', userId)
    .maybeSingle();

  const dpRaw = defensePatternsForAttempt as Record<string, unknown> | null;
  const preCrossRefDepthModifier = gate.depthSignalModifier ?? gate.scoreModifier ?? 0;
  const defenseCrossReference = buildDefenseCrossReferenceForAttempt({
    defensePatterns: dpRaw,
    userPsychometrics: userPsych as Record<string, unknown> | null | undefined,
    depthSignalModifierApplied: preCrossRefDepthModifier,
  });
  const crossRefAdjustedDepthModifier =
    Math.round((preCrossRefDepthModifier + defenseCrossReference.modifierAdjustment) * 100) / 100;
  const crossRefAdjustedModifiedWeighted =
    gate.modifiedWeightedScore != null && Number.isFinite(gate.modifiedWeightedScore)
      ? Math.round((gate.modifiedWeightedScore + defenseCrossReference.modifierAdjustment) * 100) / 100
      : gate.modifiedWeightedScore;
  const reviewFlagsForPersist = [...(gate.reviewFlags ?? [])];
  if (defenseCrossReference.recommendAdminReview) {
    reviewFlagsForPersist.push(...defenseCrossReference.flags.map((f) => f.flagName));
  }
  console.log('[DefenseCrossRef] result:', {
    overallConfidence: defenseCrossReference.overallConfidence,
    modifierAdjustment: defenseCrossReference.modifierAdjustment,
    recommendAdminReview: defenseCrossReference.recommendAdminReview,
    flagCount: defenseCrossReference.flags.length,
  });
  const pillarForReasoning = toNumericPillarMap(
    (pillarScoresForPersist ?? parsed.pillarScores) as Record<string, number | null>,
  );
  const reasoningBackgroundInputs: ReasoningBackgroundInputs = {
    pillarForReasoning,
    scenarioMap,
    transcript,
    weightedScore: gate.weightedScore,
    pass: gate.pass,
    evidenceContext: buildEvidenceContextFromAttemptPatterns(
      patterns as Record<string, unknown> | null | undefined,
      {
        scenario_1_scores: row.scenario_1_scores,
        scenario_2_scores: row.scenario_2_scores,
        scenario_3_scores: row.scenario_3_scores,
      },
    ),
  };
  const commFloor = communicationFloorFieldsFromTranscript(transcript);
  /** Narrative runs in background (300s) via EdgeRuntime.waitUntil — sync 140s calls routinely timed out. */
  const aiReasoningOut: Record<string, unknown> = {
    _reasoningPending: true,
    pillar_scores: pillarForReasoning,
    weighted_score: gate.weightedScore,
    passed: gate.pass,
    note: 'Narrative generation queued after scoring.',
    _queuedAt: new Date().toISOString(),
  };

  console.log('[Modifier] persisting score_modifier:', gate.scoreModifier, 'modified_weighted_score:', gate.modifiedWeightedScore);
  const wEdge = gate.weightedScore;
  const smEdge = gate.scoreModifier ?? 0;
  const actualModEdge = gate.modifiedWeightedScore;
  console.log('[ModifierBase] weighted_score being persisted:', wEdge);
  console.log('[ModifierBase] modified_weighted_score being persisted:', actualModEdge);
  console.log('[ModifierBase] score_modifier being persisted:', smEdge);
  if (wEdge != null && Number.isFinite(wEdge) && actualModEdge != null && Number.isFinite(actualModEdge)) {
    const expectedModEdge = Math.round((wEdge + smEdge) * 100) / 100;
    console.log('[ModifierBase] invariant check — expected:', expectedModEdge, 'actual:', actualModEdge);
    if (Math.abs(expectedModEdge - actualModEdge) > 0.01) {
      console.error('[ModifierBase] MISMATCH — expected:', expectedModEdge, 'actual:', actualModEdge);
    } else {
      console.log('[ModifierBase] modifier invariant holds:', actualModEdge);
    }
  }
  console.log('[ReviewFlags] persisting review_flags:', reviewFlagsForPersist);

  const moment4ConcretenessPersist = moment4ConcretenessForAttempt;
  const moment5ConcretenessPersist = moment5ConcretenessForAttempt;
  const existingMentalizingCount = finiteNumberOrNull(rowTyped.mentalizing_overcertainty_count) ?? 0;
  const existingDisclosure =
    typeof rowTyped.disclosure_calibration === 'string' ? rowTyped.disclosure_calibration : null;
  const persistedDepthModifier =
    pickPersistedNumber(crossRefAdjustedDepthModifier, rowDepthModifier) ?? 0;
  const persistedScoreModifier =
    pickPersistedNumber(crossRefAdjustedDepthModifier, rowScoreModifier) ?? persistedDepthModifier;
  const persistedModifiedWeighted =
    pickPersistedNumber(
      crossRefAdjustedModifiedWeighted,
      rowModifiedWeighted ??
        (typeof precomputedWeighted === 'number' && Number.isFinite(precomputedWeighted)
          ? precomputedWeighted + persistedDepthModifier
          : null),
    ) ??
    gate.weightedScore ??
    null;
  const emotionRawPersist = emotionPersistFields.rawCount;
  const emotionDisplayPersist = emotionPersistFields.displayPercent;

  console.log('[ScorePipeline] existing patterns before scoring:', {
    hasM4: patterns?.moment_4_scores != null,
    hasM5: patterns?.moment_5_scores != null,
    egoDevLevel: existingEgo,
  });

  const { error: incrementalHolisticErr } = await supabase
    .from('interview_attempts')
    .update({
      ego_development_level: egoLevelForAttempt ?? existingEgo,
      mentalizing_overcertainty_count:
        mentalizingOvercertaintyCountForAttempt ?? existingMentalizingCount,
      defense_patterns: defensePatternsForAttempt,
      disclosure_calibration: disclosureCalibrationForAttempt ?? existingDisclosure,
      moment_4_concreteness: moment4ConcretenessPersist ?? rowTyped.moment_4_concreteness ?? null,
      moment_5_concreteness: moment5ConcretenessPersist ?? rowTyped.moment_5_concreteness ?? null,
      personal_moment_emotional_vocab_density: null,
      personal_moment_emotional_vocab_low: false,
      depth_signal_modifier: persistedDepthModifier,
      score_modifier: persistedScoreModifier,
      modified_weighted_score: persistedModifiedWeighted,
      defense_cross_reference: defenseCrossReference,
      emotion_recognition_raw_score: emotionRawPersist,
      emotion_recognition_score: emotionDisplayPersist,
    })
    .eq('id', attemptId)
    .eq('user_id', userId);
  if (incrementalHolisticErr) {
    console.error('[Holistic Persist] edge incremental save failed:', incrementalHolisticErr.message);
    const { error: crossRefOnlyErr } = await supabase
      .from('interview_attempts')
      .update({ defense_cross_reference: defenseCrossReference })
      .eq('id', attemptId)
      .eq('user_id', userId);
    if (crossRefOnlyErr) {
      console.error('[DefenseCrossRef] isolated persist after holistic failure:', crossRefOnlyErr.message);
    }
  } else {
    console.log('[Holistic Persist] holistic scores persisted immediately — ego dev:', egoLevelForAttempt);
  }

  console.log('[rollup] Writing rollup fields to DB for attempt', attemptId);
  const { error: upA } = await supabase
    .from('interview_attempts')
    .update({
      completed_at: new Date().toISOString(),
      weighted_score: gate.weightedScore,
      passed: gate.pass,
      gate_fail_reasons: gate.failReasonCodes ?? [],
      gate_fail_detail: normalizeGateFailDetailForPersist(gate.failReasonDetail),
      scenario_composites: scenarioCompositesToStorageJson(gate.scenarioComposites),
      pillar_scores: pillarScoresForPersist,
      /** Preserve client-written slices; holistic output does not include per-scenario JSON. */
      scenario_1_scores: row.scenario_1_scores,
      scenario_2_scores: row.scenario_2_scores,
      scenario_3_scores: row.scenario_3_scores,
      ai_reasoning: aiReasoningOut,
      reasoning_pending: true,
      scoring_deferred: false,
      response_timings: row.response_timings,
      probe_log: row.probe_log,
      communication_floor_flag: commFloor.communication_floor_flag,
      communication_floor_avg_unprompted_words: commFloor.communication_floor_avg_unprompted_words,
      ego_development_level: egoLevelForAttempt ?? existingEgo,
      review_flags: reviewFlagsForPersist,
      depth_signal_modifier: persistedDepthModifier,
      score_modifier: persistedScoreModifier,
      modified_weighted_score: persistedModifiedWeighted,
      disclosure_calibration: disclosureCalibrationForAttempt ?? existingDisclosure,
      mentalizing_overcertainty_count:
        mentalizingOvercertaintyCountForAttempt ?? existingMentalizingCount,
      defense_patterns: defensePatternsForAttempt,
      defense_cross_reference: defenseCrossReference,
      moment_4_concreteness: moment4ConcretenessPersist ?? rowTyped.moment_4_concreteness ?? null,
      moment_5_concreteness: moment5ConcretenessPersist ?? rowTyped.moment_5_concreteness ?? null,
      personal_moment_emotional_vocab_density: null,
      personal_moment_emotional_vocab_low: false,
      emotion_recognition_raw_score: emotionRawPersist,
      emotion_recognition_score: emotionDisplayPersist,
      emotion_recognition_responses: emotionResponsesForAttempt,
    })
    .eq('id', attemptId)
    .eq('user_id', userId);

  if (upA) {
    return { ok: false, error: upA.message };
  }
  console.log('[rollup] Rollup persist complete for attempt', attemptId, {
    scenario_composites: scenarioCompositesToStorageJson(gate.scenarioComposites),
    gate_fail_reasons: gate.failReasonCodes ?? [],
    defense_cross_reference: defenseCrossReference != null,
  });

  // Atomic verify + backfill any fields the main write missed (never fire-and-forget).
  const fullRollup = await markScoringStageComplete(supabase, attemptId, userId, 'moment5', {
    force: true,
    trigger: 'completeStandardInterviewCore:holistic_complete',
    overrides: {
      scenario_composites: scenarioCompositesToStorageJson(gate.scenarioComposites),
      gate_fail_reasons: gate.failReasonCodes ?? [],
      defense_patterns: defensePatternsForAttempt,
      defense_cross_reference: defenseCrossReference,
      ego_development_level: egoLevelForAttempt ?? existingEgo,
      disclosure_calibration: disclosureCalibrationForAttempt ?? existingDisclosure,
      personal_moment_emotional_vocab_density: null,
      personal_moment_emotional_vocab_low: false,
      depth_signal_modifier: persistedDepthModifier,
      score_modifier: persistedScoreModifier,
      modified_weighted_score: persistedModifiedWeighted,
    },
  });
  console.log('[rollup] Full rollup verify for attempt', attemptId, {
    ok: fullRollup.ok,
    verified: fullRollup.verified,
    skipped: fullRollup.skipped ?? null,
    error: fullRollup.error ?? null,
  });

  await applyPsychometricModifierToAttempt(supabase, userId, attemptId);

  const { data: userOverride } = await supabase
    .from('users')
    .select('interview_passed_admin_override')
    .eq('id', userId)
    .maybeSingle();
  const o = (userOverride as { interview_passed_admin_override?: boolean | null } | null)
    ?.interview_passed_admin_override;
  const effectivePass = o === true || o === false ? o : gate.pass;

  const { error: upU } = await supabase
    .from('users')
    .update({
      interview_completed: true,
      interview_passed_computed: gate.pass,
      interview_passed: effectivePass,
    })
    .eq('id', userId);

  if (upU) {
    return { ok: false, error: upU.message };
  }

  const runPostCompletionInBackground = async (): Promise<void> => {
    await Promise.all([
      runStandardInterviewReasoningInBackground(supabase, attemptId, userId, reasoningBackgroundInputs),
      awaitCommunicationStylePipelines(userId, attemptId),
    ]);
  };

  return { ok: true, attemptId, runPostCompletionInBackground };
}
