const SCENARIO_CONTEXT: Record<
  1 | 2 | 3,
  { completedLabel: string; characters: string; nextSegment: string }
> = {
  1: {
    completedLabel: 'Situation 1 (Emma and Ryan)',
    characters: 'Emma and Ryan',
    nextSegment: 'Situation 2 (Sarah and James)',
  },
  2: {
    completedLabel: 'Situation 2 (Sarah and James)',
    characters: 'Sarah and James',
    nextSegment: 'Situation 3 (Sophie and Daniel)',
  },
  3: {
    completedLabel: 'Situation 3 (Sophie and Daniel)',
    characters: 'Sophie and Daniel',
    nextSegment: 'three personal questions about their own relationships',
  },
};

const STATIC_FALLBACK_BY_SCENARIO: Record<1 | 2 | 3, string> = {
  1: "Good work — that's the end of this scenario. Here's the next situation.",
  2: "That's the second one done. One more situation and then we'll get personal.",
  3: 'Good work — you just finished the three scenarios. Next are three personal questions.',
};

export function staticScenarioBoundaryLeadFallback(completedScenario: 1 | 2 | 3): string {
  return STATIC_FALLBACK_BY_SCENARIO[completedScenario];
}

export function buildInterviewScenarioBoundaryLlmPrompt(args: {
  completedScenario: 1 | 2 | 3;
  userCorpus: string;
  staticFallback: string;
}): string {
  const ctx = SCENARIO_CONTEXT[args.completedScenario];
  const userBlock = args.userCorpus.trim()
    ? args.userCorpus.trim().slice(0, 1200)
    : '(participant gave brief or minimal answers)';

  return `You write spoken interviewer copy for Amoraea, a relationship interview voice assistant.

The participant just finished **${ctx.completedLabel}**. Their answers from that scenario are below.

Write **only** the acknowledgement + transition that plays **before** the next locked script segment (${ctx.nextSegment}). This is NOT the next vignette or personal question — only the brief wrap and pivot.

Requirements:
- 1–3 short sentences, plain spoken English, warm and natural.
- Optionally anchor on **one specific detail** they actually said about ${ctx.characters} — only if accurate and grammatically complete.
- If nothing specific is available, use a brief generic segment close + pivot (like the fallback tone).
- Signal that this scenario is done and we are moving on (${args.completedScenario === 3 ? 'toward personal questions' : 'to the next situation'}).
- Do **not** use the participant's first name.
- Do **not** ask a question.
- Do **not** include vignette fiction, character setup, or the next scenario's opening question.
- Do **not** mention "Amoraea", scores, therapy, or clinical labels (attunement, mentalizing, dysregulation, repair cycle).
- Do **not** start with "Sure", "Okay", "Absolutely", "That makes sense", or "Got it".
- Do **not** say "Let's start with something more personal" or "Now I want to ask you about something a bit more personal."
- Output plain text only — no JSON, quotes, labels, or preamble.

Static fallback (match this intent if you cannot ground a specific observation):
"${args.staticFallback}"

Participant answers for ${ctx.completedLabel}:
${userBlock}

Write only the acknowledgement + transition line(s):`;
}
