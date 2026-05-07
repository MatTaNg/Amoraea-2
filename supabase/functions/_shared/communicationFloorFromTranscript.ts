/** Keep in sync with src/features/aria/communicationFloorFromTranscript.ts (Deno bundle). */

export const COMMUNICATION_FLOOR_MIN_AVG_WORDS = 20;

export type CommunicationFloorTranscriptLine = {
  role: string;
  content?: string;
  scenarioNumber?: number;
  isScoreCard?: boolean;
  isWelcomeBack?: boolean;
};

export type CommunicationFloorMetrics = {
  /** Average word count over included unprompted user turns; null when none included. */
  averageUnpromptedWordCount: number | null;
  includedUnpromptedCount: number;
  /** True when at least one included turn exists and average < COMMUNICATION_FLOOR_MIN_AVG_WORDS. */
  flagged: boolean;
};

function normalizeRole(role: string | undefined): 'user' | 'assistant' | 'other' {
  const r = (role ?? '').toLowerCase().trim();
  if (r === 'user') return 'user';
  if (r === 'assistant') return 'assistant';
  return 'other';
}

export function countWords(text: string | undefined | null): number {
  const t = (text ?? '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

/** Scripted Moment 5 appreciation anchor (aligned with AriaScreen heuristic). */
export function transcriptLooksLikeAppreciationPrompt(text: string): boolean {
  const t = text.toLowerCase();
  return t.includes('think of a time you really celebrated someone') || (t.includes('really celebrated') && t.includes('your life'));
}

function looksLikeScenarioOneAssistantAnchor(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('emma and ryan') ||
    t.includes('emma & ryan') ||
    t.includes("here's the first situation") ||
    t.includes('here’s the first situation') ||
    /\bfirst situation\b/i.test(t) ||
    (t.includes('emma') && t.includes('ryan'))
  );
}

function looksLikeMomentFourAssistantAnchor(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes('something a bit more personal') ||
    t.includes('something more personal') ||
    t.includes('held a grudge') ||
    /real (memory|example|situation|experience)/i.test(t) ||
    t.includes('from your life') ||
    /\bmoment 4\b/i.test(t)
  );
}

function dialogueLines(raw: CommunicationFloorTranscriptLine[]): CommunicationFloorTranscriptLine[] {
  return raw.filter((m) => {
    if (m.isScoreCard) return false;
    const role = normalizeRole(m.role);
    return role === 'user' || role === 'assistant';
  });
}

function indexOfFirstScenarioAssistant(lines: CommunicationFloorTranscriptLine[]): number {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!;
    if (normalizeRole(m.role) !== 'assistant') continue;
    const c = m.content ?? '';
    if (looksLikeScenarioOneAssistantAnchor(c)) return i;
  }
  return -1;
}

function indexOfMomentFourStart(lines: CommunicationFloorTranscriptLine[]): number {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!;
    if (normalizeRole(m.role) !== 'assistant') continue;
    if (looksLikeMomentFourAssistantAnchor(m.content ?? '')) return i;
  }
  return -1;
}

function indexOfMomentFiveStart(lines: CommunicationFloorTranscriptLine[]): number {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!;
    if (normalizeRole(m.role) !== 'assistant') continue;
    if (transcriptLooksLikeAppreciationPrompt(m.content ?? '')) return i;
  }
  return -1;
}

function assistantBlockIntroducesNewPrimaryPrompt(joinedBlock: string): boolean {
  const t = joinedBlock.toLowerCase();
  return (
    looksLikeScenarioOneAssistantAnchor(t) ||
    looksLikeMomentFourAssistantAnchor(t) ||
    transcriptLooksLikeAppreciationPrompt(t) ||
    /\bjames and sarah\b|\bsarah and james\b|\bsophie and daniel\b|\bdaniel and sophie\b|\bemma and ryan\b|\bryan and emma\b/i.test(t) ||
    /\bsecond scenario\b|\bthird scenario\b|\bnext scenario\b|\bscenario\s*[bc]\b|\bscenario\s*two\b|\bscenario\s*three\b/i.test(t) ||
    /\blet'?s (?:move|shift|turn)\b/i.test(t) ||
    t.length > 420
  );
}

/** Opening / welcome-back user lines are not “answers” for probe chaining — the following main prompt is fresh. */
function prevUserResetsPromptContext(
  lines: CommunicationFloorTranscriptLine[],
  prevIdx: number,
  scenarioAssistantIdx: number
): boolean {
  if (prevIdx < 0) return false;
  if (normalizeRole(lines[prevIdx]!.role) !== 'user') return false;
  return (
    exemptOpeningUserTurn(lines, prevIdx, scenarioAssistantIdx) ||
    exemptReentryConfirmationUserTurn(lines, prevIdx)
  );
}

function isUnpromptedUserTurn(
  lines: CommunicationFloorTranscriptLine[],
  dialogueIndex: number,
  scenarioAssistantIdx: number
): boolean {
  const blockEnd = dialogueIndex - 1;
  if (blockEnd < 0) return true;
  if (normalizeRole(lines[blockEnd]!.role) !== 'assistant') return true;

  let blockStart = blockEnd;
  while (blockStart >= 0 && normalizeRole(lines[blockStart]!.role) === 'assistant') blockStart--;
  blockStart++;

  const prevIdx = blockStart - 1;
  if (prevIdx < 0) return true;
  const prevRole = normalizeRole(lines[prevIdx]!.role);
  if (prevRole !== 'user') return true;
  if (prevUserResetsPromptContext(lines, prevIdx, scenarioAssistantIdx)) return true;

  const joined = lines
    .slice(blockStart, blockEnd + 1)
    .map((x) => x.content ?? '')
    .join('\n');
  if (assistantBlockIntroducesNewPrimaryPrompt(joined)) return true;
  return false;
}

function indexOfFirstUserLine(lines: CommunicationFloorTranscriptLine[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (normalizeRole(lines[i]!.role) === 'user') return i;
  }
  return -1;
}

function indexOfNthUserLine(lines: CommunicationFloorTranscriptLine[], n: number): number {
  let seen = 0;
  for (let i = 0; i < lines.length; i++) {
    if (normalizeRole(lines[i]!.role) !== 'user') continue;
    seen++;
    if (seen === n) return i;
  }
  return -1;
}

function looksLikeShortReadyConfirmation(text: string): boolean {
  const t = text.toLowerCase().trim();
  if (t.length === 0) return false;
  if (countWords(text) > 6) return false;
  return /^(yes|yeah|yep|yup|sure|ready|ok|okay|i(?:'|’)?m ready)\b/i.test(t);
}

function exemptOpeningUserTurn(
  lines: CommunicationFloorTranscriptLine[],
  dialogueIndex: number,
  scenarioAssistantIdx: number
): boolean {
  if (scenarioAssistantIdx >= 0) {
    /** Everything strictly before the Scenario A anchor assistant is name / ready / mic preamble — exempt. */
    return dialogueIndex < scenarioAssistantIdx;
  }
  /** Older transcripts without a clear Scenario A anchor: first user ≈ name; second may be ready yes/no. */
  const firstUserIdx = indexOfFirstUserLine(lines);
  if (firstUserIdx >= 0 && dialogueIndex === firstUserIdx) return true;
  const secondUserIdx = indexOfNthUserLine(lines, 2);
  if (secondUserIdx >= 0 && dialogueIndex === secondUserIdx) {
    return looksLikeShortReadyConfirmation(lines[dialogueIndex]?.content ?? '');
  }
  return false;
}

function assistantLooksLikeResumeOrWelcomeBack(prev: CommunicationFloorTranscriptLine): boolean {
  if (prev.isWelcomeBack === true) return true;
  const c = (prev.content ?? '').toLowerCase();
  return (
    /\bwelcome back\b/.test(c) ||
    /\bpick up where we left\b/.test(c) ||
    (/\bresume\b/.test(c) && /\b(left off|continue)\b/.test(c))
  );
}

/** Short confirmation after resume/welcome-back assistant (not a substantive answer). */
function exemptReentryConfirmationUserTurn(
  lines: CommunicationFloorTranscriptLine[],
  dialogueIndex: number
): boolean {
  if (dialogueIndex === 0) return false;
  const prev = lines[dialogueIndex - 1]!;
  if (normalizeRole(prev.role) !== 'assistant' || !assistantLooksLikeResumeOrWelcomeBack(prev)) return false;
  const text = lines[dialogueIndex]?.content ?? '';
  if (countWords(text) > 8) return false;
  const t = text.toLowerCase().trim();
  if (t.length === 0) return false;
  return /^(yes|yeah|yep|yup|sure|ok|okay|ready|i(?:'|’)?m ready|let'?s go|continue|sounds good|go ahead)\b/i.test(
    t,
  );
}

function classifySegment(
  lines: CommunicationFloorTranscriptLine[],
  dialogueIndex: number,
  sn: number | undefined,
  m4: number,
  m5: number
): 'scenario' | 'moment4' | 'moment5' | 'exclude' {
  if (sn === 4) return 'moment4';
  const i = dialogueIndex;
  if (m5 >= 0 && i >= m5) return 'moment5';
  if (m4 >= 0 && i >= m4) return 'moment4';
  if (sn === 1 || sn === 2 || sn === 3) return 'scenario';
  /** Stored transcripts often omit scenarioNumber; everything before the Moment 4 anchor is still scenarios A–C. */
  if (sn == null && m4 >= 0 && i < m4) return 'scenario';
  if (sn == null && m4 >= 0 && i >= m4 && (m5 < 0 || i < m5)) return 'moment4';
  if (sn == null && m5 >= 0 && i >= m5) return 'moment5';
  if (sn == null && m4 < 0 && (m5 < 0 || i < m5)) return 'scenario';
  return 'exclude';
}

/**
 * Walks `transcript` in order; counts unprompted user responses in scenarios A–C, moment 4, and moment 5.
 */
export function computeCommunicationFloorMetrics(
  transcript: CommunicationFloorTranscriptLine[] | null | undefined
): CommunicationFloorMetrics {
  const lines = dialogueLines(transcript ?? []);
  if (lines.length === 0) {
    return { averageUnpromptedWordCount: null, includedUnpromptedCount: 0, flagged: false };
  }

  const scenarioAssistantIdx = indexOfFirstScenarioAssistant(lines);
  const m4 = indexOfMomentFourStart(lines);
  const m5 = indexOfMomentFiveStart(lines);

  const counts: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i]!;
    if (normalizeRole(m.role) !== 'user') continue;
    if (exemptOpeningUserTurn(lines, i, scenarioAssistantIdx)) continue;
    if (exemptReentryConfirmationUserTurn(lines, i)) continue;

    const sn = typeof m.scenarioNumber === 'number' ? m.scenarioNumber : undefined;
    const segment = classifySegment(lines, i, sn, m4, m5);
    if (segment === 'exclude') continue;
    if (!isUnpromptedUserTurn(lines, i, scenarioAssistantIdx)) continue;

    const wc = countWords(m.content);
    if (wc <= 0) continue;
    counts.push(wc);
  }

  if (counts.length === 0) {
    return { averageUnpromptedWordCount: null, includedUnpromptedCount: 0, flagged: false };
  }
  const sum = counts.reduce((a, b) => a + b, 0);
  const averageUnpromptedWordCount = sum / counts.length;
  const flagged = averageUnpromptedWordCount < COMMUNICATION_FLOOR_MIN_AVG_WORDS;
  return { averageUnpromptedWordCount, includedUnpromptedCount: counts.length, flagged };
}

/** Payload fragment for `interview_attempts` upsert from client or edge. */
export function communicationFloorFieldsFromTranscript(
  transcript: CommunicationFloorTranscriptLine[] | null | undefined
): {
  communication_floor_flag: boolean;
  communication_floor_avg_unprompted_words: number | null;
} {
  const m = computeCommunicationFloorMetrics(transcript);
  return {
    communication_floor_flag: m.flagged,
    communication_floor_avg_unprompted_words:
      m.averageUnpromptedWordCount != null ? Math.round(m.averageUnpromptedWordCount * 1000) / 1000 : null,
  };
}
