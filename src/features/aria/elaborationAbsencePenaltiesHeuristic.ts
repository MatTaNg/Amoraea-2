/**
 * Programmatic caps complement LLM rubric {@link ELABORATION_ABSENCE_SCENARIO_MARKERS}.
 */
import {
  isProgrammaticConstructUserQuoteBackfill,
  isQuoteOnlyKeyEvidence,
} from './scenarioConstructEvidenceExtraction';
import {
  evidenceAbsentForResponseDepthModifier,
  isIntentionallyRecoveredScoreEvidence,
  isPillarConfidenceOnlyEvidence,
  keyEvidenceAbsentForResponseDepthModifier,
  migratePillarConfidenceLeakedIntoKeyEvidence,
  replaceConfidenceOnlyInKeyEvidenceRecord,
} from './probeAndScoringUtils';
import {
  resolveScenarioUserTurnsForScoring,
  type MessageWithScenario,
} from './interviewScenarioScoringSlice';
import { stripLegacyLevelTagLeakFromEvidence } from './sanitizeScenarioKeyEvidenceForPersist';
import {
  ELABORATION_APPRECIATION_CEILING,
  ELABORATION_COMPENSATORY_REPAIR_MAX_WORD_COUNT,
  ELABORATION_DEFAULT_DEPTH_THRESHOLD,
  ELABORATION_INTERNAL_STATE_EVIDENCE_MIN_LENGTH,
  ELABORATION_INTERNAL_STATE_TRANSCRIPT_MIN_LENGTH,
  ELABORATION_LOGISTICS_REPAIR_MAX_WORD_COUNT,
  ELABORATION_MENTALIZING_LEVEL1_CEILING,
  ELABORATION_MENTALIZING_LEVEL2_FLOOR,
  ELABORATION_MOMENT4_ACCOUNTABILITY_CEILING,
  ELABORATION_MOMENT4_DEPTH_WORD_THRESHOLD,
  ELABORATION_REPAIR_CEILING,
  ELABORATION_SCENARIO_DEPTH_WORD_THRESHOLD_MULTI_TURN,
  ELABORATION_SCENARIO_DEPTH_WORD_THRESHOLD_SINGLE_TURN,
} from '@config/scoring/elaborationAbsenceCeilings';

export type DepthModifierWordCountSource = 'live_transcript' | 'cached' | 'retry_recomputed';
export type LevelTagQaNote = {
  marker: 'mentalizing' | 'attunement';
  issue:
    | 'level_tag_inferred_programmatically'
    | 'confidence_only_evidence_replaced'
    | 'scoring_metadata_level_used'
    | 'scoring_metadata_overrode_key_evidence';
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

const HOLISTIC_INTERIOR_REASONING_CUES =
  /\b(did(?:n'?t| not)\s+know\s+what\s+to\s+say|does(?:n'?t| not)\s+know\s+how\s+to\s+handle\s+conflict|emotion(?:al)?\s+weight|conflict\s+feels?\s+unsafe|incomplete\s+conversation|avoid(?:s|ing)?\s+the\s+real\s+conversations?|creates?\s+more\s+friction\s+and\s+distance|emotionally?\s+uncomfortable|uncomfortable\s+situation|flooded|shame|fear\s+of\s+confrontation|difficulty\s+being\s+authentic)\b/i;

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

function declaredLevelFromEvidence(ev: string | undefined): 1 | 2 | null {
  if (!ev || typeof ev !== 'string') return null;
  const m = /^\s*Level\s*(1|2)\b/i.exec(ev.trim());
  return m ? (Number(m[1]) as 1 | 2) : null;
}

type ScenarioEvidenceLevelMarker = 'mentalizing' | 'attunement';

type ScenarioHolisticEvidenceLevelHint = {
  level: 1 | 2;
  basis?: string;
};

function parseScenarioEvidenceLevel(raw: unknown): 1 | 2 | null {
  if (raw === 1 || raw === 2) return raw;
  if (raw === '1' || raw === '2') return Number(raw) as 1 | 2;
  return null;
}

export function extractScenarioHolisticEvidenceLevelsFromScoringMetadata(
  scoringMetadata: unknown,
): Partial<Record<ScenarioEvidenceLevelMarker, ScenarioHolisticEvidenceLevelHint>> {
  if (!scoringMetadata || typeof scoringMetadata !== 'object' || Array.isArray(scoringMetadata)) {
    return {};
  }
  const metadata = scoringMetadata as Record<string, unknown>;
  const levelsRaw =
    metadata.evidence_levels ??
    metadata.evidenceLevels ??
    metadata.holistic_evidence_levels ??
    metadata.holisticEvidenceLevels;
  const basisRaw =
    metadata.evidence_level_basis ??
    metadata.evidenceLevelBasis ??
    metadata.holistic_evidence_level_basis ??
    metadata.holisticEvidenceLevelBasis;
  const levelsObj =
    levelsRaw && typeof levelsRaw === 'object' && !Array.isArray(levelsRaw)
      ? (levelsRaw as Record<string, unknown>)
      : {};
  const basisObj =
    basisRaw && typeof basisRaw === 'object' && !Array.isArray(basisRaw)
      ? (basisRaw as Record<string, unknown>)
      : {};
  const out: Partial<Record<ScenarioEvidenceLevelMarker, ScenarioHolisticEvidenceLevelHint>> = {};
  for (const marker of ['mentalizing', 'attunement'] as const) {
    const level =
      parseScenarioEvidenceLevel(levelsObj[marker]) ??
      parseScenarioEvidenceLevel(metadata[`${marker}_level`]) ??
      parseScenarioEvidenceLevel(metadata[`${marker}Level`]);
    if (level == null) continue;
    const basisRawValue = basisObj[marker] ?? metadata[`${marker}_level_basis`] ?? metadata[`${marker}LevelBasis`];
    out[marker] = {
      level,
      basis: typeof basisRawValue === 'string' ? basisRawValue.trim() || undefined : undefined,
    };
  }
  return out;
}

function inferInteriorLevel(userTranscript: string, substantiveEvidence: string): 1 | 2 {
  const ev = substantiveEvidence.replace(/[\u2018\u2019]/g, "'").trim();
  const transcript = userTranscript.replace(/[\u2018\u2019]/g, "'").trim();
  const combined = `${ev} ${transcript}`.trim();
  if (DIAGNOSTIC_TYPING_PATTERN.test(combined) && !INTERNAL_STATE_CUES.test(ev)) return 1;
  if (
    /\b(questioning whether|what this means|emotional texture|unspoken|felt experience|internal conflict|flooded|shame|matters to (?:her|him|them)|read as indifference|assuming|referring to|infer(?:s|ring)?|different type of|wanted something different|hurt and rejection|abandonment|didn'?t feel appreciated)\b/i.test(
      ev,
    )
  ) {
    return 2;
  }
  if (INTERNAL_STATE_CUES.test(ev) && ev.length > ELABORATION_INTERNAL_STATE_EVIDENCE_MIN_LENGTH) return 2;
  if (
    HOLISTIC_INTERIOR_REASONING_CUES.test(transcript) &&
    ev.length > ELABORATION_INTERNAL_STATE_TRANSCRIPT_MIN_LENGTH
  ) {
    return 2;
  }
  if (INTERNAL_STATE_CUES.test(transcript) && ev.length > ELABORATION_INTERNAL_STATE_TRANSCRIPT_MIN_LENGTH) return 2;
  return 1;
}

function truncateTranscriptSnippet(text: string, max = 240): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

function transcriptWordCount(userTranscript: string): number {
  return userTranscript.trim().split(/\s+/).filter(Boolean).length;
}

function transcriptSubstantiveForDepthModifier(
  userTranscript: string,
  threshold: number,
): boolean {
  return transcriptWordCount(userTranscript) >= threshold;
}
function constructEvidenceFallbackBody(
  marker: 'mentalizing' | 'attunement',
  userTranscript: string,
): string {
  const t = userTranscript.replace(/\s+/g, ' ').trim();
  if (!t) {
    return 'Insufficient assessable evidence in model output.';
  }
  const inferred = inferInteriorLevel(t, t);
  const constructLabel =
    marker === 'mentalizing'
      ? 'perspective-taking'
      : 'emotional attunement';
  if (inferred >= 2) {
    return `User demonstrates ${constructLabel} via interior or pattern language in this slice; model omitted pillar-specific analytical keyEvidence.`;
  }
  return 'User response stays at behavioral/logistical reads without clear interior inference; model omitted analytical keyEvidence.';
}

function evidenceBodyForInteriorInference(
  marker: 'mentalizing' | 'attunement',
  rawEvidence: string,
  userTranscript: string,
): string {
  const stripped = rawEvidence.replace(/^\s*Level\s*[12]\s*[—–-]\s*/i, '').trim();
  if (isProgrammaticConstructUserQuoteBackfill(stripped) && userTranscript.trim()) {
    return userTranscript;
  }
  return stripped || constructEvidenceFallbackBody(marker, userTranscript);
}

function effectiveInteriorEvidenceLevelForCap(
  marker: 'mentalizing' | 'attunement',
  keyEvidence: Record<string, string>,
  userTranscript: string,
  holisticLevels: Partial<Record<ScenarioEvidenceLevelMarker, ScenarioHolisticEvidenceLevelHint>>,
): 1 | 2 | null {
  const metadataLevel = holisticLevels[marker]?.level;
  const declared = declaredLevelFromEvidence(keyEvidence[marker]);
  const inferredFromTranscript = inferInteriorLevel(
    userTranscript,
    evidenceBodyForInteriorInference(marker, keyEvidence[marker] ?? '', userTranscript),
  );
  const transcriptWords = userTranscript.trim().split(/\s+/).filter(Boolean).length;
  if (metadataLevel === 2 || declared === 2) return 2;
  if (
    inferredFromTranscript === 2 &&
    transcriptWords >= ELABORATION_SCENARIO_DEPTH_WORD_THRESHOLD_MULTI_TURN &&
    (metadataLevel === 1 || declared === 1 || declared == null)
  ) {
    return 2;
  }
  if (metadataLevel === 1 || declared === 1 || evidenceOpensWithLevel1(keyEvidence[marker])) return 1;
  return inferredFromTranscript;
}

function ensureLevelTaggedKeyEvidence(
  marker: 'mentalizing' | 'attunement',
  rawEvidence: string | undefined,
  userTranscript: string,
  qaNotes: LevelTagQaNote[],
  holisticHint?: ScenarioHolisticEvidenceLevelHint,
): string {
  let ev = stripLegacyLevelTagLeakFromEvidence((rawEvidence ?? '').trim());
  if (isPillarConfidenceOnlyEvidence(ev)) {
    qaNotes.push({ marker, issue: 'confidence_only_evidence_replaced' });
    ev = '';
  }
  if (isQuoteOnlyKeyEvidence(ev)) {
    ev = '';
  }
  if (isIntentionallyRecoveredScoreEvidence(ev) && userTranscript.trim()) {
    ev = '';
  }
  if (/^Insufficient assessable evidence in model output\.?$/i.test(ev) && userTranscript.trim()) {
    ev = '';
  }
  const declared = declaredLevelFromEvidence(ev);
  if (holisticHint) {
    const strippedFromEvidence =
      ev.replace(/^\s*Level\s*[12]\s*[—–-]\s*/i, '').trim() ||
      constructEvidenceFallbackBody(marker, userTranscript);
    const inferenceSeed =
      isProgrammaticConstructUserQuoteBackfill(strippedFromEvidence) && userTranscript.trim()
        ? userTranscript
        : strippedFromEvidence;
    const transcriptWords = userTranscript.trim().split(/\s+/).filter(Boolean).length;
    const holisticLevel =
      holisticHint.level === 1 &&
      transcriptWords >= ELABORATION_SCENARIO_DEPTH_WORD_THRESHOLD_MULTI_TURN &&
      inferInteriorLevel(userTranscript, inferenceSeed) === 2
        ? 2
        : holisticHint.level;
    qaNotes.push({
      marker,
      issue:
        declared != null && declared !== holisticLevel
          ? 'scoring_metadata_overrode_key_evidence'
          : 'scoring_metadata_level_used',
      inferred_level: holisticLevel,
    });
    return `Level ${holisticLevel} — ${strippedFromEvidence}`;
  }
  if (
    ev &&
    evidenceAbsentForResponseDepthModifier(ev) &&
    !userTranscript.trim()
  ) {
    qaNotes.push({
      marker,
      issue: 'level_tag_inferred_programmatically',
      inferred_level: 1,
    });
    return `Level 1 — ${ev.replace(/^\s*Level\s*[12]\s*[—–-]\s*/i, '').trim()}`;
  }
  if (declared != null) {
    return ev;
  }
  const strippedForInference = ev.replace(/^\s*Level\s*[12]\s*[—–-]\s*/i, '').trim();
  const inferenceBody =
    !strippedForInference ||
    isQuoteOnlyKeyEvidence(ev) ||
    isIntentionallyRecoveredScoreEvidence(ev) ||
    isProgrammaticConstructUserQuoteBackfill(strippedForInference)
      ? userTranscript
      : strippedForInference;
  const inferred = inferInteriorLevel(userTranscript, inferenceBody);
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
    constructEvidenceFallbackBody(marker, userTranscript);
  const stripped = body.replace(/^\s*Level\s*[12]\s*[—–-]\s*/i, '').trim();
  return `Level ${inferred} — ${stripped}`;
}

function normalizeMentalizingAttunementLevelTags(
  keyEvidence: Record<string, string>,
  userTranscript: string,
  qaNotes: LevelTagQaNote[],
  holisticLevels: Partial<Record<ScenarioEvidenceLevelMarker, ScenarioHolisticEvidenceLevelHint>>,
): void {
  for (const marker of ['mentalizing', 'attunement'] as const) {
    keyEvidence[marker] = ensureLevelTaggedKeyEvidence(
      marker,
      keyEvidence[marker],
      userTranscript,
      qaNotes,
      holisticLevels[marker],
    );
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
  holisticLevels: Partial<Record<ScenarioEvidenceLevelMarker, ScenarioHolisticEvidenceLevelHint>>,
  userTranscript: string,
): void {
  if (keyEvidenceAbsentForResponseDepthModifier(keyEvidence[marker], userTranscript)) return;
  const effectiveLevel = effectiveInteriorEvidenceLevelForCap(
    marker,
    keyEvidence,
    userTranscript,
    holisticLevels,
  );
  if (effectiveLevel !== 1) return;
  const metadataLevel = holisticLevels[marker]?.level;
  capAt(
    pillarScores,
    keyEvidence,
    marker,
    ELABORATION_MENTALIZING_LEVEL1_CEILING,
    metadataLevel === 1
      ? `Holistic Level 1 from scoringMetadata${holisticLevels[marker]?.basis ? ` — ${holisticLevels[marker]?.basis}` : ''}; scores above 5 disallowed for this marker.`
      : 'Declared Level 1 in keyEvidence — scores above 5 disallowed for this marker.',
  );
}

function enforceDeclaredLevel2VersusNumericScore(
  pillarScores: Record<string, number | null | undefined>,
  keyEvidence: Record<string, string>,
  marker: 'mentalizing' | 'attunement',
  holisticLevels: Partial<Record<ScenarioEvidenceLevelMarker, ScenarioHolisticEvidenceLevelHint>>,
  userTranscript: string,
): void {
  if (keyEvidenceAbsentForResponseDepthModifier(keyEvidence[marker], userTranscript)) return;
  const effectiveLevel = effectiveInteriorEvidenceLevelForCap(
    marker,
    keyEvidence,
    userTranscript,
    holisticLevels,
  );
  if (effectiveLevel !== 2) return;
  const metadataLevel = holisticLevels[marker]?.level;
  floorAt(
    pillarScores,
    keyEvidence,
    marker,
    ELABORATION_MENTALIZING_LEVEL2_FLOOR,
    metadataLevel === 2
      ? `Holistic Level 2 from scoringMetadata${holisticLevels[marker]?.basis ? ` — ${holisticLevels[marker]?.basis}` : ''}; scores below 6 disallowed for Level 2 interior inference.`
      : 'Declared Level 2 in keyEvidence — scores below 6 disallowed for Level 2 interior inference.',
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

function floorAt(
  pillarScores: Record<string, number | null | undefined>,
  keyEvidence: Record<string, string>,
  marker: string,
  floor: number,
  note: string,
): void {
  const raw = pillarScores[marker];
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return;
  if (raw >= floor) return;
  pillarScores[marker] = floor;
  keyEvidence[marker] = mergeEvidence(keyEvidence[marker], `Floor ${floor}: ${note}`);
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
  userTranscript: string,
): boolean {
  if (!(avgWordsPerUserTurn > 0 && avgWordsPerUserTurn < threshold)) return false;
  if (
    !keyEvidenceAbsentForResponseDepthModifier(
      modelEvidenceBeforeHeuristic[marker],
      userTranscript,
      threshold,
    )
  ) {
    return false;
  }
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
  const turns = resolveScenarioUserTurnsForScoring(messages as MessageWithScenario[], scenarioNum);
  if (turns.length === 0) return 0;
  const lengths = turns.map((t) => t.split(/\s+/).filter(Boolean).length);
  return lengths.reduce((a, b) => a + b, 0) / lengths.length;
}

export function countUserTurnsForScenario(
  messages: Array<{ role?: string; content?: string; scenarioNumber?: number } | null | undefined>,
  scenarioNum: 1 | 2 | 3,
): number {
  if (!Array.isArray(messages)) return 0;
  return resolveScenarioUserTurnsForScoring(messages as MessageWithScenario[], scenarioNum).length;
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
  return userTurnCount > 1
    ? ELABORATION_SCENARIO_DEPTH_WORD_THRESHOLD_MULTI_TURN
    : ELABORATION_SCENARIO_DEPTH_WORD_THRESHOLD_SINGLE_TURN;
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
    scoringMetadata?: Record<string, unknown> | null;
  },
): {
  pillarScores: Record<string, number | null | undefined>;
  keyEvidence: Record<string, string>;
  depthModifierMeta: ResponseDepthModifierMeta;
} {
  const ps: Record<string, number | null | undefined> = { ...pillarScores };
  const ke: Record<string, string> = { ...(keyEvidence ?? {}) };
  const levelTagQa: LevelTagQaNote[] = [];
  const t = userTurnsJoinedText.replace(/\s+/g, ' ').trim();
  const threshold = options?.depthModifierThreshold ?? ELABORATION_DEFAULT_DEPTH_THRESHOLD;
  const appliedMarkers: string[] = [];
  const holisticLevels = extractScenarioHolisticEvidenceLevelsFromScoringMetadata(
    options?.scoringMetadata ?? null,
  );
  const depthEvidenceBaseline: Record<string, string | undefined> = { ...ke };
  migratePillarConfidenceLeakedIntoKeyEvidence(ke);
  const depthMarkerIds = Object.keys(ke);
  replaceConfidenceOnlyInKeyEvidenceRecord(ke, depthMarkerIds, t);

  if (scenarioNumber === 2 && ABSOLUTION_BEFORE_INSIGHT.test(t)) {
    capAt(ps, ke, 'appreciation', ELABORATION_APPRECIATION_CEILING, 'Absolves character or denies wrongdoing before naming attunement miss (appreciation ceiling).');
  }

  const userWordCount = t.split(/\s+/).filter(Boolean).length;
  if (
    userWordCount > 0 &&
    userWordCount < ELABORATION_LOGISTICS_REPAIR_MAX_WORD_COUNT &&
    LOGISTICS_ONLY_REPAIR.test(t) &&
    !/\b(sorry|apolog|hurt|impact|rupture|felt|pattern|dynamic|my part|ownership|emotion)\b/i.test(t)
  ) {
    capAt(ps, ke, 'repair', ELABORATION_REPAIR_CEILING, 'Repair framed as logistics/scheduling without emotional pattern or rupture (repair ceiling).');
  }

  if (
    userWordCount > 0 &&
    userWordCount < ELABORATION_COMPENSATORY_REPAIR_MAX_WORD_COUNT &&
    COMPENSATORY_WITHOUT_EMOTIONAL_CORE.test(t) &&
    !REPAIR_EMOTIONAL_DEPTH_CUES.test(t)
  ) {
    capAt(
      ps,
      ke,
      'repair',
      ELABORATION_REPAIR_CEILING,
      'Compensatory/scheduling repair without emotional core of rupture (repair ceiling 5).',
    );
  }

  normalizeMentalizingAttunementLevelTags(ke, t, levelTagQa, holisticLevels);
  enforceDeclaredLevel1VersusNumericScore(ps, ke, 'mentalizing', holisticLevels, t);
  enforceDeclaredLevel1VersusNumericScore(ps, ke, 'attunement', holisticLevels, t);
  enforceDeclaredLevel2VersusNumericScore(ps, ke, 'mentalizing', holisticLevels, t);
  enforceDeclaredLevel2VersusNumericScore(ps, ke, 'attunement', holisticLevels, t);

  if (DIAGNOSTIC_TYPING_PATTERN.test(t) && !INTERNAL_STATE_CUES.test(t)) {
    capAt(
      ps,
      ke,
      'mentalizing',
      ELABORATION_MENTALIZING_LEVEL1_CEILING,
      'Diagnostic/attachment typing without Level 2 felt experience (Level 1; mentalizing ceiling 5).',
    );
  }

  if (maybeSubtractOneForShortSliceInsufficientEvidence(ps, ke, 'mentalizing', avgWordsPerUserTurn, threshold, depthEvidenceBaseline, t)) {
    appliedMarkers.push('mentalizing');
  }
  if (maybeSubtractOneForShortSliceInsufficientEvidence(ps, ke, 'attunement', avgWordsPerUserTurn, threshold, depthEvidenceBaseline, t)) {
    appliedMarkers.push('attunement');
  }
  if (maybeSubtractOneForShortSliceInsufficientEvidence(ps, ke, 'repair', avgWordsPerUserTurn, threshold, depthEvidenceBaseline, t)) {
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
    userSliceText?: string;
  },
): {
  pillarScores: Record<string, number | null | undefined>;
  keyEvidence: Record<string, string>;
  depthModifierMeta: ResponseDepthModifierMeta;
} {
  const ps: Record<string, number | null | undefined> = { ...pillarScores };
  const ke: Record<string, string> = { ...(keyEvidence ?? {}) };
  const appliedMarkers: string[] = [];
  const threshold = ELABORATION_MOMENT4_DEPTH_WORD_THRESHOLD;
  const depthMarkerIds = ['mentalizing', 'accountability'] as const;
  const sliceText = options?.userSliceText ?? '';
  const depthEvidenceBaseline: Record<string, string | undefined> = { ...ke };
  replaceConfidenceOnlyInKeyEvidenceRecord(ke, depthMarkerIds, sliceText);

  if (meta?.lowSpecificityAfterProbe === true) {
    for (const marker of ['mentalizing', 'accountability'] as const) {
      const raw = ps[marker];
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        ps[marker] = null;
        ke[marker] =
          'Not assessed — Moment 4 low specificity after probe; insufficient personal narrative for inner-state scoring.';
        appliedMarkers.push(marker);
      }
    }
  }

  if (maybeSubtractOneForShortSliceInsufficientEvidence(ps, ke, 'mentalizing', avgWordsPerTurnInSlice, threshold, depthEvidenceBaseline, sliceText)) {
    appliedMarkers.push('mentalizing');
  }
  if (maybeSubtractOneForShortSliceInsufficientEvidence(
    ps,
    ke,
    'accountability',
    avgWordsPerTurnInSlice,
    threshold,
    depthEvidenceBaseline,
    sliceText,
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
    userSliceText?: string;
  },
): {
  pillarScores: Record<string, number | null | undefined>;
  keyEvidence: Record<string, string>;
  depthModifierMeta: ResponseDepthModifierMeta;
} {
  const ps: Record<string, number | null | undefined> = { ...pillarScores };
  const ke: Record<string, string> = { ...(keyEvidence ?? {}) };
  const t = userTurnsJoinedText.replace(/\s+/g, ' ').trim();
  const appliedMarkers: string[] = [];
  const threshold = ELABORATION_MOMENT4_DEPTH_WORD_THRESHOLD;
  const depthMarkerIds = ['mentalizing', 'repair'] as const;
  const depthEvidenceBaseline: Record<string, string | undefined> = { ...ke };
  replaceConfidenceOnlyInKeyEvidenceRecord(ke, depthMarkerIds, t);

  if (DIAGNOSTIC_TYPING_PATTERN.test(t) && !INTERNAL_STATE_CUES.test(t)) {
    capAt(
      ps,
      ke,
      'mentalizing',
      ELABORATION_MENTALIZING_LEVEL1_CEILING,
      'Diagnostic/attachment typing without Level 2 felt experience (Moment 5 mentalizing ceiling 5).',
    );
  }

  const userWordCount = t.split(/\s+/).filter(Boolean).length;
  if (
    userWordCount > 0 &&
    userWordCount < ELABORATION_LOGISTICS_REPAIR_MAX_WORD_COUNT &&
    LOGISTICS_ONLY_REPAIR.test(t) &&
    !/\b(sorry|apolog|hurt|impact|rupture|felt|pattern|dynamic|my part|ownership|emotion)\b/i.test(t)
  ) {
    capAt(
      ps,
      ke,
      'repair',
      ELABORATION_REPAIR_CEILING,
      'Repair framed as logistics/scheduling without emotional pattern or rupture (Moment 5 repair ceiling).',
    );
  }

  if (maybeSubtractOneForShortSliceInsufficientEvidence(ps, ke, 'mentalizing', avgWordsPerTurnInSlice, threshold, depthEvidenceBaseline, t)) {
    appliedMarkers.push('mentalizing');
  }
  if (maybeSubtractOneForShortSliceInsufficientEvidence(ps, ke, 'repair', avgWordsPerTurnInSlice, threshold, depthEvidenceBaseline, t)) {
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

