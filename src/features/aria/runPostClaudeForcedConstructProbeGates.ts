import type { PostClaudeSpeakAssistantTurn } from '@features/aria/createPostClaudeSpeakAssistantTurn';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
} from '@features/aria/postClaudeAssistantTurnTypes';
import { runPostClaudeMoment4ThresholdForcedProbeGate } from '@features/aria/runPostClaudeMoment4ThresholdForcedProbeGate';
import { runPostClaudeScenarioAContemptForcedProbeGate } from '@features/aria/runPostClaudeScenarioAContemptForcedProbeGate';
import { runPostClaudeScenarioBAppreciationForcedProbeGate } from '@features/aria/runPostClaudeScenarioBAppreciationForcedProbeGate';
import { runPostClaudeScenarioBJamesDifferentlyForcedProbeGate } from '@features/aria/runPostClaudeScenarioBJamesDifferentlyForcedProbeGate';
import { runPostClaudeScenarioBJamesRepairForcedProbeGate } from '@features/aria/runPostClaudeScenarioBJamesRepairForcedProbeGate';
import { runPostClaudeScenarioCSophieForcedProbeGate } from '@features/aria/runPostClaudeScenarioCSophieForcedProbeGate';
import { runPostClaudeScenarioCRepairForcedProbeGate } from '@features/aria/runPostClaudeScenarioCRepairForcedProbeGate';
import {
  evaluatePostClaudeScenarioBJamesDifferentlyProbeState,
  type ForcedConstructProbeContext,
  type PostClaudeForcedConstructProbeGatesResult,
} from '@features/aria/postClaudeForcedConstructProbeShared';
import type { PostClaudeAssistantDraftValidation } from '@features/aria/validatePostClaudeAssistantDraft';

export type { PostClaudeForcedConstructProbeGatesResult } from '@features/aria/postClaudeForcedConstructProbeShared';

/** Forced S1 contempt, S2 appreciation, James-differently, and M4 threshold construct probes. */
export async function runPostClaudeForcedConstructProbeGates(
  deps: PostClaudeAssistantTurnDeps,
  params: PostClaudeAssistantTurnParams,
  text: string,
  draft: ForcedConstructProbeContext,
  parallelStreamingPlaybackUsed: boolean,
  speakAssistantTurn: PostClaudeSpeakAssistantTurn,
  draftValidation?: PostClaudeAssistantDraftValidation,
): Promise<PostClaudeForcedConstructProbeGatesResult> {
  const strippedText = draft.strippedText;
  const jamesState = evaluatePostClaudeScenarioBJamesDifferentlyProbeState(params, draft, text, strippedText);
  const skipScenarioForcedProbes = draftValidation?.skipScenarioForcedProbes === true;
  const skipMoment4ThresholdForced = draftValidation?.skipMoment4ThresholdForced === true;

  if (skipScenarioForcedProbes && skipMoment4ThresholdForced) {
    return {
      handled: false,
      strippedText,
      scenarioBSkippedJamesIntermediate: jamesState.scenarioBSkippedJamesIntermediate,
      needsScenarioBJamesDifferentlyInsert: jamesState.needsScenarioBJamesDifferentlyInsert,
    };
  }

  if (!skipScenarioForcedProbes) {
    const s1Contempt = await runPostClaudeScenarioAContemptForcedProbeGate(
      deps,
      params,
      text,
      draft,
      parallelStreamingPlaybackUsed,
      speakAssistantTurn,
      jamesState,
    );
    if (s1Contempt) {
      return s1Contempt;
    }

    const s2Appreciation = await runPostClaudeScenarioBAppreciationForcedProbeGate(
      deps,
      params,
      text,
      draft,
      speakAssistantTurn,
      jamesState,
    );
    if (s2Appreciation) {
      return s2Appreciation;
    }

    const jamesDifferently = await runPostClaudeScenarioBJamesDifferentlyForcedProbeGate(
      deps,
      params,
      draft,
      parallelStreamingPlaybackUsed,
      jamesState,
    );
    if (jamesDifferently) {
      return jamesDifferently;
    }

    const jamesRepair = await runPostClaudeScenarioBJamesRepairForcedProbeGate(
      deps,
      params,
      draft,
      speakAssistantTurn,
      jamesState,
    );
    if (jamesRepair) {
      return jamesRepair;
    }

    const s3Sophie = await runPostClaudeScenarioCSophieForcedProbeGate(
      deps,
      params,
      draft,
      speakAssistantTurn,
      jamesState,
    );
    if (s3Sophie) {
      return s3Sophie;
    }

    const s3Repair = await runPostClaudeScenarioCRepairForcedProbeGate(
      deps,
      params,
      draft,
      speakAssistantTurn,
      jamesState,
    );
    if (s3Repair) {
      return s3Repair;
    }
  }

  const m4Threshold = skipMoment4ThresholdForced
    ? null
    : await runPostClaudeMoment4ThresholdForcedProbeGate(
          deps,
          params,
          text,
          draft,
          speakAssistantTurn,
          jamesState,
        );
  if (m4Threshold) {
    return m4Threshold;
  }

  return {
    handled: false,
    strippedText,
    scenarioBSkippedJamesIntermediate: jamesState.scenarioBSkippedJamesIntermediate,
    needsScenarioBJamesDifferentlyInsert: jamesState.needsScenarioBJamesDifferentlyInsert,
  };
}
