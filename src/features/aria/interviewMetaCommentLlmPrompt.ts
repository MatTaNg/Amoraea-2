export function buildInterviewMetaCommentLlmPrompt(args: {
  activeQuestionPreview: string;
  userText: string;
  heuristicType: string | null;
  heuristicConfidence: number | null;
}): string {
  const heuristicLine =
    args.heuristicType != null
      ? `${args.heuristicType} (confidence ${args.heuristicConfidence ?? 'unknown'})`
      : 'none';

  return `You classify what a relationship-interview participant meant on their latest spoken turn.

**Active interview question:** "${args.activeQuestionPreview.slice(0, 280)}"
**User transcript:** "${args.userText.slice(0, 400)}"
**Regex/heuristic guess:** ${heuristicLine}

Choose exactly one label:
- substantive_answer — they are answering the interview question (even if short or hedged)
- cut_off — mic stopped mid-sentence; utterance is grammatically incomplete
- none — filler / acknowledgment with no meta intent (e.g. "okay", "um")
- frustration — impatience, pushback, "what do you want from me", sufficiency challenge
- confusion — unclear what is being asked; wants clarification (NOT a repeat request unless they explicitly ask to repeat)
- confusion + repeat_request — explicitly asks to repeat the question/scenario verbatim
- checking_in — "was that enough?", "did you get that?"
- skip_request — wants to skip/move on/pass
- inability — "I don't know", can't answer, drawing a blank
- already_answered — claims they already answered this question

Rules:
- Prefer substantive_answer when they engage with the scenario even if unsure.
- Do not label cut_off unless the sentence itself is incomplete.
- "I don't know" on a hard question → inability (not ambiguous_short).
- Distinguish frustration (pushback) from confusion (clarification).

Respond with JSON only:
{"meta_type": string, "confidence": number between 0 and 1, "confusion_subtype": "repeat_request" | null, "reason": string}`;
}
