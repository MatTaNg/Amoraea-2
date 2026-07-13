import { extractEgoDevelopmentLevel } from '@features/aria/aggregateMarkerScoresFromSlices';
import { buildScoringPrompt } from '@features/aria/holisticScoringPrompt';
import { CLAUDE_SONNET_MODEL } from '@utilities/anthropicMessagesClient';
import { parseHolisticInterviewModelObjectFromModelText } from '@utilities/parseHolisticModelJson';
import { remoteLog } from '@utilities/remoteLog';

import type { InterviewResults } from './interviewResultsTypes';

export const SCORING_HOLISTIC_FETCH_TIMEOUT_MS = 180_000;

export type FetchHolisticScoringOnceParams = {
  apiUrl: string;
  headers: Record<string, string>;
  finalMessages: { role: string; content: string }[];
  typologyContext: string;
  userId?: string | null;
  attemptId?: string | null;
  sessionUserId?: string | null;
};

/** Holistic model fetch (pillar map + ego). Shared by deferred standard gate and main client scoring. */
export async function fetchHolisticScoringOnce(
  params: FetchHolisticScoringOnceParams,
): Promise<InterviewResults> {
  const { apiUrl, headers, finalMessages, typologyContext, userId, attemptId, sessionUserId } = params;
  const abort = new AbortController();
  const t = setTimeout(() => abort.abort(), SCORING_HOLISTIC_FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(apiUrl, {
      method: 'POST',
      headers,
      signal: abort.signal,
      body: JSON.stringify({
        model: CLAUDE_SONNET_MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content: buildScoringPrompt(finalMessages, typologyContext) }],
      }),
    });
  } finally {
    clearTimeout(t);
  }
  const data = await res.json();
  if (!res.ok) {
    const e = new Error((data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
    (e as Error & { status?: number }).status = res.status;
    throw e;
  }
  const raw = (data.content?.[0]?.text ?? '{}') as string;
  const cleanedForEgoDiag = raw.replace(/```json|```/gi, '').trim();
  let wholeJsonDiagKeys: string[] | null = null;
  try {
    const w = JSON.parse(cleanedForEgoDiag);
    if (w != null && typeof w === 'object' && !Array.isArray(w)) {
      wholeJsonDiagKeys = Object.keys(w as Record<string, unknown>);
    }
  } catch {
    wholeJsonDiagKeys = null;
  }
  const rawHasEgoSubstring = /"ego_development_level"|"egoDevelopmentLevel"/i.test(raw);
  const coerced = parseHolisticInterviewModelObjectFromModelText(raw) as unknown as InterviewResults;
  const extractedEgoDiag = extractEgoDevelopmentLevel(coerced);
  void remoteLog('[HOLISTIC_EGO_PARSE]', {
    attemptId: attemptId ?? null,
    userId: userId ?? null,
    sessionUserId: sessionUserId ?? null,
    sessionMatchesScoreInterviewUser:
      sessionUserId != null && userId != null && sessionUserId === userId,
    extractedEgo: extractedEgoDiag,
    rawHasEgoJsonKeySubstring: rawHasEgoSubstring,
    wholeJsonParseOkKeysLen: wholeJsonDiagKeys?.length ?? null,
    coercedTopLevelEgo: coerced.ego_development_level ?? null,
    pillarKeyCount:
      coerced.pillarScores != null && typeof coerced.pillarScores === 'object'
        ? Object.keys(coerced.pillarScores as object).length
        : 0,
    rawLen: raw.length,
    note:
      'If sessionUserId !== userId, interview_attempts UPDATE .eq(user_id, userId) may match 0 rows under RLS unless admin update policy applies. null extractedEgo means model omitted ego.',
  });
  if (__DEV__) {
    console.log('[EgoDev] holistic ranked keys:', Object.keys(coerced as object));
    console.log('[EgoDev] coerced ego_development_level:', coerced.ego_development_level);
    console.log('[EgoDev] extractEgoDevelopmentLevel(coerced):', extractEgoDevelopmentLevel(coerced));
  }
  return coerced;
}
