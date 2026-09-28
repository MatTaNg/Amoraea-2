import type { InterviewCanonicalProbeId } from '@features/aria/interviewCanonicalProbeRegistry';
import { describeProbeConstructForLlm } from '@features/aria/evaluateInterviewProbeConstructSatisfaction';

export function buildInterviewConstructSatisfactionLlmPrompt(args: {
  probeId: InterviewCanonicalProbeId;
  activeQuestionPreview: string;
  userText: string;
  recentUserTurns: string[];
}): string {
  const construct = describeProbeConstructForLlm(args.probeId);
  const recentBlock = args.recentUserTurns.length
    ? args.recentUserTurns.map((t, i) => `${i + 1}. "${t.slice(0, 400)}"`).join('\n')
    : '(none)';

  return `You are evaluating whether a relationship-interview participant already substantively addressed a required construct — even if they did so before the exact scripted follow-up question was asked.

**Pending probe id:** ${args.probeId}
**Construct (what we need):** ${construct}
**Active question they may have been answering:** "${args.activeQuestionPreview.slice(0, 300)}"
**Latest user turn:** "${args.userText.slice(0, 400)}"

**Recent user turns in this scenario (newest last):**
${recentBlock}

Rules:
- satisfied=true if ANY recent user turn (including the latest) already gives scorable content for this construct — even shallowly.
- satisfied=false if they only named characters, went off-topic, or gave a cut-off with no construct content.
- Do not require verbatim probe wording — judge substance only.

Respond with JSON only:
{"satisfied": boolean, "confidence": number between 0 and 1, "reason": string}`;
}
