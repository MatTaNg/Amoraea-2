import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
} from '@features/aria/postClaudeAssistantTurnTypes';
import type {
  ForcedConstructProbeContext,
  PostClaudeForcedConstructProbeGatesResult,
} from '@features/aria/postClaudeForcedConstructProbeShared';
import { remoteLog } from '@utilities/remoteLog';

/** S2 hypothetical repair probe is retired — spontaneous S2 repair still scores. */
export async function runPostClaudeScenarioBJamesRepairForcedProbeGate(
  deps: PostClaudeAssistantTurnDeps,
  _params: PostClaudeAssistantTurnParams,
  _draft: ForcedConstructProbeContext,
  _speakAssistantTurn: PostClaudeSpeakAssistantTurn,
  _jamesState: Pick<
    PostClaudeForcedConstructProbeGatesResult,
    'scenarioBSkippedJamesIntermediate' | 'needsScenarioBJamesDifferentlyInsert'
  >,
): Promise<PostClaudeForcedConstructProbeGatesResult | null> {
  void remoteLog('[S2_JAMES_REPAIR_RETIRED_SKIP]', {
    interviewSessionId: deps.interviewSessionIdRef.current,
  });
  return null;
}
