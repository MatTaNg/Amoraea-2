import {
  inferScenarioMessages,
  pickMessagesForScenarioScoring,
} from '@features/aria/interviewScenarioScoringSlice';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { ScoreInterviewDeps } from '@features/aria/scoreInterviewTypes';
import { remoteLog } from '@utilities/remoteLog';

/** Rescore any scenario slices missing from refs at interview completion. */
export async function rescoreMissingAlphaScenarioScores(
  deps: ScoreInterviewDeps,
  finalMessages: { role: string; content: string }[],
): Promise<void> {
  const hasAllScores =
    deps.scenarioScoresRef.current[1] != null &&
    deps.scenarioScoresRef.current[2] != null &&
    deps.scenarioScoresRef.current[3] != null;
  if (hasAllScores) return;

  await remoteLog('COMPLETION_INCOMPLETE_SCORES', {
    s1: !!deps.scenarioScoresRef.current[1],
    s2: !!deps.scenarioScoresRef.current[2],
    s3: !!deps.scenarioScoresRef.current[3],
  });
  if (__DEV__) {
    console.error('Interview complete but missing scenario scores:', {
      s1: deps.scenarioScoresRef.current[1],
      s2: deps.scenarioScoresRef.current[2],
      s3: deps.scenarioScoresRef.current[3],
    });
  }

  const msgs = finalMessages as MessageWithScenario[];
  const missing = ([1, 2, 3] as const).filter((n) => !deps.scenarioScoresRef.current[n]);
  if (__DEV__) console.log('[RESCORE] Missing scenarios:', missing);
  await Promise.all(
    missing.map(async (scenarioNum) => {
      const taggedMessages = msgs.filter((m) => (m as MessageWithScenario).scenarioNumber === scenarioNum);
      const inferredMessages = inferScenarioMessages(msgs, scenarioNum);
      const messagesToScore = pickMessagesForScenarioScoring(msgs, scenarioNum);
      if (__DEV__) {
        console.log(
          `[RESCORE] Scenario ${scenarioNum}: ${messagesToScore.length} messages (tagged: ${taggedMessages.length}, inferred: ${inferredMessages.length})`,
        );
      }
      if (messagesToScore.length >= 2) {
        await deps.scoreScenario(scenarioNum, messagesToScore);
      } else if (__DEV__) {
        console.error(`[RESCORE] Cannot score scenario ${scenarioNum} — insufficient messages`);
      }
    }),
  );
}
