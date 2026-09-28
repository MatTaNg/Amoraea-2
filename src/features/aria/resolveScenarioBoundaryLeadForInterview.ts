import { fetchInterviewScenarioBoundaryLeadFromLlm } from '@features/aria/fetchInterviewScenarioBoundaryLeadFromLlm';
import { staticScenarioBoundaryLeadFallback } from '@features/aria/interviewScenarioBoundaryLlmPrompt';
import { resolveScenarioUserTextForBoundaryReflection } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import type { PostClaudeScenarioAdvanceMessage } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import { textContainsScenarioBVignetteBody } from '@features/aria/emotionScenarioTransitionInference';
import { textContainsScenarioCVignetteBody } from '@features/aria/scenarioVignetteBodyDetection';
import { looksLikeMoment4GrudgePrompt } from '@features/aria/moment4ProbeLogic';
import {
  assistantTextLooksLikeMoment4HandoffLead,
  buildScenarioBoundaryLeadForInterview,
  INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS,
} from '@features/aria/interviewTransitionBundles';
import { SCENARIO_2_TEXT, SCENARIO_3_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import {
  buildScenario1To2BundleForInterview,
  buildScenario2To3BundleForInterview,
} from '@features/aria/interviewTransitionBundles';
import { INTERVIEW_SCENARIO_BOUNDARY_LLM_ENABLED } from '@features/aria/interviewTurnOrchestratorConfig';
import { remoteLog } from '@utilities/remoteLog';
import {
  getCachedScenarioBoundaryLead,
  setCachedScenarioBoundaryLead,
} from '@features/aria/scenarioBoundaryLeadPrefetchCache';

export type ScenarioBoundaryLeadSource = 'llm' | 'static';

export async function resolveScenarioBoundaryLeadForInterview(args: {
  completedScenario: 1 | 2 | 3;
  firstName: string;
  lastUserAnswer?: string | null;
  timeoutMs?: number;
  interviewSessionId?: string | null;
  /** When true (prefetch writer), do not re-write cache on resolve. */
  skipCacheWrite?: boolean;
}): Promise<{ lead: string; source: ScenarioBoundaryLeadSource }> {
  const userCorpus = (args.lastUserAnswer ?? '').trim();
  const staticLead = buildScenarioBoundaryLeadForInterview(
    args.completedScenario,
    args.firstName,
    args.lastUserAnswer,
  );

  // Reflections + LLM boundary leads are off together — never serve a cached reflective lead.
  if (!INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS || !INTERVIEW_SCENARIO_BOUNDARY_LLM_ENABLED) {
    return { lead: staticLead, source: 'static' };
  }

  const cached = getCachedScenarioBoundaryLead(
    args.interviewSessionId,
    args.completedScenario,
    userCorpus,
  );
  if (cached) {
    void remoteLog('[SCENARIO_BOUNDARY_LLM_LIVE]', {
      interviewSessionId: args.interviewSessionId ?? null,
      completedScenario: args.completedScenario,
      source: cached.source,
      cacheHit: true,
      preview: cached.lead.slice(0, 220),
    });
    return { lead: cached.lead, source: cached.source };
  }

  try {
    const llmLead = await fetchInterviewScenarioBoundaryLeadFromLlm({
      completedScenario: args.completedScenario,
      userCorpus: (args.lastUserAnswer ?? '').trim(),
      timeoutMs: args.timeoutMs,
    });
    if (llmLead) {
      void remoteLog('[SCENARIO_BOUNDARY_LLM_LIVE]', {
        interviewSessionId: args.interviewSessionId ?? null,
        completedScenario: args.completedScenario,
        source: 'llm',
        cacheHit: false,
        preview: llmLead.slice(0, 220),
      });
      if (!args.skipCacheWrite) {
        setCachedScenarioBoundaryLead(args.interviewSessionId, {
          completedScenario: args.completedScenario,
          lead: llmLead,
          source: 'llm',
          userCorpus,
          fetchedAtMs: Date.now(),
        });
      }
      return { lead: llmLead, source: 'llm' };
    }
    void remoteLog('[SCENARIO_BOUNDARY_LLM_LIVE]', {
      interviewSessionId: args.interviewSessionId ?? null,
      completedScenario: args.completedScenario,
      source: 'static',
      reason: 'invalid_or_empty_llm_output',
      fallbackPreview: staticLead.slice(0, 220),
    });
  } catch (err) {
    void remoteLog('[SCENARIO_BOUNDARY_LLM_LIVE]', {
      interviewSessionId: args.interviewSessionId ?? null,
      completedScenario: args.completedScenario,
      source: 'static',
      reason: 'llm_error',
      error: err instanceof Error ? err.message : String(err),
      fallbackPreview: staticLead.slice(0, 220),
    });
  }

  if (!args.skipCacheWrite) {
    setCachedScenarioBoundaryLead(args.interviewSessionId, {
      completedScenario: args.completedScenario,
      lead: staticLead,
      source: 'static',
      userCorpus,
      fetchedAtMs: Date.now(),
    });
  }
  return { lead: staticLead, source: 'static' };
}

/** Client-owned or post-claude bundle: dynamic lead + locked next-segment body. */
export async function buildClientScenarioBoundaryHandoffBundleAsync(
  completedScenario: 1 | 2 | 3,
  firstName: string,
  lastUserAnswer: string | null | undefined,
  moment4PersonalCard: string,
  opts?: { timeoutMs?: number; interviewSessionId?: string | null },
): Promise<string> {
  const { lead } = await resolveScenarioBoundaryLeadForInterview({
    completedScenario,
    firstName,
    lastUserAnswer,
    timeoutMs: opts?.timeoutMs,
    interviewSessionId: opts?.interviewSessionId,
  });

  const nextBody =
    completedScenario === 1
      ? SCENARIO_2_TEXT
      : completedScenario === 2
        ? SCENARIO_3_TEXT
        : moment4PersonalCard;

  return `${lead}\n\n${nextBody}`.trim();
}

/** S1→S2 / S2→S3 client-owned handoff with dynamic lead (vignette text unchanged). */
export async function buildScenarioFictionHandoffBundleWithDynamicLead(args: {
  completedScenario: 1 | 2;
  firstName: string;
  lastUserAnswer?: string | null;
  timeoutMs?: number;
  interviewSessionId?: string | null;
}): Promise<string> {
  const { lead } = await resolveScenarioBoundaryLeadForInterview({
    completedScenario: args.completedScenario,
    firstName: args.firstName,
    lastUserAnswer: args.lastUserAnswer,
    timeoutMs: args.timeoutMs,
    interviewSessionId: args.interviewSessionId,
  });

  const staticBundle =
    args.completedScenario === 1
      ? buildScenario1To2BundleForInterview(args.firstName, SCENARIO_2_TEXT, args.lastUserAnswer)
      : buildScenario2To3BundleForInterview(args.firstName, SCENARIO_3_TEXT, args.lastUserAnswer);
  const split = staticBundle.indexOf('\n\n');
  const vignetteBody = split > 0 ? staticBundle.slice(split + 2).trim() : staticBundle.trim();
  return `${lead}\n\n${vignetteBody}`.trim();
}

/** Replace the spoken lead in a handoff bundle; keeps locked vignette / personal-card body. */
export function replaceScenarioBoundaryLeadInBundle(bundleBody: string, lead: string): string {
  const body = (bundleBody ?? '').trim();
  const nextLead = (lead ?? '').trim();
  if (!body) return nextLead;
  if (!nextLead) return body;
  const split = body.indexOf('\n\n');
  const afterModal = split > 0 ? body.slice(split + 2).trim() : '';
  if (afterModal) {
    return `${nextLead}\n\n${afterModal}`.trim();
  }
  return nextLead;
}

export function parseScenarioCompleteAdvanceBundle(text: string): {
  tokenPrefix: string;
  completedScenario: 1 | 2 | 3;
  body: string;
} | null {
  const m = (text ?? '').match(/^(\[SCENARIO_COMPLETE:\s*(\d+)\]\s*(?:\n\n)?)/i);
  if (!m?.[2]) return null;
  const completedScenario = parseInt(m[2], 10);
  if (completedScenario < 1 || completedScenario > 3) return null;
  return {
    tokenPrefix: m[1]!,
    completedScenario: completedScenario as 1 | 2 | 3,
    body: text.slice(m[1]!.length).trim(),
  };
}

/** Infer which scenario just completed from the locked next-segment body in a handoff bundle. */
export function inferCompletedScenarioFromHandoffBundle(bundleText: string): 1 | 2 | 3 | null {
  const body = stripControlTokens(bundleText).trim();
  if (!body) return null;
  const tokenParsed = parseScenarioCompleteAdvanceBundle(body);
  const bundleBody = tokenParsed?.body ?? body;
  const split = bundleBody.indexOf('\n\n');
  const afterModal = split > 0 ? bundleBody.slice(split + 2).trim() : bundleBody;
  if (textContainsScenarioBVignetteBody(afterModal)) return 1;
  if (textContainsScenarioCVignetteBody(afterModal)) return 2;
  if (
    looksLikeMoment4GrudgePrompt(afterModal) ||
    assistantTextLooksLikeMoment4HandoffLead(afterModal) ||
    assistantTextLooksLikeMoment4HandoffLead(bundleBody)
  ) {
    return 3;
  }
  return null;
}

/**
 * Phase 2: swap static boundary lead for Claude ack+transition while preserving locked next segment.
 * No-op when LLM disabled or bundle is not a scenario handoff.
 */
export async function enrichScenarioBoundaryHandoffBundleWithDynamicLead(args: {
  bundleText: string;
  firstName: string;
  messages: readonly PostClaudeScenarioAdvanceMessage[];
  completedScenario?: 1 | 2 | 3;
  interviewSessionId?: string | null;
  timeoutMs?: number;
}): Promise<string> {
  const trimmed = (args.bundleText ?? '').trim();
  if (!trimmed) return trimmed;

  const tokenParsed = parseScenarioCompleteAdvanceBundle(trimmed);
  const bundleBody = tokenParsed?.body ?? stripControlTokens(trimmed).trim();
  const completedScenario =
    args.completedScenario ??
    tokenParsed?.completedScenario ??
    inferCompletedScenarioFromHandoffBundle(bundleBody);
  if (!completedScenario) return args.bundleText;

  const userCorpus = resolveScenarioUserTextForBoundaryReflection(args.messages, completedScenario);
  const { lead } = await resolveScenarioBoundaryLeadForInterview({
    completedScenario,
    firstName: args.firstName,
    lastUserAnswer: userCorpus || null,
    interviewSessionId: args.interviewSessionId,
    timeoutMs: args.timeoutMs,
  });
  const enrichedBody = replaceScenarioBoundaryLeadInBundle(bundleBody, lead);
  if (tokenParsed) {
    return `${tokenParsed.tokenPrefix}${enrichedBody}`.trim();
  }
  return enrichedBody;
}

export { staticScenarioBoundaryLeadFallback };
