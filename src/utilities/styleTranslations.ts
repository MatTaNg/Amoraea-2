/**
 * Experiential vocabulary for communication-style features.
 * Pure functions — no Supabase or React Native. Thresholds are tuned here as calibration data accumulates.
 */

export interface StyleProfile {
  emotional_analytical_score: number;
  narrative_conceptual_score: number;
  certainty_ambiguity_score: number;
  relational_individual_score: number;
  emotional_vocab_density: number;
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

export const MATCHMAKER_STYLE_VOCABULARY_BLOCK = `
STYLE VOCABULARY MAPPING:

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
"storyteller"    → style label: storyteller
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

function n(v: unknown, fallback: number): number {
  const x = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(x) ? x : fallback;
}

/**
 * Map a DB row (partial) into a StyleProfile with safe defaults for translation.
 */
/** Single-axis experiential label for admin calibration (same thresholds as translateStyleProfile). */
export function describeEmotionalAnalyticalAxis(score: number | null | undefined): string {
  const s = clamp01(n(score, 0.5));
  if (s >= 0.68) return 'leads with feeling';
  if (s <= 0.35) return 'analytical';
  if (s >= 0.55) return 'more heart than head';
  return 'balanced head and heart';
}

export function describeNarrativeConceptualAxis(score: number | null | undefined): string {
  const s = clamp01(n(score, 0.5));
  if (s >= 0.68) return 'storyteller';
  if (s <= 0.35) return 'conceptual thinker';
  return 'moves between stories and ideas';
}

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

export function styleProfileFromDbRow(row: Record<string, unknown> | null | undefined): StyleProfile {
  const r = row ?? {};
  return {
    emotional_analytical_score: clamp01(n(r.emotional_analytical_score, 0.5)),
    narrative_conceptual_score: clamp01(n(r.narrative_conceptual_score, 0.5)),
    certainty_ambiguity_score: clamp01(n(r.certainty_ambiguity_score, 0.5)),
    relational_individual_score: clamp01(n(r.relational_individual_score, 0.5)),
    emotional_vocab_density: n(r.emotional_vocab_density, 5),
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

export function translateStyleProfile(profile: StyleProfile): StyleLabels {
  const labels: string[] = [];
  const secondary: string[] = [];

  if (profile.emotional_analytical_score >= 0.68) {
    labels.push('leads with feeling');
  } else if (profile.emotional_analytical_score <= 0.35) {
    labels.push('analytical');
  } else if (profile.emotional_analytical_score >= 0.55) {
    secondary.push('more heart than head');
  } else {
    secondary.push('balanced head and heart');
  }

  if (profile.narrative_conceptual_score >= 0.68) {
    labels.push('storyteller');
  } else if (profile.narrative_conceptual_score <= 0.35) {
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
  const matchmakerSummary = buildMatchmakerSummary(profile);

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
 * Matchmaker-facing prose derived from feature scores only — no label chip names.
 * Third person, present tense; three sentences: texture, partner needs, plausible friction.
 */
function buildMatchmakerSummary(profile: StyleProfile): string {
  const ea = profile.emotional_analytical_score;
  const nc = profile.narrative_conceptual_score;
  const ca = profile.certainty_ambiguity_score;
  const ri = profile.relational_individual_score;
  const audioOk = profile.audio_confidence > 0.4;
  const warmth = profile.warmth_score;
  const expr = profile.emotional_expressiveness;
  const rate = profile.speech_rate;

  const headyScore =
    (1 - ea) * 0.4 + (1 - nc) * 0.4 + (audioOk && rate >= 155 ? 0.2 : 0);

  const feelingForward = ea >= 0.58;
  const narrativeForward = nc >= 0.58;
  const analyticalForward = ea <= 0.4;
  const conceptualForward = nc <= 0.4;
  const relationalForward = ri <= 0.38;
  const individualForward = ri >= 0.62;
  const ambiguityForward = ca >= 0.58;
  const closureForward = ca <= 0.35;

  // --- Sentence 1: dominant texture (optional relational / individual tail in same sentence)
  let s1 = '';
  if (headyScore >= 0.62) {
    s1 =
      'They tend to organize experience through patterns, causes, and frameworks, reaching for coherent explanation early';
  } else if (feelingForward && narrativeForward) {
    s1 =
      'They process experiences through emotion and narrative first, often sharing the felt texture of a situation before—or instead of—stripping it to logic alone';
  } else if (feelingForward) {
    s1 =
      'Feeling and impact tend to lead, and they track tone and emotional meaning even when the storyline is still forming';
  } else if (narrativeForward) {
    s1 =
      'Concrete moments and sequences carry weight, and they often reason from what happened before they generalize';
  } else if (analyticalForward && conceptualForward) {
    s1 =
      'They lean toward clear categories, reasons, and principles, and order with precision is a comfortable entry point';
  } else {
    s1 =
      'They mix reflection and structure without a single fixed default, and context usually pulls whether heart or head goes first';
  }

  if (relationalForward) {
    s1 +=
      ', and their language often holds how something lands between people—not only a private verdict';
  } else if (individualForward) {
    s1 += ', and their own vantage point with interior detail comes through readily';
  }
  s1 += '.';

  // --- Sentence 2: one combined “needs” sentence (one extra clause by priority)
  let s2Core = '';
  if (feelingForward && headyScore < 0.58) {
    s2Core =
      'They are most understood when a partner meets them in the feeling before moving to analysis, solutions, or debate';
  } else if (headyScore >= 0.58 && !feelingForward) {
    s2Core =
      'They are most understood when a partner follows reasoning and definition first, then layers care without collapsing into vague reassurance alone';
  } else {
    s2Core =
      'They are most understood when a partner balances warmth with specificity—neither pure venting nor cold cross-examination';
  }

  let s2Extra: string | null = null;
  if (relationalForward) {
    s2Extra =
      'it helps when the other person can join the shared impact between them—not only parallel solo positions';
  } else if (individualForward) {
    s2Extra =
      'they need space to name their own lens accurately before being nudged into instant alignment or compromise language';
  } else if (ambiguityForward) {
    s2Extra =
      'room for revisiting and not-knowing matters, because forced premature closure can feel dismissive';
  } else if (closureForward) {
    s2Extra =
      'clear expectations and dependable follow-through read as care, while open-ended drift can read as avoidance';
  }

  const s2 = s2Extra ? `${s2Core}, and ${s2Extra}.` : `${s2Core}.`;

  // --- Sentence 3: plausible friction (bridgeable)
  let s3 = '';
  if (feelingForward && headyScore < 0.55) {
    s3 =
      'A partner who habitually leads with frameworks or facts may feel misaligned at first, though the gap is usually bridgeable when both name pace and sequence explicitly.';
  } else if (headyScore >= 0.58 && ea < 0.52) {
    s3 =
      'A partner who needs heavy emotional mirroring before any structure may feel briefly unseen; agreeing on order—comfort then clarity, or the reverse—reduces friction.';
  } else if (relationalForward) {
    s3 =
      'Someone who treats every exchange as individual positioning can miss the shared layer they are holding; slowing down to name what sits between them eases tension.';
  } else if (individualForward) {
    s3 =
      'A partner who expects joint framing before inner clarity feels finished may read patience as distance; timing that distinction helps.';
  } else if (ambiguityForward && !closureForward) {
    s3 =
      'Partners who need fast closure may find the pace uneven; naming tolerance for ambiguity versus decisiveness prevents small pile-ups.';
  } else if (closureForward && !ambiguityForward) {
    s3 =
      'Partners who live comfortably in gray zones may feel pressed; negotiating when closure is needed versus exploratory space prevents drift into criticism.';
  } else if (audioOk && expr >= 0.7 && warmth <= 0.48) {
    s3 =
      'Vocal intensity can outrun how warm they sound; partners tuned to low affect may misread energy as conflict until baseline is calibrated.';
  } else if (audioOk && rate >= 158) {
    s3 =
      'A slower-paced partner may need explicit pauses that are not withdrawal; naming tempo prevents mistaken disinterest.';
  } else {
    s3 =
      'Most friction shows up when pace, directness, or how much feeling to surface first stay unstated; making those defaults explicit keeps things repairable.';
  }

  return `${s1} ${s2} ${s3}`.replace(/\s+/g, ' ').trim();
}

/**
 * Block for matchmaker / LLM system prompt: experiential labels (not raw numbers).
 */
export function formatCommunicationStyleForMatchmakerPrompt(labels: StyleLabels): string {
  const lines = [
    'Communication style:',
    `- Primary: ${labels.primary.length ? labels.primary.join(', ') : '(none — balanced / insufficient signal)'}`,
    `- Secondary: ${labels.secondary.length ? labels.secondary.join(', ') : '(none)'}`,
    `- Summary: ${labels.matchmaker_summary}`,
  ];
  if (labels.low_confidence_note) {
    lines.push(`- Note: ${labels.low_confidence_note}`);
  }
  return lines.join('\n');
}
