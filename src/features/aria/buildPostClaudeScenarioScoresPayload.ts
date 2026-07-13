import type { PostClaudeAssistantTurnDeps } from '@features/aria/postClaudeAssistantTurnTypes';

export type PostClaudeScenarioScoresPayload = Record<
  number,
  {
    pillarScores: Record<string, number | null>;
    pillarConfidence: Record<string, string>;
    keyEvidence: Record<string, string>;
    scenarioName?: string;
  }
>;

export function buildPostClaudeScenarioScoresPayload(
  deps: PostClaudeAssistantTurnDeps,
): PostClaudeScenarioScoresPayload {
  const scenarioScoresPayload: PostClaudeScenarioScoresPayload = {};
  [1, 2, 3].forEach((n) => {
    const s = deps.scenarioScoresRef.current[n];
    if (s) {
      scenarioScoresPayload[n] = {
        pillarScores: s.pillarScores,
        pillarConfidence: s.pillarConfidence,
        keyEvidence: s.keyEvidence,
        scenarioName: s.scenarioName,
      };
    }
  });
  return scenarioScoresPayload;
}
