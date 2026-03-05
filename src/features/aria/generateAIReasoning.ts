/**
 * Alpha-only: Generate detailed AI reasoning for interview results.
 * Calls Claude to produce structured explanation of scores. Remove before production.
 */

const ANTHROPIC_API_KEY =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ANTHROPIC_API_KEY) || '';
const ANTHROPIC_PROXY_URL =
  (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_ANTHROPIC_PROXY_URL) || '';
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

Respond ONLY with valid JSON. No preamble, no markdown, no backticks.
Do not truncate any field. Do not write placeholder text.`;

function buildUserPrompt(
  pillarScores: Record<string, number>,
  scenarioScores: Record<number, { pillarScores: Record<string, number>; scenarioName?: string } | undefined>,
  transcript: Array<{ role: string; content?: string }>,
  weightedScore: number | null,
  passed: boolean
): string {
  const userTurns = transcript
    .filter((m) => m.role === 'user')
    .map((m, i) => `[${i + 1}] ${(m.content ?? '').trim()}`)
    .filter((line) => line.length > 2)
    .join('\n');

  const pillarNamed: Record<string, number> = {};
  const names: Record<string, string> = {
    '1': 'conflict_repair',
    '3': 'accountability',
    '5': 'responsiveness',
    '6': 'desire_limits',
  };
  Object.entries(pillarScores).forEach(([id, v]) => {
    if (names[id]) pillarNamed[names[id]] = v;
  });

  const scenarioPayload: Record<string, unknown> = {};
  [1, 2, 3].forEach((n) => {
    const s = scenarioScores[n];
    if (s) scenarioPayload[`scenario_${n}`] = { pillarScores: s.pillarScores, name: s.scenarioName };
  });

  return `
ASSESSMENT RESULTS:
Weighted Score: ${weightedScore ?? 'N/A'}/10
Result: ${passed ? 'PASS' : 'NEEDS WORK'}

PILLAR SCORES (construct names):
${JSON.stringify(pillarNamed, null, 2)}

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

{
  "overall_summary": "A rich, multi-paragraph introduction to this person's relational profile. Cover: how they show up across the three scenarios as a whole, what kind of relational style they appear to have developed, what their scores collectively suggest about their readiness for intimacy, and any overarching pattern that connects their strengths and struggles. Be warm and honest. Be specific — reference actual things they said. This is the first thing they read. It should feel like being truly seen.",

  "overall_strengths": [
    "Full paragraph per strength — not a label, a real description of what you observed, why it matters in relationships, and where in the transcript it appeared. Include at least 4-6 distinct strengths."
  ],

  "overall_growth_areas": [
    "Full paragraph per growth area — describe the pattern clearly, what it likely costs them in relationships, where it showed up in the transcript, and what it might look like to move through it. Include at least 3-4 distinct growth areas."
  ],

  "construct_breakdown": {
    "conflict_repair": {
      "score": 0.0,
      "headline": "A single evocative sentence that captures the essence of how they show up in conflict — specific and honest, not generic.",
      "summary": "A concise paragraph (3-4 sentences) distilling the most important thing to know about this person in conflict and repair.",
      "what_you_did_well": "Full, detailed paragraphs covering every moment and pattern where they demonstrated strength in this construct. Quote or closely paraphrase their actual words.",
      "where_you_struggled": "Full, detailed paragraphs covering every moment and pattern that lowered this score. Be honest and specific without being harsh.",
      "key_pattern": "A full paragraph describing the core underlying pattern — the deeper relational habit or defence that connects the strengths and struggles in this construct.",
      "nuance_and_context": "A full paragraph noting anything that adds important context to the score.",
      "growth_edge": "A full paragraph describing the specific, concrete thing they could work on to grow in this construct."
    },
    "accountability": {
      "score": 0.0,
      "headline": "...",
      "summary": "...",
      "what_you_did_well": "...",
      "where_you_struggled": "...",
      "key_pattern": "...",
      "nuance_and_context": "...",
      "growth_edge": "..."
    },
    "responsiveness": {
      "score": 0.0,
      "headline": "...",
      "summary": "...",
      "what_you_did_well": "...",
      "where_you_struggled": "...",
      "key_pattern": "...",
      "nuance_and_context": "...",
      "growth_edge": "..."
    },
    "desire_limits": {
      "score": 0.0,
      "headline": "...",
      "summary": "...",
      "what_you_did_well": "...",
      "where_you_struggled": "...",
      "key_pattern": "...",
      "nuance_and_context": "...",
      "growth_edge": "..."
    }
  },

  "scenario_observations": {
    "scenario_1": {
      "name": "The Slow Drift",
      "what_happened": "A detailed paragraph describing how this person navigated this scenario.",
      "standout_moments": ["Quote or close paraphrase with analysis.", "Second moment if warranted."],
      "what_it_revealed": "A full paragraph synthesising what this scenario unlocked about this person."
    },
    "scenario_2": {
      "name": "The Missed Moment",
      "what_happened": "...",
      "standout_moments": ["...", "..."],
      "what_it_revealed": "..."
    },
    "scenario_3": {
      "name": "The Intimacy Gap",
      "what_happened": "...",
      "standout_moments": ["...", "..."],
      "what_it_revealed": "..."
    }
  },

  "cross_scenario_patterns": "A full, rich paragraph describing patterns that appeared across multiple scenarios.",

  "consistency_note": "A thorough paragraph analysing score consistency across the three scenarios for each construct.",

  "language_and_style_observations": "A paragraph analysing how this person communicated — qualifiers, pronoun choices, emotional vocabulary, specificity or vagueness.",

  "what_a_partner_would_experience": "A frank, compassionate paragraph describing what it would likely feel like to be in a close romantic relationship with this person.",

  "readiness_assessment": "A candid paragraph on their overall readiness for the kind of intimacy Amoraea is designed to support.",

  "closing_reflection": "A final, unhurried paragraph that lands with warmth and truth. Not a summary — a closing thought that acknowledges what they brought, honours the courage it takes to be assessed this way, and leaves them with one honest, forward-looking observation."
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
  passed: boolean
): Promise<AIReasoningResult> {
  const useProxy = !!ANTHROPIC_PROXY_URL;
  const apiUrl = useProxy ? ANTHROPIC_PROXY_URL : 'https://api.anthropic.com/v1/messages';
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
    passed
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
  return JSON.parse(text) as AIReasoningResult;
}
