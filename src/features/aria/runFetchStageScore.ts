import {
  ANTHROPIC_API_KEY,
  ANTHROPIC_PROXY_URL,
  SUPABASE_ANON_KEY,
  buildAnthropicMessagesHeaders,
  getAnthropicEndpoint,
} from '@features/aria/anthropicClientConfig';
import type { FetchStageScoreDeps, FetchStageScoreParams } from '@features/aria/fetchStageScoreTypes';
import { buildScoringPrompt } from '@features/aria/holisticScoringPrompt';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import { FALLBACK_MARKER_SCORES_MID } from '@features/aria/scoreInterviewModuleConstants';
import { CLAUDE_SONNET_MODEL } from '@utilities/anthropicMessagesClient';
import { parseHolisticInterviewModelObjectFromModelText } from '@utilities/parseHolisticModelJson';

export async function runFetchStageScore(
  deps: FetchStageScoreDeps,
  params: FetchStageScoreParams,
): Promise<InterviewResults> {
  const context = deps.typologyContext || 'No typology context — score from transcript only.';
  const fallback: InterviewResults = {
    pillarScores: { ...FALLBACK_MARKER_SCORES_MID },
    keyEvidence: {},
    narrativeCoherence: 'moderate',
    behavioralSpecificity: 'moderate',
    notableInconsistencies: [],
    interviewSummary: 'Partial score (no API key or error).',
  };
  if (!ANTHROPIC_API_KEY && !ANTHROPIC_PROXY_URL) return fallback;
  const apiUrl = getAnthropicEndpoint();
  const headers = buildAnthropicMessagesHeaders({ apiUrl });
  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: CLAUDE_SONNET_MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: buildScoringPrompt(params.finalMessages, context) }],
      }),
    });
    const data = await res.json();
    const raw = (data.content?.[0]?.text ?? '{}') as string;
    return parseHolisticInterviewModelObjectFromModelText(raw) as unknown as InterviewResults;
  } catch {
    return fallback;
  }
}
