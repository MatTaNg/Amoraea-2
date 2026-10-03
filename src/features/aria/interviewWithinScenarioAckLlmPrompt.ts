export function buildInterviewWithinScenarioAckLlmPrompt(args: {
  userText: string;
  activeQuestionPreview: string;
  recentAckPreviews: string[];
}): string {
  const recentBlock = args.recentAckPreviews.length
    ? args.recentAckPreviews.map((a) => `"${a}"`).join(', ')
    : '(none)';

  return `You write a single brief spoken acknowledgement for Amoraea, a relationship interview voice assistant.

The participant just answered a scenario question. Before the next **verbatim scripted question** plays, speak ONE short receipt (about 3–10 words).

Requirements:
- Anchor on **one specific detail** they said when accurate; otherwise a neutral warm receipt ("Thanks for sharing that.").
- Plain spoken English — not a question, not a transition to the next scenario.
- Do **not** repeat or closely paraphrase recent acknowledgements: ${recentBlock}
- Do **not** start with "Sure", "Okay", "Absolutely", "That makes sense", or "Got it".
- Do **not** use clinical jargon or evaluative praise ("great job", "very insightful").
- Do **not** say "that comes through clearly" or restate their answer as a reflection.
- Output plain text only — no quotes or preamble.

They were answering: "${args.activeQuestionPreview.slice(0, 240)}"
Their latest answer: "${args.userText.slice(0, 400)}"

Write only the brief acknowledgement:`;
}
