/**
 * Programmatic caps complement LLM rubric {@link ELABORATION_ABSENCE_SCENARIO_MARKERS}.
 */
import { sliceTranscriptBeforeScenarioCToPersonalHandoff } from './probeAndScoringUtils';

const INTERNAL_STATE_CUES =
  /\b(feel|felt|feeling|feels|afraid|fear|feared|scared|hurt|hurting|need|needs|lonely|ashamed|overwhelm|vulnerable|embarrassed|wonder(?:ed|ing)?|maybe (?:he|she|they)|what (?:might|could|does)|internal|subjectively)\b/i;

/** Attachment/personality shorthand without inferring inner experience — triggers mentalizing ceiling. */
const DIAGNOSTIC_TYPING_PATTERN =
  /\b(narciss(?:ist|istic)|machiavellian|borderline(?:\s+traits|\s+personality)?|psychopath|sociopath|-dismissive(?:\s+avoidant)?|\bdismissive\s+avoidant\b|\banxious\s*-?\s*(?:attachment|preoccupied|avoidant)|\bfearful\s*-?\s*avoidant|\bsecure\s*-?\s*attachment|\bavoidant\s*-?\s*attachment|\battachment\s+style|love\s+language|ADHD|OCD|bi\s*polar)\b/i;

const ABSOLUTION_BEFORE_INSIGHT = /\b(everything\s+(?:he|she|they)\s+could|did\s+everything\s+possible|nothing\s+(?:wrong|to apologize)|wasn'?t\s+(?:his|her|their)\s+fault|can'?t\s+blame\s+(?:him|her|them)|perfect\s+(?:husband|wife|partner|boyfriend|girlfriend))\b/i;

const LOGISTICS_ONLY_REPAIR =
  /\b(plan\s+another|phones?\s+off|calendar|schedule\s+a|reschedule|book\s+a\s+(?:trip|table)|turn\s+(?:our\s+)?phones)\b/i;

/** Compensatory / scheduling “fix” without naming emotional stakes (pairs with absence of repair-depth cues). */
const COMPENSATORY_WITHOUT_EMOTIONAL_CORE =
  /\b(make\s+up\s+(?:the\s+)?time|plan\s+another\s+date|make\s+it\s+up\s+somehow)\b/i;

const REPAIR_EMOTIONAL_DEPTH_CUES =
  /\b(acknowledge|felt\s+like|comes\s+second|matter(?:s|ed)?|priorit|rupture|hurt|impact|need|emotion|meaning|relationship|listen(?:ed|ing)?\s+to\s+(?:her|him|them))\b/i;

function evidenceOpensWithLevel1(ev: string | undefined): boolean {
  if (!ev || typeof ev !== 'string') return false;
  return /^\s*Level\s*1\b/i.test(ev.trim());
}

function annotateMissingLevelTag(keyEvidence: Record<string, string>, marker: 'mentalizing' | 'attunement'): void {
  const ev = keyEvidence[marker];
  if (ev == null || typeof ev !== 'string') return;
  const trimmed = ev.trim();
  if (/^\s*Level\s*[12]\b/i.test(trimmed)) return;
  keyEvidence[marker] = mergeEvidence(
    ev,
    'Level tag missing — prefix keyEvidence with Level 1 — or Level 2 — per behavioral vs interior rubric.',
  );
}

function enforceDeclaredLevel1VersusNumericScore(
  pillarScores: Record<string, number | null | undefined>,
  keyEvidence: Record<string, string>,
  marker: 'mentalizing' | 'attunement',
): void {
  if (!evidenceOpensWithLevel1(keyEvidence[marker])) return;
  capAt(
    pillarScores,
    keyEvidence,
    marker,
    5,
    'Declared Level 1 in keyEvidence — scores above 5 disallowed for this marker.',
  );
}

function mergeEvidence(prev: string | undefined, note: string): string {
  const p = (prev ?? '').trim();
  return p ? `${p} | ${note}` : note;
}

function capAt(
  pillarScores: Record<string, number | null | undefined>,
  keyEvidence: Record<string, string>,
  marker: string,
  ceiling: number,
  note: string,
): void {
  const raw = pillarScores[marker];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return;
  if (raw <= ceiling) return;
  pillarScores[marker] = ceiling;
  keyEvidence[marker] = mergeEvidence(keyEvidence[marker], `Ceiling ${ceiling}: ${note}`);
}

function subtractOne(
  pillarScores: Record<string, number | null | undefined>,
  keyEvidence: Record<string, string>,
  marker: string,
  note: string,
): void {
  const raw = pillarScores[marker];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return;
  const next = Math.max(0, raw - 1);
  if (next === raw) return;
  pillarScores[marker] = next;
  keyEvidence[marker] = mergeEvidence(keyEvidence[marker], note);
}

export function computeAvgUserWordsPerTurnScenario(
  messages: Array<{ role?: string; content?: string; scenarioNumber?: number } | null | undefined>,
  scenarioNum: 1 | 2 | 3,
): number {
  if (!Array.isArray(messages)) return 0;
  const base =
    scenarioNum === 3 ? sliceTranscriptBeforeScenarioCToPersonalHandoff(messages as Parameters<typeof sliceTranscriptBeforeScenarioCToPersonalHandoff>[0]) : messages;
  const turns = base
    .filter(
      (m): m is { role: string; content: string; scenarioNumber?: number } =>
        !!m &&
        m.role === 'user' &&
        m.scenarioNumber === scenarioNum &&
        typeof m.content === 'string',
    )
    .map((m) => m.content.trim())
    .filter(Boolean);
  if (turns.length === 0) return 0;
  const lengths = turns.map((t) => t.split(/\s+/).filter(Boolean).length);
  return lengths.reduce((a, b) => a + b, 0) / lengths.length;
}

export function computeAvgUserWordsPerTurnPersonalSlice(
  transcript: Array<{ role?: string; content?: string } | null | undefined>,
): number {
  if (!Array.isArray(transcript)) return 0;
  const turns = transcript
    .filter(
      (m): m is { role: string; content: string } =>
        !!m && m.role === 'user' && typeof m.content === 'string',
    )
    .map((m) => m.content.trim())
    .filter(Boolean);
  if (turns.length === 0) return 0;
  const lengths = turns.map((t) => t.split(/\s+/).filter(Boolean).length);
  return lengths.reduce((a, b) => a + b, 0) / lengths.length;
}

export type Moment4SpecificityMeta = {
  clientSpecificityFollowUpAsked?: boolean;
  lowSpecificityAfterProbe?: boolean;
} | null;

/**
 * Scenario completion: contempt heuristic already applied; apply elaboration ceilings + depth modifier.
 */
export function applyElaborationAbsencePenaltiesToScenarioScores(
  scenarioNumber: 1 | 2 | 3,
  userTurnsJoinedText: string,
  pillarScores: Record<string, number | null | undefined>,
  keyEvidence: Record<string, string> | undefined,
  avgWordsPerUserTurn: number,
): { pillarScores: Record<string, number | null | undefined>; keyEvidence: Record<string, string> } {
  const ps: Record<string, number | null | undefined> = { ...pillarScores };
  const ke: Record<string, string> = { ...(keyEvidence ?? {}) };
  const t = userTurnsJoinedText.replace(/\s+/g, ' ').trim();

  if (DIAGNOSTIC_TYPING_PATTERN.test(t) && !INTERNAL_STATE_CUES.test(t)) {
    capAt(
      ps,
      ke,
      'mentalizing',
      5,
      'Diagnostic/attachment typing without Level 2 felt experience (Level 1; mentalizing ceiling 5).',
    );
  }

  if (scenarioNumber === 2 && ABSOLUTION_BEFORE_INSIGHT.test(t)) {
    capAt(ps, ke, 'appreciation', 6, 'Absolves character or denies wrongdoing before naming attunement miss (appreciation ceiling).');
  }

  const userWordCount = t.split(/\s+/).filter(Boolean).length;
  if (
    userWordCount > 0 &&
    userWordCount < 55 &&
    LOGISTICS_ONLY_REPAIR.test(t) &&
    !/\b(sorry|apolog|hurt|impact|rupture|felt|pattern|dynamic|my part|ownership|emotion)\b/i.test(t)
  ) {
    capAt(ps, ke, 'repair', 5, 'Repair framed as logistics/scheduling without emotional pattern or rupture (repair ceiling).');
  }

  if (
    userWordCount > 0 &&
    userWordCount < 90 &&
    COMPENSATORY_WITHOUT_EMOTIONAL_CORE.test(t) &&
    !REPAIR_EMOTIONAL_DEPTH_CUES.test(t)
  ) {
    capAt(
      ps,
      ke,
      'repair',
      5,
      'Compensatory/scheduling repair without emotional core of rupture (repair ceiling 5).',
    );
  }

  enforceDeclaredLevel1VersusNumericScore(ps, ke, 'mentalizing');
  enforceDeclaredLevel1VersusNumericScore(ps, ke, 'attunement');
  annotateMissingLevelTag(ke, 'mentalizing');
  annotateMissingLevelTag(ke, 'attunement');

  if (avgWordsPerUserTurn > 0 && avgWordsPerUserTurn < 35) {
    subtractOne(
      ps,
      ke,
      'mentalizing',
      'Response-depth modifier: avg user words per turn <35 in this slice (−1 mentalizing).',
    );
    subtractOne(
      ps,
      ke,
      'attunement',
      'Response-depth modifier: avg user words per turn <35 in this slice (−1 attunement).',
    );
    subtractOne(ps, ke, 'repair', 'Response-depth modifier: avg user words per turn <35 in this slice (−1 repair).');
  }

  return { pillarScores: ps, keyEvidence: ke };
}

/** Moment 4 personal slice — run after model normalize; uses client specificity metadata when present. */
export function applyElaborationAbsencePenaltiesMoment4(
  pillarScores: Record<string, number | null | undefined>,
  keyEvidence: Record<string, string> | undefined,
  meta: Moment4SpecificityMeta,
  avgWordsPerTurnInSlice: number,
): { pillarScores: Record<string, number | null | undefined>; keyEvidence: Record<string, string> } {
  const ps: Record<string, number | null | undefined> = { ...pillarScores };
  const ke: Record<string, string> = { ...(keyEvidence ?? {}) };

  if (meta?.lowSpecificityAfterProbe === true) {
    capAt(ps, ke, 'mentalizing', 5, 'Moment 4 low specificity — insufficient personal narrative signal.');
    capAt(ps, ke, 'accountability', 4, 'Moment 4 low specificity — insufficient personal narrative signal.');
  }

  if (avgWordsPerTurnInSlice > 0 && avgWordsPerTurnInSlice < 35) {
    subtractOne(
      ps,
      ke,
      'mentalizing',
      'Response-depth modifier: avg user words per turn <35 in Moment 4 (−1 mentalizing).',
    );
    subtractOne(
      ps,
      ke,
      'accountability',
      'Response-depth modifier: avg user words per turn <35 in Moment 4 (−1 accountability).',
    );
  }

  return { pillarScores: ps, keyEvidence: ke };
}

/**
 * Moment 5 — program caps: diagnostic mentalizing, thin logistics repair, response-depth on mentalizing+repair only.
 */
export function applyElaborationAbsencePenaltiesMoment5(
  userTurnsJoinedText: string,
  pillarScores: Record<string, number | null | undefined>,
  keyEvidence: Record<string, string> | undefined,
  avgWordsPerTurnInSlice: number,
): { pillarScores: Record<string, number | null | undefined>; keyEvidence: Record<string, string> } {
  const ps: Record<string, number | null | undefined> = { ...pillarScores };
  const ke: Record<string, string> = { ...(keyEvidence ?? {}) };
  const t = userTurnsJoinedText.replace(/\s+/g, ' ').trim();

  if (DIAGNOSTIC_TYPING_PATTERN.test(t) && !INTERNAL_STATE_CUES.test(t)) {
    capAt(
      ps,
      ke,
      'mentalizing',
      5,
      'Diagnostic/attachment typing without Level 2 felt experience (Moment 5 mentalizing ceiling 5).',
    );
  }

  const userWordCount = t.split(/\s+/).filter(Boolean).length;
  if (
    userWordCount > 0 &&
    userWordCount < 55 &&
    LOGISTICS_ONLY_REPAIR.test(t) &&
    !/\b(sorry|apolog|hurt|impact|rupture|felt|pattern|dynamic|my part|ownership|emotion)\b/i.test(t)
  ) {
    capAt(
      ps,
      ke,
      'repair',
      5,
      'Repair framed as logistics/scheduling without emotional pattern or rupture (Moment 5 repair ceiling).',
    );
  }

  if (avgWordsPerTurnInSlice > 0 && avgWordsPerTurnInSlice < 35) {
    subtractOne(
      ps,
      ke,
      'mentalizing',
      'Response-depth modifier: avg user words per turn <35 in Moment 5 (−1 mentalizing).',
    );
    subtractOne(
      ps,
      ke,
      'repair',
      'Response-depth modifier: avg user words per turn <35 in Moment 5 (−1 repair).',
    );
  }

  return { pillarScores: ps, keyEvidence: ke };
}

