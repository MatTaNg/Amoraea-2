import type {
  SaveScenarioCheckpointDeps,
  SaveScenarioCheckpointParams,
} from '@features/aria/saveScenarioCheckpointTypes';
import { syncLiveInterviewTranscriptToAttempt } from '@utilities/syncLiveInterviewTranscript';

export async function runSaveScenarioCheckpoint(
  deps: SaveScenarioCheckpointDeps,
  params: SaveScenarioCheckpointParams,
): Promise<void> {
  if (!params.uid) return;
  const transcriptSnapshot = params.allMessages.filter(
    (m) => !(m as { isScoreCard?: boolean }).isScoreCard,
  );
  try {
    const aid = deps.interviewSessionAttemptIdRef.current;
    if (!aid) return;
    await syncLiveInterviewTranscriptToAttempt(deps.supabase, {
      attemptId: aid,
      userId: params.uid,
      transcript: transcriptSnapshot,
      resumeActiveScenario: null,
    });
    deps.resumeActiveScenarioRef.current = null;
    const persisted = await deps.loadInterviewFromStorage(params.uid);
    if (persisted) {
      await deps.saveInterviewToStorage(params.uid, {
        ...persisted,
        resumeActiveScenario: null,
      });
    }
  } catch (err) {
    console.error('Checkpoint save error:', err);
  }
}
