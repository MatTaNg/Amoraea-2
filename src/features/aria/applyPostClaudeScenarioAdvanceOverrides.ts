import { SCENARIO_3_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import type {
  PostClaudeAssistantTurnDeps,
  PostClaudeAssistantTurnParams,
  PostClaudeInterviewMessage,
} from '@features/aria/postClaudeAssistantTurnTypes';
import {
  applyPostClaudeScenarioAdvanceBundleOverride,
  resolveScenarioUserTextForBoundaryReflection,
} from '@features/aria/interviewScenarioAdvanceAfterRepair';
import { buildScenario2To3BundleForInterview } from '@features/aria/interviewTransitionBundles';
import {
  enrichScenarioBoundaryHandoffBundleWithDynamicLead,
  parseScenarioCompleteAdvanceBundle,
} from '@features/aria/resolveScenarioBoundaryLeadForInterview';
import { shouldReplaceScenarioBRepairWithSkipAndScenario3Transition } from '@features/aria/probeAndScoringUtils';
import { remoteLog } from '@utilities/remoteLog';

export type PostClaudeScenarioAdvanceOverridesResult = {
  text: string;
  strippedText: string;
  priorAssistantContentS3: string;
};

function applyPostClaudeScenarioAdvanceOverridesSync(
  text: string,
  params: PostClaudeAssistantTurnParams,
  deps: PostClaudeAssistantTurnDeps,
  messagesToUse: PostClaudeInterviewMessage[],
): PostClaudeScenarioAdvanceOverridesResult {
  const priorAssistantContentS3 =
    [...messagesToUse].reverse().find((m) => m.role === 'assistant')?.content ?? '';
  let nextText = text;
  let strippedText = stripControlTokens(nextText);
  if (
    shouldReplaceScenarioBRepairWithSkipAndScenario3Transition(
      messagesToUse,
      strippedText,
      deps.currentInterviewMomentRef.current,
    )
  ) {
    nextText = `[SCENARIO_COMPLETE:2]\n\n${buildScenario2To3BundleForInterview(
      params.participantFirstNameForSpoken,
      SCENARIO_3_TEXT,
      resolveScenarioUserTextForBoundaryReflection(messagesToUse, 2),
    )}`;
    strippedText = stripControlTokens(nextText);
  }
  const advanceBundle = applyPostClaudeScenarioAdvanceBundleOverride(
    nextText,
    params.participantFirstNameForSpoken,
    messagesToUse,
    deps.currentInterviewMomentRef.current,
    deps.currentScenarioRef.current,
  );
  if (advanceBundle) {
    nextText = advanceBundle;
    strippedText = stripControlTokens(nextText);
    void remoteLog('[SCENARIO_ADVANCE_BUNDLE_OVERRIDE]', {
      moment: deps.currentInterviewMomentRef.current,
      scenario: deps.currentScenarioRef.current,
      preview: strippedText.slice(0, 280),
    });
  }
  return {
    text: nextText,
    strippedText,
    priorAssistantContentS3,
  };
}

/** Canonical scenario-complete tokens when repair satisfaction or incomplete boundary wraps apply. */
export function applyPostClaudeScenarioAdvanceOverrides(
  text: string,
  params: PostClaudeAssistantTurnParams,
  deps: PostClaudeAssistantTurnDeps,
  messagesToUse: PostClaudeInterviewMessage[],
): PostClaudeScenarioAdvanceOverridesResult {
  return applyPostClaudeScenarioAdvanceOverridesSync(text, params, deps, messagesToUse);
}

/** Async variant — enriches injected `[SCENARIO_COMPLETE:N]` bundles with dynamic boundary leads. */
export async function applyPostClaudeScenarioAdvanceOverridesAsync(
  text: string,
  params: PostClaudeAssistantTurnParams,
  deps: PostClaudeAssistantTurnDeps,
  messagesToUse: PostClaudeInterviewMessage[],
): Promise<PostClaudeScenarioAdvanceOverridesResult> {
  const sync = applyPostClaudeScenarioAdvanceOverridesSync(text, params, deps, messagesToUse);
  if (!parseScenarioCompleteAdvanceBundle(sync.text)) {
    return sync;
  }
  const enriched = await enrichScenarioBoundaryHandoffBundleWithDynamicLead({
    bundleText: sync.text,
    firstName: params.participantFirstNameForSpoken,
    messages: messagesToUse,
    interviewSessionId: deps.interviewSessionIdRef.current,
  });
  return {
    ...sync,
    text: enriched,
    strippedText: stripControlTokens(enriched),
  };
}
