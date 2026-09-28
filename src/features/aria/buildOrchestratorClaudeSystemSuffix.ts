import type { InterviewTurnOrchestratorDecision } from '@features/aria/interviewTurnOrchestratorTypes';

/**
 * Per-turn Claude suffix from the orchestrator (Phase 2 meta / redirect paths).
 */
export function buildOrchestratorClaudeSystemSuffix(args: {
  decision: InterviewTurnOrchestratorDecision;
  activeQuestionText: string;
}): string {
  const action = args.decision.action;
  if (action.kind !== 'delegate_claude') return '';

  const activeQ = (args.activeQuestionText ?? '').trim().slice(0, 500);
  const activeBlock = activeQ
    ? `\n**Active interview question they should return to (shorten if needed — do not re-read full vignette):**\n"${activeQ}"\n`
    : '';

  switch (action.hint) {
    case 'gentle_redirect':
      return `
─────────────────────────────────────────
ORCHESTRATOR (PHASE 2): GENTLE REDIRECT
─────────────────────────────────────────
The participant's reply did not engage the active interview question (off-topic, identity ask, confusion about what to answer, or unclear).

Respond as Amoraea — warm, human, lightly witty when appropriate (see OFF-TOPIC rules). **Answer what they asked** if it is a question about you or the process.

When they are **confused about what you want** (e.g. whether to infer motives, what kind of answer counts, or they say there was no question): acknowledge briefly, explain in plain language what you are looking for (their read on what is happening between the people in the scenario — not facts alone), offer to repeat the exact question if helpful, then re-ask the essential core.

Do **not** open with brief acknowledgments ("That makes sense", "That makes a lot of sense", "Got it", "I'm with you") — their turn did not answer the question.

Then **in the same turn**, bridge back: one short clause + **re-ask the essential core** of the active question (shortened — no vignette replay).
${activeBlock}
Do **not** leave silence after your reply. Do **not** say you are an AI or language model.
`;
    case 'answer_meta_then_continue':
      return `
─────────────────────────────────────────
ORCHESTRATOR (PHASE 2): META / PROCESS QUESTION
─────────────────────────────────────────
The participant is asking about the interview, checking in, or pushing back on process — **not** answering the active question.

Respond naturally in character. Address their concern first.

When they are confused about **what** you are asking (what to infer, whether there was a question, what kind of answer you want): explain briefly what you are looking for, offer to repeat the exact question if that would help, then guide them back.

Do **not** open with brief acknowledgments ("That makes sense", "That makes a lot of sense", "Got it", "I'm with you") when they did not answer the active question.

Then **in the same turn**, guide them back with a brief bridge and **re-ask or restate the essential core** of the active question (shortened).
${activeBlock}
Do **not** expose internal sequencing ("I'm skipping a question"). Do **not** re-read scenario fiction.
`;
    case 'check_before_ask':
    default:
      return `
─────────────────────────────────────────
ORCHESTRATOR (PHASE 2): CHECK BEFORE ASK
─────────────────────────────────────────
Before any follow-up, decide whether their latest turn already engaged the construct behind the pending probe. If yes, advance with a neutral bridge only — **never** tell them they already answered.

If they did not engage, ask the next required question (canonical wording when provided elsewhere in instructions).
${activeBlock}
`;
  }
}
