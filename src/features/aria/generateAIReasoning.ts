/**
 * Alpha-only: Generate detailed AI reasoning for interview results.
 * Calls Claude to produce structured explanation of scores. Remove before production.
 */

const ANTHROPIC_API_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ANTHROPIC_API_KEY) || '';
const ANTHROPIC_PROXY_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ANTHROPIC_PROXY_URL) || '';
function getAnthropicEndpoint(): string {
  return ANTHROPIC_PROXY_URL || 'https://api.anthropic.com/v1/messages';
}
const SUPABASE_ANON_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY) || '';

export type AIReasoningRequestFailureKind = 'aborted' | 'network' | 'http' | 'parse' | 'unknown';

/** Set on the thrown `Error` when our per-attempt `AbortController` timer fired (vs browser-aborted request). */
export const AI_REASONING_LOCAL_TIMEOUT = '__aiReasoningLocalTimeout' as const;

export type AIReasoningErrorClassification = {
  kind: AIReasoningRequestFailureKind;
  message: string;
  name?: string;
  status?: number;
  /** Our explicit fetch timeout (Abort after N ms). */
  isClientRequestTimeout: boolean;
  /** Browser-side: "Failed to fetch", Safari "Load failed", RN "Network request failed", etc. */
  isBrowserLevelNetworkFailure: boolean;
};

const httpClassification = (status: number): AIReasoningErrorClassification => ({
  kind: 'http',
  message: `HTTP ${status}`,
  status,
  isClientRequestTimeout: false,
  isBrowserLevelNetworkFailure: false,
});

/**
 * Distinguish: (1) our client timeout, (2) browser network failures, (3) HTTP, (4) parse, (5) other.
 * AbortError from Safari/browser killing the socket after load is *not* tagged with `__aiReasoningLocalTimeout`.
 */
export function classifyAIReasoningRequestError(
  e: unknown,
  response: Response | null,
  opts?: { localTimerAbort?: boolean }
): AIReasoningErrorClassification {
  const markedLocal =
    e &&
    typeof e === 'object' &&
    (e as Record<string, unknown>)[AI_REASONING_LOCAL_TIMEOUT] === true;
  const isOurAbortTimer = opts?.localTimerAbort === true || markedLocal;

  if (response && !response.ok) {
    return httpClassification(response.status);
  }
  if (e && typeof e === 'object' && 'name' in e) {
    const n = (e as { name?: string }).name;
    if (n === 'AbortError') {
      if (isOurAbortTimer) {
        return {
          kind: 'aborted',
          name: n,
          message: (e as Error).message || 'Request aborted (client timeout)',
          isClientRequestTimeout: true,
          isBrowserLevelNetworkFailure: false,
        };
      }
      // Abort without our timer — often browser or OS cancelled the request (e.g. after long scoring load).
      return {
        kind: 'aborted',
        name: n,
        message: (e as Error).message || 'Request aborted',
        isClientRequestTimeout: false,
        isBrowserLevelNetworkFailure: true,
      };
    }
  }
  if (e instanceof SyntaxError) {
    return {
      kind: 'parse',
      name: 'SyntaxError',
      message: e.message,
      isClientRequestTimeout: false,
      isBrowserLevelNetworkFailure: false,
    };
  }
  if (e instanceof TypeError) {
    return {
      kind: 'network',
      name: e.name,
      message: e.message || 'TypeError',
      isClientRequestTimeout: false,
      isBrowserLevelNetworkFailure: true,
    };
  }
  if (e instanceof Error) {
    const msg = e.message || '';
    if (/json|parse|undefined is not|unexpected token/i.test(msg)) {
      return {
        kind: 'parse',
        name: e.name,
        message: msg,
        isClientRequestTimeout: false,
        isBrowserLevelNetworkFailure: false,
      };
    }
    if (
      /^load failed$/i.test(msg.trim()) ||
      /failed to fetch|network request failed|networkerror|the network connection was lost|internet connection appears to be offline|load failed|could not connect/i.test(
        msg
      )
    ) {
      return {
        kind: 'network',
        name: e.name,
        message: msg,
        isClientRequestTimeout: false,
        isBrowserLevelNetworkFailure: true,
      };
    }
    return {
      kind: 'unknown',
      name: e.name,
      message: msg,
      isClientRequestTimeout: false,
      isBrowserLevelNetworkFailure: false,
    };
  }
  return {
    kind: 'unknown',
    message: String(e),
    isClientRequestTimeout: false,
    isBrowserLevelNetworkFailure: false,
  };
}

const SYSTEM_PROMPT = `You are a senior clinical assessment analyst and
relationship psychologist reviewing a relationship readiness interview.
You have access to the full scoring data and transcript.

Your job is to produce the most thorough, insightful, honest, and
compassionate written analysis possible of why this person received
their scores and what it reveals about who they are in relationships.

This is not a summary. This is a full report. Leave nothing relevant out.
Every field that asks for analysis should receive full paragraphs — as much
depth as the evidence supports. The user is trusting you with something
important. Honour that with completeness.

Write in second person ("You showed...", "In this moment, you...").
Be specific — quote or closely paraphrase what they actually said.
Be honest without being harsh. Be warm without being falsely positive.
Acknowledge complexity. Notice nuance. Say the true thing, kindly.
Do not reframe low-scoring signals as positive traits.
If signals are broadly low, keep closing_reflection brief, neutral, and kind; do not convert low-signal patterns into compliments.
Do not use "clarity", "clear lines", or "principled" to positively describe patterns that score below 5.
Strengths gating rule (strict): only include behaviors in overall_strengths when the corresponding marker score is >= 6.0.
Do not include any behavior tied to a marker below 6.0, regardless of framing.
If the user fails, do not reframe low-scoring patterns as strengths.
If no markers are >= 6.0, return an empty overall_strengths array.
Apply this gating consistently across all eight markers.
Strengths evidence quality (strict): Before writing each overall_strength, verify the quoted or paraphrased evidence actually demonstrates the positive capacity you attribute (regulation, mentalizing, attunement, repair, etc.). Do not use contemptuous, dismissive, devaluing, contempt-adjacent, or judgmental language about another person as supporting evidence for a positive marker — including rationalized contempt framed as clarity (e.g. "I don't hold a grudge — I just see them clearly for who they are" must not be cited as emotional regulation). If the best available quote fails this test, find different evidence or omit that strength entirely.
For construct_breakdown.where_you_struggled, report only evidence observed in this interview.
If a marker scored 8.0 or above and there is no specific struggle evidence in the transcript, use either an empty string or explicitly frame it as a potential future growth edge (not an observed pattern).
Do not invent hypothetical struggle patterns and present them as observed facts.

Accountability — growth_edge and "over-functioning" inferences: If you describe over-functioning in accountability, taking responsibility for things outside the user's control, or similar, only do so when the transcript shows a concrete instance. If the idea is inferred mainly from thoroughness, careful wording, or general style (not from an observed pattern of misplaced self-blame or over-ownership), you MUST label it clearly as speculative or hypothetical and use tentative language (e.g. "one possible read," "may warrant watching for") — never the same confident tone as a demonstrated behavioral pattern.

Accountability — blame-shift vs. request for clarity: Do not describe as deflection or blame-shift a turn where the user first owns their part (gap, miss, or impact) and then asks the partner for concrete guidance to follow through (e.g. what "showing appreciation" would look like for them). That pattern is a repair bid on top of ownership. Reserve harsh accountability framing for cases where the partner is assigned sole responsibility with no sincere self-attribution (e.g. "they should have just told me what they needed").

Commitment_threshold narrative: This marker is grounded in **Moment 4** (grudge answer and/or the work-through vs walk-away follow-up). Do not anchor commitment_threshold primarily in Scenario C fiction.

Commitment-threshold calibration: Do not describe structurally sound answers as weak merely because they lack procedural detail (timelines, therapy, step lists). A complete path — real effort, honest communication about problems, reassessment, willingness to leave if the pattern doesn't change — supports a solid score (6–7+) even when brief. Unconditional staying with no limits ("never give up no matter what") belongs around 2–3. Exit at first difficulty belongs around 1–2. Reserve 7–8 for that structure plus some concrete irrecoverability specificity; 9–10 for strong evidence of persisting through serious difficulty with healthy limits.

Commitment_threshold growth_edge (strict): Never prescribe or praise movement toward unconditional staying, endless tolerance without limits, or "just keep investing no matter what" as the healthy direction. The rubric penalizes unconditional staying. Growth edges should emphasize a clear invest → communicate openly → assess whether change is real → decide to stay or leave with boundaries — not unconditional commitment.

THIS ATTEMPT'S TRANSCRIPT ONLY (strict): Your reasoning must reference only content that appears in the transcript block provided in the user message for this assessment attempt. Treat that block as the sole source of truth about what was said. Do not reference any personal story, example, biographical detail, moment, or quote that does not appear in that transcript (verbatim or clearly the same incident in the participant's words). Do not borrow content from other attempts, prior sessions, or general inference. If you cannot find a specific moment to anchor a passage, use the strongest moment that does appear in the transcript — never invent or import one.

Scores use eight markers: mentalizing, accountability, contempt, repair, regulation, attunement, appreciation, commitment_threshold. Map each construct_breakdown key to the matching score from the payload. The stored **contempt** score already combines sub-signals (about 60% participant expression across moments, 40% recognition where assessed); if scenario answers used harsh character framing toward fictional people, the contempt score should reflect that — do not describe contempt as strong solely because personal-moment answers were respectful.

UNASSESSED MARKERS (listed in the user payload): Treat these as not measured in this interview — missing or zero scores mean insufficient evidence, not a demonstrated deficit. For each such marker, construct_breakdown should state clearly that it was not directly assessed; do not frame it as a weakness. Do NOT include those markers in overall_growth_areas, readiness_assessment, or what_a_partner_would_experience as skills to build or relational deficits. Omit them from those sections entirely when possible.

REGULATION — NO SLICE EVIDENCE (strict): When "regulation" appears in UNASSESSED MARKERS, construct_breakdown.regulation must contain ONLY a short headline plus one brief summary sentence stating the marker was not directly assessed. Set what_you_did_well, where_you_struggled, key_pattern, nuance_and_context, and growth_edge to empty strings "". Do not write paragraphs, growth edges, patterns, or speculative strengths/struggles for regulation in that case.

Respond ONLY with valid JSON. No preamble, no markdown, no backticks.
Do not truncate any field. Do not write placeholder text.`;

/** Exported for unit tests (prompt shape / transcript formatting). */
export function buildUserPrompt(
  pillarScores: Record<string, number>,
  scenarioScores: Record<number, { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined>,
  transcript: Array<{ role: string; content?: string }>,
  weightedScore: number | null,
  passed: boolean,
  unassessedMarkers: string[]
): string {
  const fullTranscriptLines = transcript
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m, idx) => {
      const label = m.role === 'assistant' ? 'Interviewer' : 'Participant';
      const body = (m.content ?? '').trim();
      return body ? `[${idx + 1}] ${label}: ${body}` : '';
    })
    .filter(Boolean)
    .join('\n');

  const scenarioPayload: Record<string, unknown> = {};
  [1, 2, 3].forEach((n) => {
    const s = scenarioScores[n];
    if (s) scenarioPayload[`scenario_${n}`] = { pillarScores: s.pillarScores, name: s.scenarioName };
  });

  return `
ASSESSMENT RESULTS:
Weighted Score: ${weightedScore ?? 'N/A'}/10
Result: ${passed ? 'PASS' : 'NEEDS WORK'}

MARKER SCORES (eight markers):
${JSON.stringify(pillarScores, null, 2)}

UNASSESSED MARKERS (no direct evidence in this interview; do not speculate):
${JSON.stringify(unassessedMarkers, null, 2)}

SCENARIO SCORES:
${JSON.stringify(scenarioPayload, null, 2)}

COMPLETE TRANSCRIPT FOR THIS ATTEMPT ONLY (Interviewer + Participant — use only this thread; no other context):
${fullTranscriptLines || '(no transcript)'}

Hard rule for every narrative field (especially closing_reflection): Do not reference any personal story, example, or biographical detail that does not appear in the transcript above. If you cannot find a specific moment to anchor the closing reflection, use the strongest moment that does appear in the transcript rather than inventing or borrowing one. For closing_reflection specifically: observe content they shared; do not grade their performance (avoid openers like how clear they were, how sophisticated their understanding, what impressive insight they showed). Never use the phrase "going through the motions" to describe authentic celebration or concrete care they described — it implies hollow performance and contradicts their meaning.

Generate an exhaustive, deeply detailed reasoning object in this exact JSON structure.

Do NOT summarise. Do NOT truncate. Leave nothing relevant out.
For every field that asks for analysis, write full paragraphs — as much
as the transcript evidence supports. This is a therapeutic-quality
assessment report, not a summary. The user deserves to understand
themselves fully through your eyes.
For each construct_breakdown.where_you_struggled entry: include only observed evidence. If score >= 8 and no struggle was observed, set where_you_struggled to "" or explicitly label it as a potential growth edge, not an observed pattern.

{
  "overall_summary": "A rich, multi-paragraph introduction to this person's relational profile. Cover: how they show up across the full interview (three fictional scenarios plus one personal question), what kind of relational style they appear to have developed, what their scores collectively suggest about their readiness for intimacy, and any overarching pattern that connects their strengths and struggles. Be warm and honest. Be specific — reference only actual things they said in the transcript above; do not import moments from elsewhere or imply connections they did not make. This is the first thing they read. It should feel like being truly seen.",

  "overall_strengths": [
    "Full paragraph per strength — evidence must genuinely support the positive marker (no contemptuous/dismissive quotes as regulation or attunement). Include only strengths tied to construct_breakdown markers with score >= 6. Never present behaviors from markers below 6 as strengths. If all markers are below 6, return an empty array."
  ],

  "overall_growth_areas": [
    "Full paragraph per growth area — describe the pattern clearly, what it likely costs them in relationships, where it showed up in the transcript, and what it might look like to move through it. Include at least 3-4 distinct growth areas when enough markers were assessed; never use this section to invent deficits for markers listed in UNASSESSED MARKERS."
  ],

  "construct_breakdown": {
    "mentalizing": { "score": 0.0, "headline": "...", "summary": "...", "what_you_did_well": "...", "where_you_struggled": "...", "key_pattern": "...", "nuance_and_context": "...", "growth_edge": "..." },
    "accountability": { "score": 0.0, "headline": "...", "summary": "...", "what_you_did_well": "...", "where_you_struggled": "...", "key_pattern": "...", "nuance_and_context": "...", "growth_edge": "..." },
    "contempt": { "score": 0.0, "headline": "...", "summary": "...", "what_you_did_well": "...", "where_you_struggled": "...", "key_pattern": "...", "nuance_and_context": "...", "growth_edge": "..." },
    "repair": { "score": 0.0, "headline": "...", "summary": "...", "what_you_did_well": "...", "where_you_struggled": "...", "key_pattern": "...", "nuance_and_context": "...", "growth_edge": "..." },
    "regulation": { "score": 0.0, "headline": "...", "summary": "...", "what_you_did_well": "...", "where_you_struggled": "...", "key_pattern": "...", "nuance_and_context": "...", "growth_edge": "..." },
    "attunement": { "score": 0.0, "headline": "...", "summary": "...", "what_you_did_well": "...", "where_you_struggled": "...", "key_pattern": "...", "nuance_and_context": "...", "growth_edge": "..." },
    "appreciation": { "score": 0.0, "headline": "...", "summary": "...", "what_you_did_well": "...", "where_you_struggled": "...", "key_pattern": "...", "nuance_and_context": "...", "growth_edge": "..." },
    "commitment_threshold": { "score": 0.0, "headline": "...", "summary": "...", "what_you_did_well": "...", "where_you_struggled": "...", "key_pattern": "...", "nuance_and_context": "...", "growth_edge": "..." }
  },

  "scenario_observations": {
    "scenario_1": {
      "name": "Scenario A (Emma/Ryan)",
      "what_happened": "A detailed paragraph describing how this person navigated this scenario.",
      "standout_moments": ["Quote or close paraphrase with analysis.", "Second moment if warranted."],
      "what_it_revealed": "A full paragraph synthesising what this scenario unlocked about this person."
    },
    "scenario_2": {
      "name": "Scenario B (Sarah/James)",
      "what_happened": "...",
      "standout_moments": ["...", "..."],
      "what_it_revealed": "..."
    },
    "scenario_3": {
      "name": "Scenario C (Sophie/Daniel)",
      "what_happened": "...",
      "standout_moments": ["...", "..."],
      "what_it_revealed": "..."
    }
  },

  "cross_scenario_patterns": "A full, rich paragraph describing patterns that appeared across multiple parts of the interview (scenarios and personal moments). Only tie segments together when the participant actually linked them or a genuine shared theme is evident from their words — do not manufacture through-lines between unrelated content (e.g. a trust violation and an appreciation letter) unless they explicitly connected those threads.",

  "consistency_note": "A thorough paragraph analysing score consistency across the interview segments for each construct. If mentalizing (or similar) was low in earlier scenarios but higher in Scenario C, say whether the jump is justified by clearly stronger evidence in the transcript or whether it looks like inflation from a single baseline observation about the vignette.",

  "language_and_style_observations": "A paragraph analysing how this person communicated — qualifiers, pronoun choices, emotional vocabulary, specificity or vagueness.",

  "what_a_partner_would_experience": "A frank, compassionate paragraph describing what it would likely feel like to be in a close romantic relationship with this person.",

  "readiness_assessment": "A candid paragraph on their overall readiness for the kind of intimacy Amoraea is designed to support.",

  "closing_reflection": "One final paragraph. Default: anchor on the single strongest or most revealing moment from THIS transcript (quote or close echo). Prefer one anchor over forcing a synthesis across unrelated beats. Reference a second moment only if the participant explicitly connected those ideas or they clearly share the same theme in their own words — never imply a thematic rhyme between unrelated content (e.g. colleague trust and a mentor letter) just to sound cohesive. Do not reference any story, example, or detail that does not appear in the transcript provided. If no vivid moment fits, anchor on the clearest on-topic answer that does appear. Do not invent interpretive claims ('there's something about recognizing when…') unless they said it. Do not attribute a strength to the whole interview or to 'the scenarios' when it only appeared in one moment. No evaluative trait language and no interview-performance framing: do not open with how clear, sophisticated, or impressive they were — use observational anchors ('when you described…,' 'the moment you said…,' 'what you raised about…'). Warm but do not spin low-scoring signals as strengths; if scores are broadly low, keep brief, neutral, and kind."
}`;
}

export interface AIReasoningResult {
  overall_summary?: string;
  overall_strengths?: string[];
  overall_growth_areas?: string[];
  construct_breakdown?: Record<
    string,
    {
      score?: number;
      headline?: string;
      summary?: string;
      what_you_did_well?: string;
      where_you_struggled?: string;
      key_pattern?: string;
      nuance_and_context?: string;
      growth_edge?: string;
    }
  >;
  scenario_observations?: Record<
    string,
    { name?: string; what_happened?: string; standout_moments?: string[]; what_it_revealed?: string }
  >;
  cross_scenario_patterns?: string;
  consistency_note?: string;
  language_and_style_observations?: string;
  what_a_partner_would_experience?: string;
  readiness_assessment?: string;
  closing_reflection?: string;
}

/** Optional tighter limits for Edge Functions — platform wall clock is ~150s (free/pro default). */
export type GenerateAIReasoningOptions = {
  perAttemptTimeoutMs?: number;
  maxAttempts?: number;
};

/** One fetch attempt to Anthropic (direct or via `anthropic-proxy`); long prompts + max_tokens need headroom. */
export const DEFAULT_AI_REASONING_PER_ATTEMPT_TIMEOUT_MS = 140_000;

export async function generateAIReasoning(
  pillarScores: Record<string, number>,
  scenarioScores: Record<number, { pillarScores: Record<string, number | null>; scenarioName?: string } | undefined>,
  transcript: Array<{ role: string; content?: string }>,
  weightedScore: number | null,
  passed: boolean,
  unassessedMarkers: string[] = [],
  options?: GenerateAIReasoningOptions
): Promise<AIReasoningResult> {
  const apiUrl = getAnthropicEndpoint();
  const useProxy = apiUrl !== 'https://api.anthropic.com/v1/messages';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useProxy) {
    const anon = SUPABASE_ANON_KEY?.trim();
    if (!anon) {
      throw new Error(
        'AI reasoning via anthropic-proxy requires EXPO_PUBLIC_SUPABASE_ANON_KEY in the client bundle (missing). Rebuild the admin app with env vars set.'
      );
    }
    /** Supabase Functions gateway expects both — omitting `apikey` can yield opaque browser "Failed to fetch" on some gateways. */
    headers['Authorization'] = `Bearer ${anon}`;
    headers['apikey'] = anon;
  } else if (!useProxy) {
    headers['x-api-key'] = ANTHROPIC_API_KEY;
    headers['anthropic-version'] = '2023-06-01';
  }

  const userPrompt = buildUserPrompt(
    pillarScores,
    scenarioScores,
    transcript,
    weightedScore,
    passed,
    unassessedMarkers
  );

  const body: Record<string, unknown> = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  };

  /** One fetch attempt should not block indefinitely; proxies can hang without closing the socket. */
  const REASONING_FETCH_PER_ATTEMPT_TIMEOUT_MS =
    options?.perAttemptTimeoutMs ?? DEFAULT_AI_REASONING_PER_ATTEMPT_TIMEOUT_MS;
  const maxAttempts = options?.maxAttempts ?? 4;
  let lastErr: Error | null = null;
  let response: Response | null = null;
  let responseText: string | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let ourAbortTimerFired = false;
    const abort = new AbortController();
    const abortTimer = setTimeout(() => {
      ourAbortTimerFired = true;
      abort.abort();
    }, REASONING_FETCH_PER_ATTEMPT_TIMEOUT_MS);
    try {
      if (attempt > 0) {
        const backoffMs = Math.min(30_000, 1000 * 2 ** (attempt - 1));
        await new Promise((r) => setTimeout(r, backoffMs));
      }
      response = await fetch(apiUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: abort.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        clearTimeout(abortTimer);
        const meta = classifyAIReasoningRequestError(new Error(`HTTP ${response.status} ${errText}`), response);
        lastErr = new Error(
          `AI reasoning request failed: [${meta.kind}] ${response.status} ${errText.slice(0, 500)}`
        );
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          throw lastErr;
        }
        continue;
      }
      responseText = await response.text();
      clearTimeout(abortTimer);
      break;
    } catch (e) {
      clearTimeout(abortTimer);
      lastErr = e instanceof Error ? e : new Error(String(e));
      if (ourAbortTimerFired && lastErr.name === 'AbortError') {
        Object.defineProperty(lastErr, AI_REASONING_LOCAL_TIMEOUT, { value: true, enumerable: true });
      }
      if (attempt === maxAttempts - 1) throw lastErr;
    }
  }

  if (!response?.ok || responseText == null) {
    throw lastErr ?? new Error('AI reasoning request failed after retries');
  }

  let data: { content?: Array<{ text?: string }> };
  let text: string;
  let parsed: AIReasoningResult;
  try {
    data = JSON.parse(responseText) as { content?: Array<{ text?: string }> };
    text = (data.content?.[0]?.text ?? '{}').replace(/```json|```/g, '').trim();
    parsed = JSON.parse(text) as AIReasoningResult;
  } catch (e) {
    const meta = classifyAIReasoningRequestError(e, null);
    throw new Error(
      `AI reasoning: failed to parse model JSON [${meta.kind}] ${e instanceof Error ? e.message : String(e)}`
    );
  }
  const breakdown = parsed.construct_breakdown ?? {};
  Object.entries(breakdown).forEach(([, construct]) => {
    const score = construct?.score;
    const struggled = (construct?.where_you_struggled ?? '').trim();
    if (
      typeof score === 'number' &&
      score >= 8 &&
      struggled &&
      !/^potential growth edge/i.test(struggled) &&
      !/^no clear struggle pattern observed/i.test(struggled)
    ) {
      construct.where_you_struggled = `Potential growth edge (not a demonstrated struggle in this interview): ${struggled}`;
    }
  });
  const noEvidenceConstructTemplate = {
    headline: 'Not directly assessed in this interview',
    summary:
      'This marker did not surface with enough direct evidence in the scored moments, so this interview cannot support a confident interpretation for it.',
    what_you_did_well: 'No direct evidence available.',
    where_you_struggled: 'No direct evidence available.',
    key_pattern: 'Insufficient direct data in this interview.',
    nuance_and_context:
      'A low or missing value here reflects missing evidence, not a demonstrated deficit.',
    growth_edge:
      'If you want this area evaluated, it would need additional prompts that directly test this construct.',
  };
  const regulationNoEvidenceTemplate = {
    headline: 'Not directly assessed in this interview',
    summary:
      'Emotional regulation did not surface with enough direct evidence in the scored interview moments, so detailed interpretation is not supported here.',
    what_you_did_well: '',
    where_you_struggled: '',
    key_pattern: '',
    nuance_and_context: '',
    growth_edge: '',
  };
  unassessedMarkers.forEach((id) => {
    if (!parsed.construct_breakdown) parsed.construct_breakdown = {};
    const existing = parsed.construct_breakdown[id] ?? {};
    if (id === 'regulation') {
      parsed.construct_breakdown[id] = {
        ...existing,
        score: existing.score,
        ...regulationNoEvidenceTemplate,
      };
      return;
    }
    parsed.construct_breakdown[id] = {
      ...existing,
      score: existing.score,
      ...noEvidenceConstructTemplate,
    };
  });

  return parsed;
}
