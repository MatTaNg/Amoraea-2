/**
 * Lexicon-based narrative vs conceptual signal for interview transcripts.
 * Shared by analyze-interview-text and reprocess scripts — keep in sync.
 *
 * ─── narrative_conceptual_score — STORED VALUE DIRECTION (DATA INTEGRITY) ───
 * Single-line scale (same as DB column & analyze-interview-text):
 *     **0 = conceptual pole** (framework / pattern / clinical lexicon only in the mix).
 *     **1 = narrative pole** (episodic / first-person memory cues only in the mix).
 * Computed in `narrativeConceptualRatioFromCorpus` as:
 *
 *     storyMarkerCount / (storyMarkerCount + conceptualMarkerCount)
 *
 * After normalization, clamped to [0, 1].
 *
 *   • **1.0** = 100% of matched lexicon hits are **narrative / episodic personal-memory** cues
 *             (no conceptual hits in the denominator mix).
 *   • **0.0** = 100% of matched hits are **conceptual / pattern / framework** cues
 *             (no narrative hits), **or** weak-only conceptual hits with **no strong framework** lexicon
 *             (see `narrativeConceptualRatioFromCorpus` mid-band floor — not the deep-theory pole).
 *   • **0.5** = no hits from either side, OR equal hit counts (tie).
 *
 * `communication_style_profiles.narrative_conceptual_score` MUST keep this meaning.
 * styleTranslations: score **≥ ~0.68** → primary label **storyteller** only when the transcript
 * also shows **≥ 2** distinct personal narrative episodes (`countPersonalNarrativeEpisodesAcrossTranscript`);
 * score **≤ ~0.35** → **conceptual thinker**. Do **not** store (1 − ratio) here — that would
 * invert labels and mark analytical users as storytellers.
 *
 * Story markers intentionally **exclude** phrasing people use when retelling **fictional vignettes**
 * ("that night," "one time [character]…," "what happened was" in third-person scenario talk),
 * and **bare** "when i was …" / "i remember …" used for hypotheticals ("when i was thinking about reese,"
 * "i remember jordan said…") — those produced storyHits with **zero** conceptual lexicon hits and false **1.0**.
 * See `STORY_MARKER_PATTERNS` (tight episodic cues only).
 *
 * DEBUG / QA — extreme narrative_conceptual_score (e.g. 0 for verdict-only speakers):
 * amoraea/src/constants/interviewPipelineDebugSteps.ts (NARRATIVE_CONCEPTUAL_SCORE_DEBUG_REFERENCE).
 */

/** Normalize text so lexicon regexes see ASCII hyphens (e.g. co-regulation vs Unicode dash). */
export function normalizeInterviewStyleCorpus(corpus: string): string {
  return corpus
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, '-');
}

/**
 * Episodic / autobiographical cues only. Bare `when i was` and bare `i remember` are **excluded**:
 * they match hypothetical and vignette walkthroughs ("when i was thinking about reese", "i remember sam said…")
 * with **zero** conceptual lexicon hits → false **narrative_conceptual_score = 1.0**.
 */
export const STORY_MARKER_PATTERNS: readonly RegExp[] = [
  /\blast year\b/g,
  /\bthe other day\b/g,
  /\bgrowing up\b/g,
  /\bi remember when\b/gi,
  /\bi remember (?:last (?:year|summer|winter|spring|fall|month|week)|the other day)\b/gi,
  /\bi remember (?:being |my |how |what it felt|sitting |walking |calling |talking to |feeling )\b/gi,
  // Autobiographical "when i was …" — not "when i was thinking / answering / putting myself…"
  /\bwhen i was (?:younger|young|a kid|a child|little|so (?:young|little)|home\b|there\b|in (?:high school|college|middle school|grad school)|at home\b|still (?:in high school|at home|in college)|[0-9]{1,2}\b|with my\b|going through\b)/gi,
];

export function storyMarkerCount(text: string): number {
  let total = 0;
  for (const re of STORY_MARKER_PATTERNS) {
    const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
    const r = new RegExp(re.source, flags);
    const ms = text.match(r);
    if (ms) total += ms.length;
  }
  return total;
}

/** Indices of story-marker matches for episode clustering (same semantics as `storyMarkerCount`). */
function storyMarkerMatchIndices(text: string): number[] {
  const positions: number[] = [];
  for (const re of STORY_MARKER_PATTERNS) {
    const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
    const r = new RegExp(re.source, flags);
    let m: RegExpExecArray | null;
    const execRe = new RegExp(r.source, r.flags);
    while ((m = execRe.exec(text)) !== null) positions.push(m.index);
  }
  return positions.sort((a, b) => a - b);
}

export function conceptualMarkerCount(text: string): number {
  const markers = [
    /\bin general\b/g,
    /\bpeople tend to\b/g,
    /\brelationships often\b/g,
    /\btypically\b/g,
    /\busually\b/g,
    /\bthe thing about\b/g,
    /\bwhat matters is\b/g,
    /\bthe key is\b/g,
    /\bin principle\b/g,
    /\bpattern\b/g,
    /\bdynamic\b/g,
    /\bframework\b/g,
    /\bcycle\b/g,
    /\bcontract\b/g,
    /\bcategory\b/g,
    /\b(?:pursue|demand)-withdraw(?:al)?\b/gi,
    /\b(withdraw|withdrawal|stonewall)\b/gi,
    /\bdemand\b/gi,
    /\bpursue\b/gi,
    /\bmentaliz/gi,
    /\battun(e|ement)\b/gi,
    /\bco-?regulat/gi,
    /\bregulation\b/gi,
    /\bbehavioral\b/gi,
    /\bepistemic\b/gi,
    /\bintersubjective\b/gi,
    /\bcontingent\b/gi,
    /\bscaffolding\b/gi,
    /\bsystemic\b/g,
    /\b(diagnose|diagnosing|diagnosis)\b/gi,
    /\bmechanism\b/g,
    /\bhypothesis\b/g,
    /\bvariable\b/g,
    /\bconstruct\b/g,
    /\bvignette\b/gi,
    /\boperationaliz/gi,
  ];
  return markers.reduce((acc, re) => acc + (text.match(re)?.length ?? 0), 0);
}

/**
 * Framework / clinical lexicon that supports a "conceptual thinker" read — not casual words like
 * "pattern" or "mistake" in scenario verdicts (see narrativeConceptualRatioFromCorpus floor).
 */
const STRONG_CONCEPTUAL_MARKER_PATTERNS: readonly RegExp[] = [
  /\b(?:pursue|demand)-withdraw(?:al)?\b/gi,
  /\bco-?regulat/gi,
  /\bmentaliz/gi,
  /\bintersubjective\b/g,
  /\bepistemic\b/g,
  /\bscaffolding\b/g,
  /\boperationaliz/gi,
  /\bvignette\b/gi,
  /\bhypothesis\b/g,
  /\bsystemic\b/g,
  /\bframework\b/g,
  /\bcategory error\b/gi,
  /\bconstruct\b/g,
  /\bmechanism\b/g,
  /\b(diagnose|diagnosing|diagnosis)\b/gi,
];

/** Count of clearly framework-oriented hits (for label guard + narrative/conceptual mid-band). */
export function strongConceptualMarkerCount(text: string): number {
  return STRONG_CONCEPTUAL_MARKER_PATTERNS.reduce((acc, re) => acc + (text.match(re)?.length ?? 0), 0);
}

/**
 * Distinct strong-framework **pattern families** with ≥1 match. Repeating the same token (e.g. "hypothesis"
 * three times) still counts as **one** family — used to decide mid-band floor vs true multi-framework pole.
 */
export function strongConceptualPatternFamilyCount(text: string): number {
  let n = 0;
  for (const re of STRONG_CONCEPTUAL_MARKER_PATTERNS) {
    const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
    const r = new RegExp(re.source, flags);
    const m = text.match(r);
    if (m && m.length > 0) n += 1;
  }
  return n;
}

/**
 * Production ratio for `narrative_conceptual_score` (stored on `communication_style_profiles`).
 *
 * SCALE (not inverted): **0 → conceptual pole**, **1 → narrative pole** (values in between are mixed;
 * 0.5 = tie or no lexicon hits). Formula: storyHits / (storyHits + conceptHits).
 *
 * **Mid-band floor:** verdict-heavy talk can yield storyHits≈0 and ratio **0** while the speaker is not
 * at the deep-theory pole. Apply **~0.36** when conceptual hits exist but **strong** framework lexicon
 * spans **at most one pattern family** (repeating the same jargon token does not add families).
 * **Two or more distinct strong families** → keep raw ratio (true framework-heavy voice stays near 0).
 */
export function narrativeConceptualRatioFromCorpus(corpus: string): number {
  const normalized = normalizeInterviewStyleCorpus(corpus);
  const storyMarkers = storyMarkerCount(normalized);
  const conceptMarkers = conceptualMarkerCount(normalized);
  const den = storyMarkers + conceptMarkers;
  if (!den) return 0.5;
  const r = Math.max(0, Math.min(1, storyMarkers / den));
  const strongFamilies = strongConceptualPatternFamilyCount(normalized);
  const sparseStoryVerdictVoice =
    conceptMarkers > 0 &&
    strongFamilies <= 1 &&
    (storyMarkers === 0 || r < 0.12 || (storyMarkers <= 1 && r <= 0.2));
  if (sparseStoryVerdictVoice) {
    return Math.max(r, 0.36);
  }
  return r;
}

/**
 * jsonb usually deserializes to an array; some paths store a JSON string. Used for style + handoff split.
 */
export function coerceInterviewTranscriptArray(raw: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>;
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw) as unknown;
      if (Array.isArray(p)) return p as Array<Record<string, unknown>>;
    } catch {
      /* ignore */
    }
  }
  return [];
}

/** User message strings from a stored interview `transcript` JSON array. */
export function userTurnContentsFromInterviewTranscript(transcript: unknown): string[] {
  return coerceInterviewTranscriptArray(transcript)
    .filter((m) => {
      const r = m as Record<string, unknown>;
      return String(r?.role ?? '').toLowerCase() === 'user' && typeof r?.content === 'string';
    })
    .map((m) => String((m as Record<string, unknown>).content).trim())
    .filter(Boolean);
}

const EPISODE_CLUSTER_MIN_GAP = 130;

/**
 * Estimates how many distinct narrative beats (personal scene / story segments) appear in one span.
 * Used to gate primary label "storyteller": require evidence across the full transcript, not lexicon alone.
 */
export function countNarrativeEpisodeClustersInTurn(turn: string): number {
  const norm = normalizeInterviewStyleCorpus(turn).trim();
  if (norm.length < 26) return 0;
  if (!/\b(i|me|my|myself)\b/.test(norm)) return 0;

  const hasStoryMarkers = storyMarkerCount(norm) >= 1;
  const scenarioNames = (norm.match(/\b(sam|reese|jordan|alex|theo|morgan)\b/g) ?? []).length;
  const personalKinOrPeer =
    /\b(my (mom|dad|mother|father|partner|friend|family|ex|wife|husband|sister|brother|kids?|aunt|uncle|cousin))\b/.test(
      norm,
    );
  const scenarioOnly =
    scenarioNames >= 2 &&
    !personalKinOrPeer &&
    !hasStoryMarkers &&
    !/\b(in my (life|relationship|marriage|family))\b/.test(norm);
  if (scenarioOnly) return 0;

  const positions: number[] = [...storyMarkerMatchIndices(norm)];
  const actionRe = /\b(i (went|had|felt|told|met|called|wrote|said|did|got|realized|decided))\b/gi;
  let m: RegExpExecArray | null;
  while ((m = actionRe.exec(norm)) !== null) positions.push(m.index);
  positions.sort((a, b) => a - b);

  if (positions.length === 0) {
    const personalScene =
      personalKinOrPeer &&
      norm.length >= 72 &&
      /\b(when|after|before|because|once|that time|that night)\b/.test(norm);
    return personalScene ? 1 : 0;
  }

  let clusters = 1;
  for (let i = 1; i < positions.length; i++) {
    if (positions[i] - positions[i - 1] >= EPISODE_CLUSTER_MIN_GAP) clusters++;
  }
  return clusters;
}

/**
 * Sum of episode clusters across user turns (preferred), else a single pass over `userCorpus`.
 * Returns **null** when neither turns nor corpus are provided — callers may treat null as "skip episode guard."
 */
export function countPersonalNarrativeEpisodesAcrossTranscript(opts: {
  userCorpus?: string | null;
  userTurns?: string[] | null;
}): number | null {
  const turns = opts.userTurns?.filter((t) => String(t).trim().length > 0) ?? [];
  if (turns.length > 0) {
    let sum = 0;
    for (const t of turns) sum += countNarrativeEpisodeClustersInTurn(t);
    return sum;
  }
  const c = opts.userCorpus?.trim();
  if (c) return countNarrativeEpisodeClustersInTurn(c);
  return null;
}

/** Felt / empathic processing cues — not the same as naming an emotion in a verdict. */
const FEELING_FORWARD_REGISTER_PATTERNS: RegExp[] = [
  /\boh[, ]\b/i,
  /\bi feel\b/i,
  /\bi felt\b/i,
  /\bim worried\b/i,
  /\bim scared\b/i,
  /\bit hurts\b/i,
  /\bit stings\b/i,
  /\bso much pain\b/i,
  /\bsad (for|that|to)\b/i,
  /\bhurts (me|to watch|to see)\b/i,
  /\bpainful (for|to)\b/i,
  /\bemotionally\b/i,
  /\bfor me\b[^.]{0,40}\b(feel|felt|lands?|hits?|heavy|raw)\b/i,
  /\bi'?m (sad|heartbroken|devastated|gutted|shaken)\b/i,
  /\b(i was|i am) really (moved|touched)\b/i,
  /\btender\b/i,
  /\bvulnerable\b/i,
  /\bresonates\b/i,
  /\blands for me\b/i,
  /\bgut punch\b/i,
  /\bso (heavy|sad)\b/i,
];

/** Direct verdict / closure register — analytical certainty, not feeling-first processing. */
const DIRECT_VERDICT_REGISTER_PATTERNS: RegExp[] = [
  /that'?s the problem\b/i,
  /simple as that\b/i,
  /isn'?t worth (the )?energy\b/i,
  /not worth (the )?energy\b/i,
  /just aren'?t worth\b/i,
  /\baren'?t worth (the )?energy\b/i,
  /end of story\b/i,
  /case closed\b/i,
  /black and white\b/i,
  /straight up[, ]\b/i,
  /bottom line\b/i,
  /dropped the ball\b/i,
  /the problem is\b/i,
  /obviously\s+(he|she|they|sam|jordan|alex)\b/i,
  /clearly\s+(he|she|they)\b/i,
];

function countRegexPatternHits(norm: string, patterns: readonly RegExp[]): number {
  let total = 0;
  for (const p of patterns) {
    const flags = p.global ? p.flags : `${p.flags}g`;
    const re = new RegExp(p.source, flags);
    const ms = norm.match(re);
    if (ms) total += ms.length;
  }
  return total;
}

/** Enough user text to apply transcript-level primary-label guards (storyteller, leads with feeling). */
export function hasTranscriptSignalForStyleLabels(
  options?: {
    userCorpus?: string | null;
    userTurns?: string[] | null;
    scenarioUserCorpus?: string | null;
    scenarioUserTurns?: string[] | null;
    scenarioMainAnalysisUserTurns?: string[] | null;
  } | null,
): boolean {
  const turns = options?.userTurns?.filter((t) => String(t).trim().length > 0) ?? [];
  if (turns.length > 0) return true;
  const c = options?.userCorpus?.trim() ?? '';
  if (c.length >= 12) return true;
  const main = options?.scenarioMainAnalysisUserTurns?.filter((t) => String(t).trim().length > 0) ?? [];
  if (main.length > 0) return true;
  const st = options?.scenarioUserTurns?.filter((t) => String(t).trim().length > 0) ?? [];
  if (st.length > 0) return true;
  const sc = options?.scenarioUserCorpus?.trim() ?? '';
  return sc.length >= 12;
}

/** First sentence (if short enough) or capped prefix — opening register for a user turn. */
function feelingOpeningSnippetFromTurn(turn: string, maxLen = 168): string {
  const t = turn.trim();
  if (!t) return '';
  const cut = t.slice(0, maxLen);
  const m = cut.match(/^.{12,140}[.!?](?=\s|$)/);
  if (m) return m[0];
  return cut;
}

/**
 * True when some user turn (or corpus lead-in) opens with felt-forward cues — not emotion tokens only mid-answer.
 * Used to gate primary **leads with feeling** so inflated emotional_analytical_score cannot assign it alone.
 */
export function transcriptHasEmotionalOpeningLanguage(
  options?: { userCorpus?: string | null; userTurns?: string[] | null } | null,
): boolean {
  const turns = options?.userTurns?.filter((t) => String(t).trim().length > 0) ?? [];
  if (turns.length > 0) {
    for (const turn of turns) {
      const snip = feelingOpeningSnippetFromTurn(turn);
      if (snip.length < 8) continue;
      const norm = normalizeInterviewStyleCorpus(snip);
      if (countRegexPatternHits(norm, FEELING_FORWARD_REGISTER_PATTERNS) >= 1) return true;
    }
    return false;
  }
  const c = options?.userCorpus?.trim() ?? '';
  if (c.length >= 24) {
    const norm = normalizeInterviewStyleCorpus(feelingOpeningSnippetFromTurn(c, 220));
    return countRegexPatternHits(norm, FEELING_FORWARD_REGISTER_PATTERNS) >= 1;
  }
  return false;
}

export type LeadsWithFeelingPrimaryProfileSlice = {
  /** When present, enables high-axis fallback alongside opening-snippet guard. */
  emotional_analytical_score?: number;
  emotional_vocab_density: number;
  first_person_ratio: number;
  narrative_conceptual_score: number;
};

/** Opening-snippet guard (felt-forward register); aligned with `describeEmotionalAnalyticalAxis` score-only copy. */
const LEADS_WITH_FEELING_HIGH_AXIS_EA = 0.68;
const LEADS_WITH_FEELING_HIGH_AXIS_EVD = 1.2;
/** Excludes verdict-heavy / third-person vignette walkthroughs with inflated axis scores (Prompt 6 regression). */
const LEADS_WITH_FEELING_HIGH_AXIS_FPR = 0.65;

function numOrDefault(v: number | null | undefined, d: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : d;
}

/**
 * Primary chip **leads with feeling** — transcript + emotional **opening** language, not numeric axis alone.
 * Verdict-heavy corpora are already constrained by `transcriptHasEmotionalOpeningLanguage` (felt cues in an
 * opening snippet); extra corpus-wide verdict counts previously blocked interview-realistic mixes where
 * direct verdict phrases outnumber explicit "i feel" hits despite a genuine felt-forward opening.
 *
 * **High-axis fallback:** when the stored `emotional_analytical_score` and `emotional_vocab_density` are both
 * high but opening lines are analytical ("I think…"), still qualify the primary label — matches interview-realistic
 * feeling-led corpora that score high on the axis without felt-forward *openings*.
 */
export function qualifiesForLeadsWithFeelingPrimary(
  profile: LeadsWithFeelingPrimaryProfileSlice,
  options?: { userCorpus?: string | null; userTurns?: string[] | null } | null,
): boolean {
  if (!hasTranscriptSignalForStyleLabels(options)) return false;
  if (transcriptHasEmotionalOpeningLanguage(options)) return true;
  const ea = numOrDefault(profile.emotional_analytical_score, 0.5);
  const evd = numOrDefault(profile.emotional_vocab_density, 0);
  const fpr = numOrDefault(profile.first_person_ratio, 0);
  if (ea >= LEADS_WITH_FEELING_HIGH_AXIS_EA && evd >= LEADS_WITH_FEELING_HIGH_AXIS_EVD && fpr >= LEADS_WITH_FEELING_HIGH_AXIS_FPR) {
    return true;
  }
  return false;
}

export type MoreHeartRegisterProfileSlice = {
  emotional_vocab_density: number;
  first_person_ratio: number;
  narrative_conceptual_score: number;
};

/**
 * Secondary label "more heart than head" requires moderate emotional_analytical_score (caller) **and**
 * felt-forward **opening** language (same bar as "leads with feeling").
 *
 * Prefer `scenarioMainAnalysisUserTurns` (the three vignette "what's going on" answers only). Otherwise
 * `scenarioUserTurns` (full fiction segment) — excludes personal answers but can still include repair
 * lines with "I feel…". If both are absent, `scenarioUserCorpus` then full transcript (legacy).
 */
export function qualifiesForMoreHeartThanHeadSecondary(
  profile: MoreHeartRegisterProfileSlice,
  options:
    | {
        userCorpus?: string | null;
        userTurns?: string[] | null;
        scenarioUserCorpus?: string | null;
        scenarioUserTurns?: string[] | null;
        scenarioMainAnalysisUserTurns?: string[] | null;
      }
    | undefined,
  narrativeEpisodeCount: number | null,
): boolean {
  void profile;
  void narrativeEpisodeCount;
  if (!hasTranscriptSignalForStyleLabels(options)) return false;

  const mainAnalysis = options?.scenarioMainAnalysisUserTurns?.filter((t) => String(t).trim().length > 0) ?? [];
  if (mainAnalysis.length > 0) {
    return transcriptHasEmotionalOpeningLanguage({ userTurns: mainAnalysis });
  }
  const scenarioTurns = options?.scenarioUserTurns?.filter((t) => String(t).trim().length > 0) ?? [];
  if (scenarioTurns.length > 0) {
    return transcriptHasEmotionalOpeningLanguage({ userTurns: scenarioTurns });
  }
  const sc = options?.scenarioUserCorpus?.trim() ?? '';
  if (sc.length >= 24) {
    return transcriptHasEmotionalOpeningLanguage({ userCorpus: sc });
  }
  return transcriptHasEmotionalOpeningLanguage(options);
}
