import {
  shouldAdvanceScenarioAAfterSatisfiedRepair,
  shouldAdvanceScenarioBAfterSatisfiedRepair,
} from '@features/aria/interviewRepairRefusalDetection';
import {
  resolveScenarioUserTextForBoundaryReflection,
} from '@features/aria/interviewScenarioAdvanceAfterRepair';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import {
  INTERVIEW_SCENARIO_BOUNDARY_LLM_ENABLED,
  INTERVIEW_SCENARIO_BOUNDARY_LLM_PREFETCH_ENABLED,
} from '@features/aria/interviewTurnOrchestratorConfig';
import type { PreClaudeTurnGateDeps } from '@features/aria/preClaudeTurnGateTypes';
import { resolveScenarioBoundaryLeadForInterview } from '@features/aria/resolveScenarioBoundaryLeadForInterview';
import {
  getCachedScenarioBoundaryLead,
  setCachedScenarioBoundaryLead,
} from '@features/aria/scenarioBoundaryLeadPrefetchCache';
import { scenarioAMinimumEngagementForHandoff } from '@features/aria/scenarioFollowUpTranscriptGuard';
import { scenarioBMinimumEngagementForHandoff } from '@features/aria/scenarioBProbeLogic';
import {
  scenarioCRepairConstructStillPending,
  scenarioCUserAnswerSatisfiesRepairQuestionAnswer,
} from '@features/aria/scenarioCPromptDetection';
import { findLastUserWithPriorAssistantContent } from '@features/aria/interviewRepairRefusalDetection';
import { isScenarioCRepairAssistantPrompt } from '@features/aria/scenarioCPromptDetection';
import { remoteLog } from '@utilities/remoteLog';

function resolveImminentBoundaryCompletedScenario(args: {
  deps: PreClaudeTurnGateDeps;
  trimmed: string;
  messagesToUse: MessageWithScenario[];
}): 1 | 2 | 3 | null {
  const scenario = args.deps.currentScenarioRef.current ?? 1;
  const moment = args.deps.currentInterviewMomentRef.current ?? 1;
  if (moment > 3) return null;

  const messages = args.messagesToUse;
  const draft = args.trimmed;

  if (
    scenario === 1 &&
    moment === 1 &&
    scenarioAMinimumEngagementForHandoff(messages) &&
    shouldAdvanceScenarioAAfterSatisfiedRepair(messages, draft, moment)
  ) {
    return 1;
  }

  if (
    scenario === 2 &&
    moment === 2 &&
    scenarioBMinimumEngagementForHandoff(messages) &&
    shouldAdvanceScenarioBAfterSatisfiedRepair(messages, draft, scenario)
  ) {
    return 2;
  }

  if (scenario === 3 && moment === 3 && !scenarioCRepairConstructStillPending(messages)) {
    const { lastUserContent, priorAssistantContent } = findLastUserWithPriorAssistantContent(messages);
    if (
      lastUserContent &&
      priorAssistantContent &&
      isScenarioCRepairAssistantPrompt(priorAssistantContent) &&
      scenarioCUserAnswerSatisfiesRepairQuestionAnswer(lastUserContent)
    ) {
      return 3;
    }
  }

  return null;
}

/**
 * Fire-and-forget boundary lead prefetch when the user's answer likely completes a scenario.
 * Cached result is consumed by {@link resolveScenarioBoundaryLeadForInterview}.
 */
export function scheduleScenarioBoundaryLeadPrefetch(args: {
  deps: PreClaudeTurnGateDeps;
  trimmed: string;
  messagesToUse: MessageWithScenario[];
  participantFirstNameForSpoken: string;
}): void {
  if (!INTERVIEW_SCENARIO_BOUNDARY_LLM_ENABLED || !INTERVIEW_SCENARIO_BOUNDARY_LLM_PREFETCH_ENABLED) {
    return;
  }

  const completedScenario = resolveImminentBoundaryCompletedScenario(args);
  if (!completedScenario) return;

  const firstName =
    (args.deps.interviewNameRef.current ?? '').trim() || args.participantFirstNameForSpoken.trim() || '';
  const userCorpus = resolveScenarioUserTextForBoundaryReflection(args.messagesToUse, completedScenario);
  const sessionId = args.deps.interviewSessionIdRef.current;

  if (getCachedScenarioBoundaryLead(sessionId, completedScenario, userCorpus)) {
    return;
  }

  void (async () => {
    try {
      const { lead, source } = await resolveScenarioBoundaryLeadForInterview({
        completedScenario,
        firstName,
        lastUserAnswer: userCorpus || null,
        interviewSessionId: sessionId,
        skipCacheWrite: true,
      });
      setCachedScenarioBoundaryLead(sessionId, {
        completedScenario,
        lead,
        source,
        userCorpus: userCorpus || '',
        fetchedAtMs: Date.now(),
      });
      void remoteLog('[SCENARIO_BOUNDARY_LLM_PREFETCH]', {
        interviewSessionId: sessionId,
        completedScenario,
        source,
        preview: lead.slice(0, 220),
      });
    } catch (err) {
      void remoteLog('[SCENARIO_BOUNDARY_LLM_PREFETCH_ERROR]', {
        interviewSessionId: sessionId,
        completedScenario,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  })();
}
