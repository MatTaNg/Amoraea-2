/**
 * Split user text into "fictional scenarios" vs "personal moments" using the scripted handoff line.
 * Used for matchmaker summary register-mismatch detection (scenario verdict tone vs personal reflection).
 */

import { coerceInterviewTranscriptArray } from './interviewStyleMarkers.ts';

export type TranscriptMsg = { role?: string; content?: string };

/** Re-export transcript coercion for edge handlers (same as userTurnContents path). */
export function parseInterviewTranscriptMessages(raw: unknown): TranscriptMsg[] {
  return coerceInterviewTranscriptArray(raw) as TranscriptMsg[];
}

const PERSONAL_SEGMENT_ANCHOR = "we've finished the three situations";
/** Production `MOMENT_4_HANDOFF` (AriaScreen): "Good work, you just finished the three situations…" */
const FINISHED_THREE_SITUATIONS = 'finished the three situations';

/**
 * Transcripts often use Unicode apostrophe (U+2019) in "We've"; plain `includes("we've")` then fails.
 */
function normalizeAssistantTextForHandoffMatch(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFKC')
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u02bc/g, "'");
}

function assistantHandoffSplitIndex(content: string): boolean {
  const n = normalizeAssistantTextForHandoffMatch(content);
  // Do not require the word "personal" — live copy uses "more about you" / "two questions left".
  return n.includes(PERSONAL_SEGMENT_ANCHOR) || n.includes(FINISHED_THREE_SITUATIONS);
}

/** Unique to post-scenario Moment 4 card (`MOMENT_4_PERSONAL_CARD`); survives split assistant bubbles. */
const GRUDGE_PROMPT_SNIPPET = 'held a grudge against';

export type HandoffSplitReason =
  | 'finished_three_situations'
  | 'moment4_grudge_prompt'
  | 'empty_transcript'
  | 'not_found';

/**
 * Index of the assistant turn that ends the fictional segment (split before personal user answers).
 * Fallback uses the grudge prompt when "finished the three situations" is split across bubbles.
 */
export function findHandoffAssistantIndex(transcript: TranscriptMsg[]): {
  index: number;
  reason: HandoffSplitReason;
} {
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return { index: -1, reason: 'empty_transcript' };
  }
  const idxThree = transcript.findIndex(
    (m) =>
      String(m.role ?? '').toLowerCase() === 'assistant' &&
      typeof m.content === 'string' &&
      assistantHandoffSplitIndex(m.content)
  );
  if (idxThree >= 0) return { index: idxThree, reason: 'finished_three_situations' };
  const idxGrudge = transcript.findIndex(
    (m) =>
      String(m.role ?? '').toLowerCase() === 'assistant' &&
      typeof m.content === 'string' &&
      normalizeAssistantTextForHandoffMatch(m.content).includes(GRUDGE_PROMPT_SNIPPET)
  );
  if (idxGrudge >= 0) return { index: idxGrudge, reason: 'moment4_grudge_prompt' };
  return { index: -1, reason: 'not_found' };
}

export function splitUserCorpusScenarioVsPersonal(transcript: TranscriptMsg[]): {
  scenarioCorpus: string;
  personalCorpus: string;
} {
  if (!Array.isArray(transcript) || transcript.length === 0) {
    return { scenarioCorpus: '', personalCorpus: '' };
  }
  const { index: splitIdx } = findHandoffAssistantIndex(transcript);
  if (splitIdx < 0) {
    return { scenarioCorpus: '', personalCorpus: '' };
  }
  const before = transcript.slice(0, splitIdx);
  const after = transcript.slice(splitIdx + 1);
  const scenarioUser = before
    .filter((m) => String(m.role ?? '').toLowerCase() === 'user' && typeof m.content === 'string')
    .map((m) => String(m.content).trim())
    .filter(Boolean);
  const personalUser = after
    .filter((m) => String(m.role ?? '').toLowerCase() === 'user' && typeof m.content === 'string')
    .map((m) => String(m.content).trim())
    .filter(Boolean);
  return {
    scenarioCorpus: scenarioUser.join(' ').toLowerCase(),
    personalCorpus: personalUser.join(' ').toLowerCase(),
  };
}

/** User message strings in interview order for the fictional segment only (before personal handoff). */
export function userTurnStringsScenarioSegment(transcript: TranscriptMsg[]): string[] {
  if (!Array.isArray(transcript) || transcript.length === 0) return [];
  const { index: splitIdx } = findHandoffAssistantIndex(transcript);
  if (splitIdx < 0) return [];
  return transcript
    .slice(0, splitIdx)
    .filter((m) => String(m.role ?? '').toLowerCase() === 'user' && typeof m.content === 'string')
    .map((m) => String(m.content).trim())
    .filter(Boolean);
}

/**
 * The three "main" vignette analysis answers — the user turn immediately after each scripted opening
 * question (`AriaScreen` SCENARIO_*_OPENING). Excludes probes/repair prompts so "I feel…" in a later
 * repair line cannot qualify **more heart than head** when the three openings stayed analytical.
 */
export function userTurnStringsScenarioMainAnalysis(transcript: TranscriptMsg[]): string[] {
  if (!Array.isArray(transcript) || transcript.length === 0) return [];
  const { index: splitIdx } = findHandoffAssistantIndex(transcript);
  const slice = splitIdx >= 0 ? transcript.slice(0, splitIdx) : [];
  const out: string[] = [];
  for (let i = 0; i < slice.length - 1; i++) {
    const m = slice[i];
    if (String(m.role ?? '').toLowerCase() !== 'assistant' || typeof m.content !== 'string') continue;
    const n = normalizeAssistantTextForHandoffMatch(m.content);
    const isMainOpeningQuestion =
      n.includes("what's going on between these two") ||
      n.includes('what do you think is going on here') ||
      n.includes('what do you make of that');
    if (!isMainOpeningQuestion) continue;
    const next = slice[i + 1];
    if (String(next.role ?? '').toLowerCase() === 'user' && typeof next.content === 'string') {
      const t = String(next.content).trim();
      if (t) out.push(t);
    }
  }
  return out;
}
