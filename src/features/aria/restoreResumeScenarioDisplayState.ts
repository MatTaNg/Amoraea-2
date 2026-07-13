import { detectConstructs, formatScoreMessage } from '@features/aria/interviewConstructAndScoreDisplay';
import type { InterviewResults } from '@features/aria/interviewResultsTypes';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import { parseContemptTierBreakdown } from '@features/aria/contemptExpressionScoringRubric';
import {
  normalizeMentalizingInferenceSource,
  type ScenarioScoreResult,
} from '@features/aria/scoreInterviewScoringHelpers';
import type { HandleResumeDeps } from '@features/aria/sessionLifecycleTypes';
import { scenarioHasPersistedScores, lastFullyCompletedScenario } from '@utilities/interviewResumeCursor';
import type { SavedInterviewSnapshot } from '@utilities/storage/InterviewStorage';

type ResumeDisplayDeps = Pick<
  HandleResumeDeps,
  'setScenarioScores' | 'setStageResults' | 'setTouchedConstructs'
>;

export function restoreResumeScenarioDisplayState(
  deps: ResumeDisplayDeps,
  saved: SavedInterviewSnapshot,
  transcriptMessages: MessageWithScenario[],
): { role: string; content: string; isScoreCard?: boolean }[] {
  const scoredNums = new Set<number>(saved.scenariosCompleted ?? []);
  for (const n of [1, 2, 3] as const) {
    if (scenarioHasPersistedScores(n, saved.scenarioScores)) scoredNums.add(n);
  }

  const scoreCards = [...scoredNums]
    .sort((a, b) => a - b)
    .map((num) => {
      const s = saved.scenarioScores?.[num];
      if (!s) return null;
      const fake: ScenarioScoreResult = {
        scenarioNumber: num,
        scenarioName: s.scenarioName ?? `Scenario ${num}`,
        pillarScores: s.pillarScores ?? {},
        pillarConfidence: s.pillarConfidence ?? {},
        keyEvidence: s.keyEvidence ?? {},
        specificity: 'high',
        repairCoherenceIssue: null,
        mentalizing_inference_source: normalizeMentalizingInferenceSource(
          (s as { mentalizing_inference_source?: unknown }).mentalizing_inference_source,
        ),
        mentalizing_overcertainty: (s as { mentalizing_overcertainty?: unknown }).mentalizing_overcertainty === true,
        contempt_tier_breakdown: parseContemptTierBreakdown(
          (s as { contempt_tier_breakdown?: unknown }).contempt_tier_breakdown,
        ),
      };
      return {
        role: 'system',
        content: formatScoreMessage(fake),
        isScoreCard: true,
      } as { role: string; content: string; isScoreCard?: boolean };
    })
    .filter((x): x is { role: string; content: string; isScoreCard?: boolean } => x != null);

  const scenarioScoresRestored: Record<number, ScenarioScoreResult> = {};
  Object.entries(saved.scenarioScores ?? {}).forEach(([numStr, s]) => {
    if (!s) return;
    const num = parseInt(numStr, 10);
    scenarioScoresRestored[num] = {
      scenarioNumber: num,
      scenarioName: s.scenarioName ?? `Scenario ${num}`,
      pillarScores: s.pillarScores ?? {},
      pillarConfidence: s.pillarConfidence ?? {},
      keyEvidence: s.keyEvidence ?? {},
      specificity: 'high',
      repairCoherenceIssue: null,
      contempt_tier_breakdown: parseContemptTierBreakdown(
        (s as { contempt_tier_breakdown?: unknown }).contempt_tier_breakdown,
      ),
    };
  });
  deps.setScenarioScores(scenarioScoresRestored);

  deps.setStageResults(
    Object.entries(saved.scenarioScores ?? {})
      .filter(([, v]) => v != null)
      .map(([num, s]) => ({
        stage: parseInt(num, 10),
        results: {
          pillarScores: s!.pillarScores ?? {},
          keyEvidence: s!.keyEvidence ?? {},
          pillarConfidence: s!.pillarConfidence ?? {},
          narrativeCoherence: 'moderate' as const,
          behavioralSpecificity: 'moderate' as const,
          notableInconsistencies: [],
          interviewSummary: '',
        } as InterviewResults,
      })),
  );

  const allDetected = transcriptMessages
    .filter((m) => m.role === 'assistant')
    .flatMap((m) => detectConstructs(m.content));
  deps.setTouchedConstructs([...new Set(allDetected)]);

  return scoreCards;
}

export function restoreResumeScoredScenariosRef(
  saved: SavedInterviewSnapshot,
  scoredScenariosRef: { current: Set<number> },
): number {
  const completedSet = new Set<number>(saved.scenariosCompleted ?? []);
  for (const n of [1, 2, 3] as const) {
    if (scenarioHasPersistedScores(n, saved.scenarioScores)) completedSet.add(n);
  }
  scoredScenariosRef.current = completedSet;
  return lastFullyCompletedScenario(saved.scenariosCompleted ?? [], saved.scenarioScores);
}
