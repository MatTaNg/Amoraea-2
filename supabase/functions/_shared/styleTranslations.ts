/**
 * Experiential vocabulary for communication-style features.
 * Pure functions — no Supabase or React Native. Thresholds are tuned here as calibration data accumulates.
 */

import {
  buildMatchmakerSummaryFromProfile,
  type BuildMatchmakerSummaryOptions,
} from './matchmakerSummaryFromProfile.ts';
import {
  countPersonalNarrativeEpisodesAcrossTranscript,
  hasTranscriptSignalForStyleLabels,
  normalizeInterviewStyleCorpus,
  qualifiesForLeadsWithFeelingPrimary,
  qualifiesForMoreHeartThanHeadSecondary,
  strongConceptualMarkerCount,
} from './interviewStyleMarkers.ts';

export interface StyleProfile {
  emotional_analytical_score: number;
  /**
   * Narrative–conceptual axis: **1** = episodic / personal-story lexicon; **0** = pattern / framework lexicon
   * (`interviewStyleMarkers.ts`). Labels: high → storyteller, low → conceptual thinker — do not invert.
   */
  narrative_conceptual_score: number;
  certainty_ambiguity_score: number;
  relational_individual_score: number;
  emotional_vocab_density: number;
  first_person_ratio: number;
  qualifier_density: number;
  avg_response_length: number;
  warmth_score: number;
  emotional_expressiveness: number;
  pitch_range: number;
  speech_rate: number;
  pause_frequency: number;
  energy_variation: number;
  text_confidence: number;
  audio_confidence: number;
}

export interface StyleLabels {
  primary: string[];
  secondary: string[];
  matchmaker_summary: string;
  low_confidence_note: string | null;
}

/**
 * Optional transcript signal for `matchmaker_summary` and primary-label guards (storyteller episodes,
 * **leads with feeling** opening language). Prefer `userTurns` when available; else `userCorpus`.
 */
export type TranslateStyleProfileOptions = {
  userCorpus?: string | null;
  /** Raw user message strings in order — used to count distinct narrative episodes for the storyteller label. */
  userTurns?: string[] | null;
  scenarioUserCorpus?: string | null;
  scenarioUserTurns?: string[] | null;
  scenarioMainAnalysisUserTurns?: string[] | null;
  personalUserCorpus?: string | null;
};

/** One-line explanations for chips (primary + secondary). */
export const STYLE_LABEL_TOOLTIPS: Record<string, string> = {
  'leads with feeling':
    'They tend to reach for emotional language first when thinking things through.',
  analytical: 'They tend to structure answers with logic, causes, and frameworks before feelings.',
  storyteller:
    'They naturally anchor ideas in specific moments and personal experience.',
  'conceptual thinker': 'They often generalize into principles and patterns rather than one-off stories.',
  warm: 'Their voice and communication style reads as warm and inviting.',
  expressive: 'Their delivery shows a wide emotional range — you can read feeling in how they speak.',
  heady: 'They tend toward analysis and abstract thinking — more head than heart.',
  'more heart than head': 'Feelings edge ahead of analysis, without being extreme either way.',
  'balanced head and heart': 'They mix analysis and feeling rather than leaning hard one way.',
  'moves between stories and ideas': 'They switch between concrete anecdotes and generalizations.',
  'comfortable with uncertainty': 'They leave room for “maybe” and complexity instead of forcing closure.',
  'values clarity and resolution': 'They reach for definite language and clear takeaways.',
  'naturally thinks in terms of "we"': 'They describe dynamics and shared space as much as solo perspective — partner-focused, collective, or "we"-oriented language.',
  'strong sense of individual perspective': 'They foreground their own vantage point and interior experience.',
  'measured warmth': 'Warmth shows up, but in a controlled or understated way.',
  'more reserved in tone': 'Their voice comes across as cooler or more contained, not effusive.',
  'even-keeled delivery': 'Their speaking style stays fairly steady rather than spiky.',
  'fast-paced speaker': 'They move through ideas quickly when they talk.',
  'unhurried speaker': 'They take their time; pacing tends to be slow and deliberate.',
  'high energy': 'Rhythm and energy shift a lot — animated, lively presence.',
  'goes deep in conversation': 'They linger in nuance: longer answers, relationship frame, tolerance for ambiguity.',
  'between closure and openness': 'They mix definite language with hedging — not all-in on certainty or ambiguity.',
  'balances "I" and "we"': 'They use both individual and relational framing without a strong tilt either way.',
  '— (audio signal low)': 'Not enough reliable audio to characterize this dimension.',
  'moderate vocal range': 'Expressiveness is in the middle — not flat, not highly animated.',
};

/**
 * If a stored or LLM-produced summary matches these, it is not acceptable for DB or display.
 */
export function matchmakerSummaryReadsAsChipRestatement(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  const patterns: RegExp[] = [
    /\bcome across as\b/i,
    /\bcomes across as\b/i,
    /\breads as a\b/i,
    /\bregisters as a\b/i,
    /\bthey are a storyteller\b/i,
    /\bthey'?re a storyteller\b/i,
    /\bstoryteller\b/i,
    /\bconceptual thinker\b/i,
    /\bleads with feeling\b/i,
    /\bheady\b/i,
    /\banalytical\b/i,
    /\banalytical style\b/i,
    /\bas analytical\b/i,
    /\bexpressive\b/i,
    /\bwarm\b/i,
    /\bmore reserved in tone\b/i,
    /\beven-keeled delivery\b/i,
    /\bmeasured warmth\b/i,
    /\bfast-paced speaker\b/i,
    /\bunhurried speaker\b/i,
    /\bhigh energy\b/i,
    /\bgoes deep in conversation\b/i,
    /\bprimary style\b/i,
    /\bstyle label\b/i,
    /\bprocess and express experience\b/i,
    /\bprocess and express\b/i,
    /\bas leads\b/i,
    /\bclassified as\b/i,
    /\btheir primary (style|label)\b/i,
    /\bmore heart than head\b/i,
    /\bbalanced head and heart\b/i,
    /\bmoves between stories and ideas\b/i,
    /\bcomfortable with uncertainty\b/i,
    /\bvalues clarity and resolution\b/i,
  ];
  return patterns.some((p) => p.test(t));
}

const MIN_CHARS_PER_MATCHMAKER_SENTENCE = 28;

/** Counts substantive sentences (split on . ! ?). `translateStyleProfile` requires exactly three. */
export function countMatchmakerSummaryTemplateSentences(text: string): number {
  return text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.replace(/\s+/g, ' ').length >= MIN_CHARS_PER_MATCHMAKER_SENTENCE)
    .length;
}

const NEUTRAL_MATCHMAKER_SUMMARY_FALLBACK =
  'They mix reflection and structure without a single fixed default, and context usually pulls whether heart or head goes first. They are most understood when a partner balances warmth with specificity—neither pure venting nor cold cross-examination. Most friction shows up when pace, directness, or how much feeling to surface first stay unstated; making those defaults explicit keeps things repairable.';

export const MATCHMAKER_STYLE_VOCABULARY_BLOCK = `
STYLE VOCABULARY MAPPING:

When describing a candidate to a seeker, use the precomputed behavioral Summary from their profile (three sentences: texture, partner needs, friction). Do **not** open with "they come across as [label]" or substitute chip names like "storyteller," "heady," or "analytical" for that Summary — translate into concrete communication behavior instead.

When a user describes what they want using experiential language,
interpret it as follows and check it against the candidate's style labels:

"grounded"       → look for: even-keeled delivery, unhurried speaker,
                   balanced head and heart, low energy_variation
                   Note: groundedness is not fully captured — be honest
                   about this if asked directly

"warm"           → style label: warm, leads with feeling
"cold" / "distant" → style label: more reserved in tone
"heady"          → style label: heady, analytical, conceptual thinker
"in their head"  → style label: heady, analytical
"expressive"     → style label: expressive, high energy
"intense"        → style label: high energy, fast-paced speaker
"deep"           → style label: goes deep in conversation
"playful"        → not currently captured in style profile —
                   acknowledge this gap honestly if raised
"intellectual"   → style label: heady, conceptual thinker,
                   high avg_response_length
"storyteller"    → internal label only; in user-facing copy describe specific-moment, episodic reasoning (never say "storyteller")
"present"        → partially: unhurried speaker, measured warmth —
                   acknowledge this is not fully captured
"masculine energy" → do not infer — ask the user what they mean
                     by this and use their description to guide conversation
"feminine energy"  → do not infer — ask the user what they mean
                     by this and use their description to guide conversation

When a user asks about a dimension that is not captured or is low
confidence, say something like:
"That's something I have a partial read on — based on how they
communicate, [best available signal]. But I'd be curious what you
notice when you see their profile."

Never fabricate a label that isn't supported by the profile data.
Never use the word "score" or any numeric value when talking to users.
`.trim();

function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0.5;
  return Math.max(0, Math.min(1, v));
}

function combinedUserTextForStyleGuards(options?: TranslateStyleProfileOptions): string {
  const turns = options?.userTurns?.filter((t) => String(t).trim().length > 0) ?? [];
  if (turns.length > 0) return turns.join('\n');
  return (options?.userCorpus ?? '').trim();
}

function n(v: unknown, fallback: number): number {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : fallback;
}

/**
 * DB `narrative_conceptual_score`: **0 = conceptual pole**, **1 = narrative pole**
 * (narrative/(narrative+conceptual) — see interviewStyleMarkers.ts). **Higher → storyteller; lower → conceptual thinker** — not inverted.
 */
export function describeNarrativeConceptualAxis(score: number | null | undefined): string {
  const s = clamp01(n(score, 0.5));
  if (s >= 0.68) return 'storyteller';
  if (s <= 0.35) return 'conceptual thinker';
  return 'moves between stories and ideas';
}

/**
 * DB `certainty_ambiguity_score`: **higher → more hedging / comfort with ambiguity**;
 * **lower → more definitive / closure-oriented wording** (not a raw "certainty index").
 */
export function describeCertaintyAmbiguityAxis(score: number | null | undefined): string {
  const s = clamp01(n(score, 0.5));
  if (s >= 0.65) return 'comfortable with uncertainty';
  if (s <= 0.3) return 'values clarity and resolution';
  return 'between closure and openness';
}

/**
 * `relational_individual_score` in the DB is individual-orientation: 0 = strongly relational (we/partner-focused),
 * 1 = strongly individual (I/me-first). This matches analyze-interview-text (1 − relational-marker share).
 */
export function describeRelationalIndividualAxis(score: number | null | undefined): string {
  const s = clamp01(n(score, 0.5));
  if (s <= 0.35) return 'naturally thinks in terms of "we"';
  if (s >= 0.65) return 'strong sense of individual perspective';
  return 'balances "I" and "we"';
}

export function describeWarmthAxis(warmth: number | null | undefined, audioConfidence: number | null | undefined): string {
  if (clamp01(n(audioConfidence, 0)) <= 0.4) return '— (audio signal low)';
  const w = clamp01(n(warmth, 0.5));
  if (w >= 0.72) return 'warm';
  if (w >= 0.5) return 'measured warmth';
  return 'more reserved in tone';
}

export function describeExpressivenessAxis(
  expressiveness: number | null | undefined,
  audioConfidence: number | null | undefined
): string {
  if (clamp01(n(audioConfidence, 0)) <= 0.4) return '— (audio signal low)';
  const e = clamp01(n(expressiveness, 0.5));
  if (e >= 0.72) return 'expressive';
  if (e <= 0.35) return 'even-keeled delivery';
  return 'moderate vocal range';
}

/** Map a DB row (partial) into a StyleProfile with safe defaults for translation. */
export function styleProfileFromDbRow(row: Record<string, unknown> | null | undefined): StyleProfile {
  const r = row ?? {};
  return {
    emotional_analytical_score: clamp01(n(r.emotional_analytical_score, 0.5)),
    // 0 = conceptual pole, 1 = narrative pole (interviewStyleMarkers.narrativeConceptualRatioFromCorpus).
    narrative_conceptual_score: clamp01(n(r.narrative_conceptual_score, 0.5)),
    certainty_ambiguity_score: clamp01(n(r.certainty_ambiguity_score, 0.5)),
    relational_individual_score: clamp01(n(r.relational_individual_score, 0.5)),
    emotional_vocab_density: n(r.emotional_vocab_density, 5),
    first_person_ratio: clamp01(n(r.first_person_ratio, 0.5)),
    qualifier_density: n(r.qualifier_density, 5),
    avg_response_length: n(r.avg_response_length, 80),
    warmth_score: clamp01(n(r.warmth_score, 0.5)),
    emotional_expressiveness: clamp01(n(r.emotional_expressiveness, 0.5)),
    pitch_range: Math.max(0, n(r.pitch_range, 40)),
    speech_rate: n(r.speech_rate, 130),
    pause_frequency: Math.max(0, n(r.pause_frequency, 2)),
    energy_variation: clamp01(n(r.energy_variation, 0.35)),
    text_confidence: clamp01(n(r.text_confidence, 0)),
    audio_confidence: clamp01(n(r.audio_confidence, 0)),
  };
}

/**
 * Single-axis label for admin calibration. In the 0.55–0.67 band, "more heart than head" is not inferred
 * from numeric row fields alone — without transcript options, the qualifier rejects and this returns balanced.
 */
export function describeEmotionalAnalyticalAxis(
  score: number | null | undefined,
  profileRow?: Record<string, unknown> | null,
): string {
  const s = clamp01(n(score, 0.5));
  // Without transcript, opening guards cannot run — use 0.68 so the 0.55–0.67 band stays descriptive.
  if (s >= 0.68) return 'leads with feeling';
  if (s <= 0.35) return 'analytical';
  if (s >= 0.55) {
    if (profileRow != null && Object.keys(profileRow).length > 0) {
      const p = styleProfileFromDbRow(profileRow);
      if (
        !qualifiesForMoreHeartThanHeadSecondary(
          {
            emotional_vocab_density: p.emotional_vocab_density,
            first_person_ratio: p.first_person_ratio,
            narrative_conceptual_score: p.narrative_conceptual_score,
          },
          undefined,
          null,
        )
      ) {
        return 'balanced head and heart';
      }
    }
    return 'more heart than head';
  }
  return 'balanced head and heart';
}

export function translateStyleProfile(
  profile: StyleProfile,
  options?: TranslateStyleProfileOptions
): StyleLabels {
  const labels: string[] = [];
  const secondary: string[] = [];

  const narrativeEpisodes = countPersonalNarrativeEpisodesAcrossTranscript({
    userCorpus: options?.userCorpus,
    userTurns: options?.userTurns,
  });
  const hasTx = hasTranscriptSignalForStyleLabels(options);
  /** Storyteller primary only with transcript + ≥2 distinct narrative episodes (never score-only). */
  const storytellerEpisodeOk = hasTx && narrativeEpisodes !== null && narrativeEpisodes >= 2;
  /** "Conceptual thinker" only with transcript + ≥1 strong framework hit — not score-only (Prompt 5). */
  const frameworkEvidenceForConceptualThinker =
    hasTx &&
    strongConceptualMarkerCount(normalizeInterviewStyleCorpus(combinedUserTextForStyleGuards(options))) >= 1;

  const qualifiesLeadsWithFeeling = qualifiesForLeadsWithFeelingPrimary(profile, options);
  // 0.65 + opening-snippet guard or high-axis fallback (`qualifiesForLeadsWithFeelingPrimary`).
  if (profile.emotional_analytical_score >= 0.65 && qualifiesLeadsWithFeeling) {
    labels.push('leads with feeling');
  } else if (profile.emotional_analytical_score <= 0.35) {
    labels.push('analytical');
  } else if (
    profile.emotional_analytical_score >= 0.55 &&
    qualifiesForMoreHeartThanHeadSecondary(
      {
        emotional_vocab_density: profile.emotional_vocab_density,
        first_person_ratio: profile.first_person_ratio,
        narrative_conceptual_score: profile.narrative_conceptual_score,
      },
      options,
      narrativeEpisodes,
    )
  ) {
    secondary.push('more heart than head');
  } else {
    secondary.push('balanced head and heart');
  }

  if (profile.narrative_conceptual_score >= 0.68 && storytellerEpisodeOk) {
    labels.push('storyteller');
  } else if (profile.narrative_conceptual_score <= 0.35 && frameworkEvidenceForConceptualThinker) {
    labels.push('conceptual thinker');
  } else {
    secondary.push('moves between stories and ideas');
  }

  if (profile.certainty_ambiguity_score >= 0.65) {
    secondary.push('comfortable with uncertainty');
  } else if (profile.certainty_ambiguity_score <= 0.3) {
    secondary.push('values clarity and resolution');
  }

  // Individual-orientation: low = relational / "we"-leaning; high = individual / I-me-leaning; mid = omit.
  if (profile.relational_individual_score <= 0.35) {
    secondary.push('naturally thinks in terms of "we"');
  } else if (profile.relational_individual_score >= 0.65) {
    secondary.push('strong sense of individual perspective');
  }

  if (profile.audio_confidence > 0.4) {
    if (profile.warmth_score >= 0.72) {
      labels.push('warm');
    } else if (profile.warmth_score >= 0.5) {
      secondary.push('measured warmth');
    } else {
      secondary.push('more reserved in tone');
    }
  }

  if (profile.audio_confidence > 0.4) {
    if (profile.emotional_expressiveness >= 0.72) {
      labels.push('expressive');
    } else if (profile.emotional_expressiveness <= 0.35) {
      secondary.push('even-keeled delivery');
    }
  }

  if (profile.audio_confidence > 0.4) {
    if (profile.speech_rate >= 160) {
      secondary.push('fast-paced speaker');
    } else if (profile.speech_rate <= 115) {
      secondary.push('unhurried speaker');
    }
  }

  const headyScore =
    (1 - profile.emotional_analytical_score) * 0.4 +
    (1 - profile.narrative_conceptual_score) * 0.4 +
    (profile.audio_confidence > 0.4 && profile.speech_rate >= 155 ? 0.2 : 0);

  if (headyScore >= 0.65) {
    const toRemove = ['analytical', 'conceptual thinker'];
    const indices = toRemove
      .map((phrase) => labels.indexOf(phrase))
      .filter((i) => i > -1)
      .sort((a, b) => b - a);
    for (const i of indices) labels.splice(i, 1);
    labels.push('heady');
  }

  if (profile.audio_confidence > 0.4) {
    const intenseScore =
      (profile.speech_rate >= 155 ? 0.35 : 0) +
      (profile.emotional_expressiveness >= 0.7 ? 0.35 : 0) +
      (profile.energy_variation >= 0.7 ? 0.3 : 0);
    if (intenseScore >= 0.65) {
      secondary.push('high energy');
    }
  }

  const depthScore =
    (profile.avg_response_length >= 180 ? 0.35 : 0) +
    (profile.certainty_ambiguity_score >= 0.6 ? 0.35 : 0) +
    (profile.relational_individual_score <= 0.45 ? 0.3 : 0);
  if (depthScore >= 0.65) {
    secondary.push('goes deep in conversation');
  }

  const primary = labels.slice(0, 3);
  const summaryOpts: BuildMatchmakerSummaryOptions | undefined =
    options?.userCorpus != null && options.userCorpus !== ''
      ? {
          userCorpus: options.userCorpus,
          scenarioUserCorpus: options.scenarioUserCorpus ?? undefined,
          personalUserCorpus: options.personalUserCorpus ?? undefined,
        }
      : undefined;
  let matchmakerSummary = buildMatchmakerSummaryFromProfile(profile, summaryOpts);
  if (matchmakerSummaryReadsAsChipRestatement(matchmakerSummary)) {
    matchmakerSummary = NEUTRAL_MATCHMAKER_SUMMARY_FALLBACK;
  }
  if (countMatchmakerSummaryTemplateSentences(matchmakerSummary) !== 3) {
    matchmakerSummary = NEUTRAL_MATCHMAKER_SUMMARY_FALLBACK;
  }

  const overallConfidence = profile.text_confidence * 0.5 + profile.audio_confidence * 0.5;
  const lowConfidenceNote =
    overallConfidence < 0.5
      ? "I'm still building a full picture of this person's communication style — these impressions may evolve."
      : null;

  return {
    primary,
    secondary,
    matchmaker_summary: matchmakerSummary,
    low_confidence_note: lowConfidenceNote,
  };
}

/**
 * Production path: append when the matchmaker LLM discusses a candidate's communication.
 */
export function formatCommunicationStyleForMatchmakerPrompt(labels: StyleLabels): string {
  const primaryStr = labels.primary.length ? labels.primary.join(', ') : '(none — balanced / insufficient signal)';
  const secondaryStr = labels.secondary.length ? labels.secondary.join(', ') : '(none)';
  return [
    'COMMUNICATION STYLE — candidate reference',
    '',
    'AUTHORITATIVE SUMMARY — exactly three sentences (dominant texture → what a partner must do communicatively → one plausible friction).',
    'PRODUCTION SOURCE: This text is produced only by `buildMatchmakerSummaryFromProfile` inside `translateStyleProfile`, which runs in Supabase edge functions `analyze-interview-text` and `analyze-interview-audio` when persisting `communication_style_profiles`. It is not a model guess and not derived from Primary/Secondary chip strings.',
    labels.matchmaker_summary,
    '',
    'MANDATORY FOR ANY USER-FACING COPY (seekers, profiles, chat):',
    '- Expand or lightly paraphrase ONLY the three sentences above if needed — never replace them with a one-liner invented from Primary/Secondary tags.',
    '- Do NOT write "They come across as …", "They are a …", or list internal labels (e.g. leads with feeling, storyteller, analytical, heady, warm, expressive, conceptual thinker, or any chip string below).',
    '- If you mention communication style at all, ground every clause in behavioral detail from the Summary — not label names.',
    '',
    'HARD RULES FOR ANY USER-FACING PARAPHRASE:',
    '- Do not write "They come across as [X]", "[X] style", "They are a [X]", or "reads as a [X]" where X is a category label.',
    '- Never paste or restate the internal chip names below as standalone identity descriptors (including: storyteller, conceptual thinker, leads with feeling, analytical, heady, warm, expressive, or other Primary/Secondary strings).',
    '- Describe behavior: sequencing (feelings vs frameworks), pacing, specificity vs abstraction, joint vs individual framing — using the Summary sentences above.',
    '',
    'INTERNAL TAGS — calibration only; do not quote to seekers unless explicitly debugging with staff:',
    `- Primary: ${primaryStr}`,
    `- Secondary: ${secondaryStr}`,
    labels.low_confidence_note ? `- Low-signal note: ${labels.low_confidence_note}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
