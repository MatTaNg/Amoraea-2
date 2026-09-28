import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import { describeProbeConstructForLlm } from '@features/aria/evaluateInterviewProbeConstructSatisfaction';
import type { InterviewTurnOrchestratorDecision } from '@features/aria/interviewTurnOrchestratorTypes';

/**
 * Claude suffix when a pending canonical probe's construct is already satisfied —
 * bridge forward without re-asking or telling the participant they already answered.
 */
export function buildOrchestratorSkipProbeSatisfiedSuffix(args: {
  decision: InterviewTurnOrchestratorDecision;
  activeQuestionText: string;
  satisfactionReason: string;
}): string {
  const action = args.decision.action;
  if (action.kind !== 'skip_probe_already_satisfied') return '';

  const probeId = action.probeId as InterviewCanonicalProbeId;
  const construct = describeProbeConstructForLlm(probeId);
  const activeQ = (args.activeQuestionText ?? '').trim().slice(0, 500);
  const activeBlock = activeQ
    ? `\n**They were responding to:** "${activeQ}"\n`
    : '';
  const advanceNote = action.advanceToProbeId
    ? `\n**Next required probe id (internal):** ${action.advanceToProbeId} — use canonical wording from instructions when you reach it.\n`
    : '';

  return `
─────────────────────────────────────────
ORCHESTRATOR (PHASE 3): CONSTRUCT ALREADY SATISFIED — DO NOT RE-ASK
─────────────────────────────────────────
The participant **already engaged** the construct behind pending probe **${probeId}** (${construct}).
Client check: ${args.satisfactionReason}

**Do not** deliver the ${probeId} canonical question — they would hear a duplicate beat.
**Do not** say they already answered or that you are skipping a question.

Your single spoken turn: one **neutral bridge** (e.g. "Got it — let's keep going.") then the **next** scripted question in sequence that is still required — shortened setup only, no vignette replay.
${activeBlock}${advanceNote}
`;
}
