import {
  enrichScenarioBoundaryHandoffBundleWithDynamicLead,
  inferCompletedScenarioFromHandoffBundle,
} from '@features/aria/resolveScenarioBoundaryLeadForInterview';
import type { PostClaudeScenarioAdvanceMessage } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import { stripControlTokens } from '@features/aria/interviewControlTokens';

/** Enrich coerced post-Claude display text when it is a scenario boundary handoff bundle. */
export async function enrichScenarioBoundaryHandoffDisplayTextForSpeak(args: {
  displayText: string;
  firstName: string;
  messages: readonly PostClaudeScenarioAdvanceMessage[];
  interviewSessionId?: string | null;
}): Promise<string> {
  const trimmed = (args.displayText ?? '').trim();
  if (!trimmed) return trimmed;
  if (!inferCompletedScenarioFromHandoffBundle(stripControlTokens(trimmed))) {
    return args.displayText;
  }
  return enrichScenarioBoundaryHandoffBundleWithDynamicLead({
    bundleText: trimmed,
    firstName: args.firstName,
    messages: args.messages,
    interviewSessionId: args.interviewSessionId,
  });
}
