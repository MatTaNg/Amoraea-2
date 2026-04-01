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
For construct_breakdown.where_you_struggled, report only evidence observed in this interview.
If a marker scored 8.0 or above and there is no specific struggle evidence in the transcript, use either an empty string or explicitly frame it as a potential future growth edge (not an observed pattern).
Do not invent hypothetical struggle patterns and present them as observed facts.

Commitment-threshold calibration anchor: a vague answer like "keep trying for a while, and if this keeps happening for months maybe that's a sign, but I wouldn't give up yet" belongs in the mid range (about 5-6), not high range. Reserve 7-10 for specific process, explicit irrecoverability criteria, or clear bilateral reasoning about repair limits.

Scores use eight markers: mentalizing, accountability, contempt, repair, regulation, attunement, appreciation, commitment_threshold. Map each construct_breakdown key to the matching score from the payload.

Respond ONLY with valid JSON. No preamble, no markdown, no backticks.
Do not truncate any field. Do not write placeholder text.`;

function buildUserPrompt(
  pillarScores: Record<string, number>,
  scenarioScores: Record<number, { pillarScores: Record<string, number>; scenarioName?: string } | undefined>,
  transcript: Array<{ role: string; content?: string }>,
  weightedScore: number | null,
  passed: boolean,
  unassessedMarkers: string[]
): string {
  const userTurns = transcript
    .filter((m) => m.role === 'user')
    .map((m, i) => `[${i + 1}] ${(m.content ?? '').trim()}`)
    .filter((line) => line.length > 2)
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

TRANSCRIPT (user turns only):
${userTurns || '(no transcript)'}

Generate an exhaustive, deeply detailed reasoning object in this exact JSON structure.

Do NOT summarise. Do NOT truncate. Leave nothing relevant out.
For every field that asks for analysis, write full paragraphs — as much
as the transcript evidence supports. This is a therapeutic-quality
assessment report, not a summary. The user deserves to understand
themselves fully through your eyes.
For each construct_breakdown.where_you_struggled entry: include only observed evidence. If score >= 8 and no struggle was observed, set where_you_struggled to "" or explicitly label it as a potential growth edge, not an observed pattern.

{
  "overall_summary": "A rich, multi-paragraph introduction to this person's relational profile. Cover: how they show up across the full interview (three fictional scenarios plus two personal questions), what kind of relational style they appear to have developed, what their scores collectively suggest about their readiness for intimacy, and any overarching pattern that connects their strengths and struggles. Be warm and honest. Be specific — reference actual things they said. This is the first thing they read. It should feel like being truly seen.",

  "overall_strengths": [
    "Full paragraph per strength - not a label, a real description of what you observed, why it matters in relationships, and where in the transcript it appeared. Include only strengths tied to construct_breakdown markers with score >= 6. Never present behaviors from markers below 6 as strengths. If all markers are below 6, return an empty array."
  ],

  "overall_growth_areas": [
    "Full paragraph per growth area — describe the pattern clearly, what it likely costs them in relationships, where it showed up in the transcript, and what it might look like to move through it. Include at least 3-4 distinct growth areas."
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
      "name": "Scenario A (Sam/Reese)",
      "what_happened": "A detailed paragraph describing how this person navigated this scenario.",
      "standout_moments": ["Quote or close paraphrase with analysis.", "Second moment if warranted."],
      "what_it_revealed": "A full paragraph synthesising what this scenario unlocked about this person."
    },
    "scenario_2": {
      "name": "Scenario B (Alex/Jordan)",
      "what_happened": "...",
      "standout_moments": ["...", "..."],
      "what_it_revealed": "..."
    },
    "scenario_3": {
      "name": "Scenario C (Morgan/Theo)",
      "what_happened": "...",
      "standout_moments": ["...", "..."],
      "what_it_revealed": "..."
    }
  },

  "cross_scenario_patterns": "A full, rich paragraph describing patterns that appeared across multiple parts of the interview (scenarios and personal moments).",

  "consistency_note": "A thorough paragraph analysing score consistency across the interview segments for each construct.",

  "language_and_style_observations": "A paragraph analysing how this person communicated — qualifiers, pronoun choices, emotional vocabulary, specificity or vagueness.",

  "what_a_partner_would_experience": "A frank, compassionate paragraph describing what it would likely feel like to be in a close romantic relationship with this person.",

  "readiness_assessment": "A candid paragraph on their overall readiness for the kind of intimacy Amoraea is designed to support.",

  "closing_reflection": "A final paragraph that references no more than two specific moments from the transcript (by content). Keep it concrete and human. Do not use evaluative trait language about the user. Keep tone warm but do not spin low-scoring signals as strengths. If scores are broadly low, keep this brief, neutral, and kind without turning it into a compliment."
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

export async function generateAIReasoning(
  pillarScores: Record<string, number>,
  scenarioScores: Record<number, { pillarScores: Record<string, number>; scenarioName?: string } | undefined>,
  transcript: Array<{ role: string; content?: string }>,
  weightedScore: number | null,
  passed: boolean,
  unassessedMarkers: string[] = []
): Promise<AIReasoningResult> {
  const apiUrl = getAnthropicEndpoint();
  const useProxy = apiUrl !== 'https://api.anthropic.com/v1/messages';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (useProxy && SUPABASE_ANON_KEY) {
    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`;
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

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`AI reasoning request failed: ${response.status} ${err}`);
  }

  const data = (await response.json()) as { content?: Array<{ text?: string }> };
  const text = (data.content?.[0]?.text ?? '{}').replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(text) as AIReasoningResult;
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
  unassessedMarkers.forEach((id) => {
    if (!parsed.construct_breakdown) parsed.construct_breakdown = {};
    const existing = parsed.construct_breakdown[id] ?? {};
    parsed.construct_breakdown[id] = {
      ...existing,
      score: existing.score,
      ...noEvidenceConstructTemplate,
    };
  });
  return parsed;
}
