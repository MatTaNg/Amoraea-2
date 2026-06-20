/**
 * Programmatic caps complement LLM rubric {@link ELABORATION_ABSENCE_SCENARIO_MARKERS}.
 */
import {
  evidenceAbsentForResponseDepthModifier,
  sliceTranscriptBeforeScenarioCToPersonalHandoff,
} from './probeAndScoringUtils';

export type DepthModifierWordCountSource = 'live_transcript' | 'cached' | 'retry_recomputed';
export type LevelTagQaNote = {
  marker: 'mentalizing' | 'attunement';
  issue: 'level_tag_inferred_programmatically' | 'confidence_only_evidence_replaced';
  inferred_level?: 1 | 2;
};

export type ResponseDepthModifierMeta = {
  avg_words_per_turn_calculated: number;
  word_count_source: DepthModifierWordCountSource;
  depth_modifier_threshold: number;
  depth_modifier_applied: boolean;
  depth_modifier_applied_markers: string[];
  depth_modifier_anomaly?: boolean;
  /** Internal QA only — never written into keyEvidence. */
  level_tag_qa?: LevelTagQaNote[];
};

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

function isConfidenceOnlyEvidence(ev: string | undefined): boolean {
  if (!ev) return false;
  const t = ev.trim().toLowerCase();
  return t === 'high' || t === 'moderate' || t === 'low' || t === 'not_assessed';
}

function declaredLevelFromEvidence(ev: string | undefined): 1 | 2 | null {
  if (!ev || typeof ev !== 'string') return null;
  const m = /^\s*Level\s*(1|2)\b/i.exec(ev.trim());
  return m ? (Number(m[1]) as 1 | 2) : null;
}

function inferInteriorLevel(userTranscript: string, substantiveEvidence: string): 1 | 2 {
  const ev = substantiveEvidence.trim();
  const combined = `${ev} ${userTranscript}`.trim();
  if (DIAGNOSTIC_TYPING_PATTERN.test(combined) && !INTERNAL_STATE_CUES.test(ev)) return 1;
  if (
    /\b(questioning whether|what this means|emotional texture|unspoken|felt experience|internal conflict|flooded|shame|matters to (?:her|him|them)|read as indifference)\b/i.test(
      ev,
    )
  ) {
    return 2;
  }
  if (INTERNAL_STATE_CUES.test(ev) && ev.length > 25) return 2;
  if (INTERNAL_STATE_CUES.test(userTranscript) && ev.length > 15) return 2;
  return 1;
}

function truncateTranscriptSnippet(text: string, max = 240): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function stripLegacyLevelTagLeak(ev: string): string {
  return ev
    .split('|')
    .map((p) => p.trim())
    .filter((p) => !/Level tag missing/i.test(p))
    .join(' | ')
    .trim();
}

function ensureLevelTaggedKeyEvidence(
  marker: 'mentalizing' | 'attunement',
  rawEvidence: string | undefined,
  userTranscript: string,
  qaNotes: LevelTagQaNote[],
): string {
  let ev = stripLegacyLevelTagLeak((rawEvidence ?? '').trim());
  if (isConfidenceOnlyEvidence(ev)) {
    qaNotes.push({ marker, issue: 'confidence_only_evidence_replaced' });
    ev = '';
  }
  if (ev && evidenceAbsentForResponseDepthModifier(ev)) {
    qaNotes.push({
      marker,
      issue: 'level_tag_inferred_programmatically',
      inferred_level: 1,
    });
    return `Level 1 — ${ev.replace(/^\s*Level\s*[12]\s*[—–-]\s*/i, '').trim()}`;
  }
  const declared = declaredLevelFromEvidence(ev);
  if (declared != null) {
    return ev;
  }
  const inferred = inferInteriorLevel(userTranscript, ev);
  qaNotes.push({
    marker,
    issue: 'level_tag_inferred_programmatically',
    inferred_level: inferred,
  });
  if (typeof console !== 'undefined' && console.warn) {
    console.warn(
      `[LevelTagQA] scenario ${marker}: model omitted Level prefix; inferred Level ${inferred} (internal QA only)`,
    );
  }
  const body =
    ev ||
    (userTranscript.trim()
      ? `User (scenario slice): "${truncateTranscriptSnippet(userTranscript)}"`
      : 'Insufficient assessable evidence in model output.');
  const stripped = body.replace(/^\s*Level\s*[12]\s*[—–-]\s*/i, '').trim();
  return `Level ${inferred} — ${stripped}`;
}

function normalizeMentalizingAttunementLevelTags(
  keyEvidence: Record<string, string>,
  userTranscript: string,
  qaNotes: LevelTagQaNote[],
): void {
  for (const marker of ['mentalizing', 'attunement'] as const) {
    keyEvidence[marker] = ensureLevelTaggedKeyEvidence(marker, keyEvidence[marker], userTranscript, qaNotes);
  }
}

function evidenceOpensWithLevel1(ev: string | undefined): boolean {
  if (!ev || typeof ev !== 'string') return false;
  return /^\s*Level\s*1\b/i.test(ev.trim());
}

function enforceDeclaredLevel1VersusNumericScore(
  pillarScores: Record<string, number | null | undefined>,
  keyEvidence: Record<string, string>,
  marker: 'mentalizing' | 'attunement',
): void {
  if (evidenceAbsentForResponseDepthModifier(keyEvidence[marker])) return;
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

function buildDepthModifierMeta(
  avgWordsPerUserTurn: number,
  threshold: number,
  wordCountSource: DepthModifierWordCountSource,
  appliedMarkers: string[],
  communicationAvgResponseLength?: number | null,
  levelTagQa?: LevelTagQaNote[],
): ResponseDepthModifierMeta {
  const depthModifierApplied = appliedMarkers.length > 0;
  return {
    avg_words_per_turn_calculated: avgWordsPerUserTurn,
    word_count_source: wordCountSource,
    depth_modifier_threshold: threshold,
    depth_modifier_applied: depthModifierApplied,
    depth_modifier_applied_markers: appliedMarkers,
    ...(levelTagQa && levelTagQa.length > 0 ? { level_tag_qa: levelTagQa } : {}),
    ...(depthModifierApplied && (communicationAvgResponseLength ?? 0) > 60
      ? { depth_modifier_anomaly: true }
      : {}),
  };
}

function maybeSubtractOneForShortSliceInsufficientEvidence(
  pillarScores: Record<string, number | null | undefined>,
  keyEvidence: Record<string, string>,
  marker: string,
  avgWordsPerUserTurn: number,
  threshold: number,
  /** Model keyEvidence before programmatic ceilings / merges — avoids treating ceiling notes as substantive evidence. */
  modelEvidenceBeforeHeuristic: Record<string, string | undefined>,
): boolean {
  if (!(avgWordsPerUserTurn > 0 && avgWordsPerUserTurn < threshold)) return false;
  if (!evidenceAbsentForResponseDepthModifier(modelEvidenceBeforeHeuristic[marker])) return false;
  const before = pillarScores[marker];
  subtractOne(
    pillarScores,
    keyEvidence,
    marker,
    `Response-depth modifier: short response with insufficient evidence for ${marker} (−1)`,
  );
  return pillarScores[marker] !== before;
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

export function countUserTurnsForScenario(
  messages: Array<{ role?: string; content?: string; scenarioNumber?: number } | null | undefined>,
  scenarioNum: 1 | 2 | 3,
): number {
  if (!Array.isArray(messages)) return 0;
  const base =
    scenarioNum === 3 ? sliceTranscriptBeforeScenarioCToPersonalHandoff(messages as Parameters<typeof sliceTranscriptBeforeScenarioCToPersonalHandoff>[0]) : messages;
  return base.filter(
    (m) =>
      !!m &&
      m.role === 'user' &&
      m.scenarioNumber === scenarioNum &&
      typeof m.content === 'string' &&
      m.content.trim().length > 0,
  ).length;
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

export function computeAvgUserWordsPerTurnForInterviewMoment(
  transcript: Array<{ role?: string; content?: string; interviewMoment?: number } | null | undefined>,
  interviewMoment: 1 | 2 | 3 | 4 | 5,
): number {
  if (!Array.isArray(transcript)) return 0;
  const turns = transcript
    .filter(
      (m): m is { role: string; content: string; interviewMoment?: number } =>
        !!m &&
        m.role === 'user' &&
        m.interviewMoment === interviewMoment &&
        typeof m.content === 'string',
    )
    .map((m) => m.content.trim())
    .filter(Boolean);
  if (turns.length === 0) return 0;
  const lengths = turns.map((t) => t.split(/\s+/).filter(Boolean).length);
  return lengths.reduce((a, b) => a + b, 0) / lengths.length;
}

export function scenarioDepthModifierThreshold(userTurnCount: number): number {
  return userTurnCount > 1 ? 20 : 25;
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
  options?: {
    depthModifierThreshold?: number;
    wordCountSource?: DepthModifierWordCountSource;
    communicationAvgResponseLength?: number | null;
  },
): {
  pillarScores: Record<string, number | null | undefined>;
  keyEvidence: Record<string, string>;
  depthModifierMeta: ResponseDepthModifierMeta;
} {
  const ps: Record<string, number | null | undefined> = { ...pillarScores };
  const ke: Record<string, string> = { ...(keyEvidence ?? {}) };
  const levelTagQa: LevelTagQaNote[] = [];
  const depthEvidenceBaseline: Record<string, string | undefined> = { ...ke };
  const t = userTurnsJoinedText.replace(/\s+/g, ' ').trim();
  const threshold = options?.depthModifierThreshold ?? 25;
  const appliedMarkers: string[] = [];

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

  normalizeMentalizingAttunementLevelTags(ke, t, levelTagQa);
  enforceDeclaredLevel1VersusNumericScore(ps, ke, 'mentalizing');
  enforceDeclaredLevel1VersusNumericScore(ps, ke, 'attunement');

  if (maybeSubtractOneForShortSliceInsufficientEvidence(ps, ke, 'mentalizing', avgWordsPerUserTurn, threshold, depthEvidenceBaseline)) {
    appliedMarkers.push('mentalizing');
  }
  if (maybeSubtractOneForShortSliceInsufficientEvidence(ps, ke, 'attunement', avgWordsPerUserTurn, threshold, depthEvidenceBaseline)) {
    appliedMarkers.push('attunement');
  }
  if (maybeSubtractOneForShortSliceInsufficientEvidence(ps, ke, 'repair', avgWordsPerUserTurn, threshold, depthEvidenceBaseline)) {
    appliedMarkers.push('repair');
  }

  return {
    pillarScores: ps,
    keyEvidence: ke,
    depthModifierMeta: buildDepthModifierMeta(
      avgWordsPerUserTurn,
      threshold,
      options?.wordCountSource ?? 'live_transcript',
      appliedMarkers,
      options?.communicationAvgResponseLength,
      levelTagQa,
    ),
  };
}

/** Moment 4 personal slice — run after model normalize; uses client specificity metadata when present. */
export function applyElaborationAbsencePenaltiesMoment4(
  pillarScores: Record<string, number | null | undefined>,
  keyEvidence: Record<string, string> | undefined,
  meta: Moment4SpecificityMeta,
  avgWordsPerTurnInSlice: number,
  options?: {
    wordCountSource?: DepthModifierWordCountSource;
    communicationAvgResponseLength?: number | null;
  },
): {
  pillarScores: Record<string, number | null | undefined>;
  keyEvidence: Record<string, string>;
  depthModifierMeta: ResponseDepthModifierMeta;
} {
  const ps: Record<string, number | null | undefined> = { ...pillarScores };
  const ke: Record<string, string> = { ...(keyEvidence ?? {}) };
  const depthEvidenceBaseline: Record<string, string | undefined> = { ...ke };
  const appliedMarkers: string[] = [];
  const threshold = 20;

  if (meta?.lowSpecificityAfterProbe === true) {
    capAt(ps, ke, 'mentalizing', 5, 'Moment 4 low specificity — insufficient personal narrative signal.');
    capAt(ps, ke, 'accountability', 4, 'Moment 4 low specificity — insufficient personal narrative signal.');
  }

  if (maybeSubtractOneForShortSliceInsufficientEvidence(ps, ke, 'mentalizing', avgWordsPerTurnInSlice, threshold, depthEvidenceBaseline)) {
    appliedMarkers.push('mentalizing');
  }
  if (maybeSubtractOneForShortSliceInsufficientEvidence(
    ps,
    ke,
    'accountability',
    avgWordsPerTurnInSlice,
    threshold,
    depthEvidenceBaseline,
  )) {
    appliedMarkers.push('accountability');
  }

  return {
    pillarScores: ps,
    keyEvidence: ke,
    depthModifierMeta: buildDepthModifierMeta(
      avgWordsPerTurnInSlice,
      threshold,
      options?.wordCountSource ?? 'live_transcript',
      appliedMarkers,
      options?.communicationAvgResponseLength,
    ),
  };
}

/**
 * Moment 5 — program caps: diagnostic mentalizing, thin logistics repair, response-depth on mentalizing+repair only.
 */
export function applyElaborationAbsencePenaltiesMoment5(
  userTurnsJoinedText: string,
  pillarScores: Record<string, number | null | undefined>,
  keyEvidence: Record<string, string> | undefined,
  avgWordsPerTurnInSlice: number,
  options?: {
    wordCountSource?: DepthModifierWordCountSource;
    communicationAvgResponseLength?: number | null;
  },
): {
  pillarScores: Record<string, number | null | undefined>;
  keyEvidence: Record<string, string>;
  depthModifierMeta: ResponseDepthModifierMeta;
} {
  const ps: Record<string, number | null | undefined> = { ...pillarScores };
  const ke: Record<string, string> = { ...(keyEvidence ?? {}) };
  const depthEvidenceBaseline: Record<string, string | undefined> = { ...ke };
  const t = userTurnsJoinedText.replace(/\s+/g, ' ').trim();
  const appliedMarkers: string[] = [];
  const threshold = 20;

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

  if (maybeSubtractOneForShortSliceInsufficientEvidence(ps, ke, 'mentalizing', avgWordsPerTurnInSlice, threshold, depthEvidenceBaseline)) {
    appliedMarkers.push('mentalizing');
  }
  if (maybeSubtractOneForShortSliceInsufficientEvidence(ps, ke, 'repair', avgWordsPerTurnInSlice, threshold, depthEvidenceBaseline)) {
    appliedMarkers.push('repair');
  }

  return {
    pillarScores: ps,
    keyEvidence: ke,
    depthModifierMeta: buildDepthModifierMeta(
      avgWordsPerTurnInSlice,
      threshold,
      options?.wordCountSource ?? 'live_transcript',
      appliedMarkers,
      options?.communicationAvgResponseLength,
    ),
  };
}

