import { SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS } from '@features/aria/interviewSkipPenalties';
import { buildScenarioScoringPrompt } from '@features/aria/scenarioScoringPrompt';
import { maxTokensForScenarioScore } from '@features/aria/scenarioScoreDegradedRetry';
import {
  coerceScenarioScoreParsedModelRecord,
  logScenarioScoreParseRecovery,
  mergeSalvagedScenarioPillarScoresIntoParsed,
  parseScenarioScoreJsonFromModelText,
} from '@features/aria/scenarioScoringParse';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';
import { DEFERRED_MOMENT_ANTHROPIC_TIMEOUT_MS } from '@features/aria/scoreInterviewModuleConstants';
import { CLAUDE_SONNET_MODEL } from '@utilities/anthropicMessagesClient';
import { fetchWithTimeout } from '@utilities/fetchWithTimeout';

import { defaultScenarioDisplayName } from '@features/aria/scenarioDisplayNames';

export type FetchScenarioScoreFromAnthropicResult = {
  parsedScenario: ScenarioScoreResult;
  raw: string;
  parseError?: string;
  stopReason?: string | null;
};

export async function fetchScenarioScoreFromAnthropic(params: {
  apiUrl: string;
  headers: Record<string, string>;
  scenarioNumber: 1 | 2 | 3;
  scoringMessages: { role: string; content: string }[];
  priorMentalizingForScenario3: { s1?: number | null; s2?: number | null } | null;
  repairFocusForPrompt: string | null;
  attemptId?: string | null;
}): Promise<FetchScenarioScoreFromAnthropicResult> {  const {
    apiUrl,
    headers,
    scenarioNumber,
    scoringMessages,
    priorMentalizingForScenario3,
    repairFocusForPrompt,
    attemptId,
  } = params;

  const res = await fetchWithTimeout(apiUrl, {
    method: 'POST',
    headers,
    timeoutMs: DEFERRED_MOMENT_ANTHROPIC_TIMEOUT_MS,
    body: JSON.stringify({
      model: CLAUDE_SONNET_MODEL,
      max_tokens: maxTokensForScenarioScore(scenarioNumber),
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: buildScenarioScoringPrompt(
            scenarioNumber,
            scoringMessages,
            priorMentalizingForScenario3,
            repairFocusForPrompt,
          ),
        },
      ],
    }),
  });
  const data = await res.json();
  const raw = (data.content?.[0]?.text ?? '{}') as string;
  const stopReason = (data as { stop_reason?: string | null }).stop_reason ?? null;  if (!res.ok) {
    const e = new Error((data as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`);
    (e as Error & { status?: number }).status = res.status;
    throw e;
  }

  let parsedScenario: ScenarioScoreResult;
  let parseError: string | undefined;
  try {
    parsedScenario = parseScenarioScoreJsonFromModelText(raw) as ScenarioScoreResult;
  } catch (parseErr) {
    parseError = parseErr instanceof Error ? parseErr.message : String(parseErr);
    logScenarioScoreParseRecovery({
      scenarioNumber,
      attemptId,
      reason: 'primary_json_parse_failed',
      parseError,
      rawModelText: raw,
    });
    parsedScenario = {
      scenarioNumber,
      scenarioName: defaultScenarioDisplayName(scenarioNumber),
      pillarScores: {},
      keyEvidence: {},
      pillarConfidence: {},
    } as ScenarioScoreResult;
  }

  const scenarioMarkerIdsEarly = SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS[scenarioNumber];
  const coercedScenario = coerceScenarioScoreParsedModelRecord(parsedScenario);
  parsedScenario.pillarScores = coercedScenario.pillarScores as ScenarioScoreResult['pillarScores'];
  parsedScenario.keyEvidence = coercedScenario.keyEvidence as ScenarioScoreResult['keyEvidence'];
  if (Object.keys(coercedScenario.pillarConfidence).length > 0) {
    parsedScenario.pillarConfidence = coercedScenario.pillarConfidence as ScenarioScoreResult['pillarConfidence'];
  }
  parsedScenario.pillarScores = mergeSalvagedScenarioPillarScoresIntoParsed(
    raw,
    scenarioMarkerIdsEarly,
    parsedScenario.pillarScores as Record<string, unknown>,
  ) as ScenarioScoreResult['pillarScores'];

  return { parsedScenario, raw, parseError, stopReason };
}