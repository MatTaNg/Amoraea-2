export function buildInterviewCutOffCompletenessLlmPrompt(args: {
  activeQuestionPreview: string;
  userText: string;
}): string {
  return `You judge whether a spoken interview answer was cut off mid-sentence (mic stopped before the thought finished).

**Interview question they were answering:** "${args.activeQuestionPreview.slice(0, 280)}"
**User transcript (from speech-to-text):** "${args.userText.slice(0, 400)}"

Rules:
- cut_off=true when the utterance is grammatically incomplete, trails off, or clearly stopped before answering the question — even if it names scenario characters.
- cut_off=false when it is a complete short answer ("I don't know", "No", "Yes"), a full thought, or a valid partial that still answers the question.
- Do not treat frustration or meta comments as cut-offs unless the sentence itself is incomplete.

Respond with JSON only:
{"cut_off": boolean, "confidence": number between 0 and 1, "reason": string}`;
}
