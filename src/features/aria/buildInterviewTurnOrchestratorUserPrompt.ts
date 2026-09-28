import { INTERVIEW_CANONICAL_PROBES } from '@features/aria/interviewCanonicalProbeRegistry';
import { INTERVIEW_TURN_ORCHESTRATOR_SYSTEM } from '@features/aria/interviewTurnOrchestratorPrompt';
import type { MetaCommentClassification } from '@features/aria/metaCommentClassification';
import type { MessageWithScenario } from '@features/aria/interviewScenarioScoringSlice';
import type { PreClaudeScenarioConstructProbeFlags } from '@features/aria/resolvePreClaudeScenarioConstructProbeFlags';
import type { InterviewTurnStateSnapshot } from '@features/aria/interviewTurnOrchestratorTypes';

function recentTranscriptExcerpt(
  messages: readonly MessageWithScenario[],
  limit = 8,
): string {
  const slice = messages.slice(-limit);
  if (!slice.length) return '(empty transcript)';
  return slice
    .map((m, i) => {
      const role = m.role === 'assistant' ? 'Amoraea' : 'User';
      const text = String(m.content ?? '').trim().slice(0, 320);
      return `${i + 1}. ${role}: "${text}"`;
    })
    .join('\n');
}

function constructFlagsSummary(flags: PreClaudeScenarioConstructProbeFlags): string {
  return JSON.stringify(
    {
      shouldForceScenarioAContemptProbe: flags.shouldForceScenarioAContemptProbe,
      allowScenarioARepairAfterContemptAnswer: flags.allowScenarioARepairAfterContemptAnswer,
      shouldForceScenarioBJamesRepairProbe: flags.shouldForceScenarioBJamesRepairProbe,
      shouldForceScenarioCSophiePerspectiveProbe: flags.shouldForceScenarioCSophiePerspectiveProbe,
      specificEmmaLineAlreadyAddressed: flags.specificEmmaLineAlreadyAddressed,
      replyingToScenarioAQ1: flags.replyingToScenarioAQ1,
      replyingToScenarioBQ1: flags.replyingToScenarioBQ1,
      replyingToScenarioCQ1: flags.replyingToScenarioCQ1,
    },
    null,
    0,
  );
}

export function buildInterviewTurnOrchestratorUserPrompt(args: {
  snapshot: InterviewTurnStateSnapshot;
  messages: readonly MessageWithScenario[];
  constructFlags: PreClaudeScenarioConstructProbeFlags;
  metaCommentClassification: MetaCommentClassification | null;
}): string {
  const probeCatalog = Object.values(INTERVIEW_CANONICAL_PROBES)
    .map((p) => `- ${p.id}: ${p.construct}`)
    .join('\n');

  const metaLine = args.metaCommentClassification
    ? `Meta classifier: type=${args.metaCommentClassification.type}`
    : 'Meta classifier: (none)';

  return `${INTERVIEW_TURN_ORCHESTRATOR_SYSTEM}

---

**Turn snapshot**
- moment: ${args.snapshot.currentInterviewMoment}
- scenario: ${args.snapshot.currentScenario}
- transcript turns: ${args.snapshot.transcriptTurnCount}
- last assistant (preview): "${args.snapshot.lastAssistantContent.slice(0, 320)}"
- last question text: "${args.snapshot.lastQuestionText.slice(0, 320)}"
- latest user turn: "${args.snapshot.userText.slice(0, 400)}"

${metaLine}
Construct flags: ${constructFlagsSummary(args.constructFlags)}

**Canonical probe ids (speak_canonical must use one of these):**
${probeCatalog}

**Recent transcript (oldest first):**
${recentTranscriptExcerpt(args.messages)}

Plan this turn. Respond with JSON only.`;
}
