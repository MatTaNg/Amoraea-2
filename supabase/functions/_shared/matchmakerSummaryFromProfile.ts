/**
 * Precomputed `matchmaker_summary` for `communication_style_profiles` and matchmaker LLM context.
 *
 * PRODUCTION PATH (single source — no duplicate builders):
 * - `translateStyleProfile` in `styleTranslations.ts` imports and calls `buildMatchmakerSummaryFromProfile`.
 * - Edge functions `analyze-interview-text` and `analyze-interview-audio` upsert `translateStyleProfile` output.
 * - App code imports the same module via `src/utilities/styleTranslations.ts` → this file.
 *
 * Rules: third person, present tense; exactly three sentences; **never** internal primary/secondary chip
 * strings or close paraphrases (see `matchmakerSummaryReadsAsChipRestatement` in `styleTranslations.ts`).
 * `translateStyleProfile` also enforces `countMatchmakerSummaryTemplateSentences === 3` and falls back to neutral prose if not.
 *
 * Copy is grounded in numeric style axes, optional transcript excerpts, and **boolean** hints derived from
 * the same gates that set primary labels (never the chip strings themselves).
 */

export type MatchmakerSummaryProfileInput = {
  emotional_analytical_score: number;
  narrative_conceptual_score: number;
  certainty_ambiguity_score: number;
  relational_individual_score: number;
  emotional_vocab_density: number;
  qualifier_density: number;
  avg_response_length: number;
  warmth_score: number;
  emotional_expressiveness: number;
  speech_rate: number;
  audio_confidence: number;
  /** Share of I/me/my — sharpens individual vs relational tails when present. */
  first_person_ratio?: number;
  /** Vocal energy swing — only used when audio is usable. */
  energy_variation?: number;
};

/** Booleans mirror primary label membership; prose must never echo chip names. */
export type MatchmakerStyleHints = {
  leadsWithFeelingPrimary: boolean;
  storytellerPrimary: boolean;
  conceptualThinkerPrimary: boolean;
  analyticalPrimary: boolean;
  headyPrimary: boolean;
  warmPrimary: boolean;
  expressivePrimary: boolean;
};

export type BuildMatchmakerSummaryOptions = {
  /** Joined user turns from the interview (any case). */
  userCorpus?: string | null;
  /** Raw turns in order — preferred source for short illustrative excerpts. */
  userTurns?: string[] | null;
  scenarioUserCorpus?: string | null;
  personalUserCorpus?: string | null;
  styleHints?: MatchmakerStyleHints | null;
  /** Distinct personal-story episodes counted for storyteller guard — varies summary texture. */
  narrativeEpisodeCount?: number | null;
};

/** Quick character-verdict tone in scenarios vs reflective hedging in personal answers. */
function scenarioPersonalRegisterMismatch(scenarioCorpus: string, personalCorpus: string): boolean {
  const s = scenarioCorpus.trim();
  const p = personalCorpus.trim();
  if (s.length < 80 || p.length < 80) return false;
  const verdictRes = [
    /\bemotionally immature\b/,
    /\bnot an acceptable\b/,
    /\bgrowing up to do\b/,
    /\bnot capable of prioritiz/,
    /\baren'?t capable\b/,
    /\bjust aren'?t capable\b/,
    /\breal problem\b/,
    /\btoo sensitive\b/,
    /\bnever had to put\b/,
  ];
  let v = 0;
  for (const re of verdictRes) {
    if (re.test(s)) v++;
  }
  const reflectiveRes = [
    /\bworking on\b/,
    /\btherapy\b/,
    /\bnot fully there\b/,
    /\bwish i\b/,
    /\blooking back\b/,
    /\bafraid of conflict\b/,
    /\bi tend to\b/,
    /\bi find it hard\b/,
  ];
  let r = 0;
  for (const re of reflectiveRes) {
    if (re.test(p)) r++;
  }
  if (v >= 2 && r >= 2) return true;
  if (s.length >= 100 && p.length >= 100 && v >= 1 && r >= 1) return true;
  return false;
}

function wordCountApprox(corpus: string): number {
  return corpus.trim().split(/\s+/).filter(Boolean).length;
}

function pick<T>(arr: readonly T[], key: number): T {
  if (arr.length === 0) throw new Error('pick: empty array');
  return arr[Math.abs(key) % arr.length]!;
}

/** Stable fingerprint so nearby profiles and different corpora pick different template variants. */
function summaryVariantKey(
  profile: MatchmakerSummaryProfileInput,
  corpusLen: number,
  options?: BuildMatchmakerSummaryOptions
): number {
  let h = (corpusLen % 509) + ((options?.narrativeEpisodeCount ?? 0) % 97) * 13;
  const mix = (n: number) => {
    h = (h * 41 + Math.round(n * 1000)) % 2000000000;
  };
  mix(profile.emotional_analytical_score);
  mix(profile.narrative_conceptual_score);
  mix(profile.certainty_ambiguity_score);
  mix(profile.relational_individual_score);
  mix(Math.min(30, profile.emotional_vocab_density) / 30);
  mix(Math.min(30, profile.qualifier_density) / 30);
  mix(Math.min(400, profile.avg_response_length) / 400);
  mix(profile.warmth_score);
  mix(profile.speech_rate / 220);
  mix(profile.first_person_ratio ?? 0.5);
  mix(profile.energy_variation ?? 0.35);
  return Math.abs(h);
}

const EMAILISH = /\b[\w.%+-]+@[\w.-]+\.[A-Za-z]{2,}\b/;

function buildCorpusText(options?: BuildMatchmakerSummaryOptions): string {
  const turns = options?.userTurns?.map((t) => String(t).trim()).filter(Boolean) ?? [];
  if (turns.length > 0) return turns.join(' ').trim();
  return (options?.userCorpus ?? '').trim();
}

/** User-generated snippet must not trip label-echo guards on the full summary. */
function excerptPassesChipSafe(excerpt: string): boolean {
  const t = excerpt.toLowerCase();
  if (
    /\b(storyteller|conceptual thinker|leads with feeling|heady|analytical|expressive|warm|even-keeled|unhurried|fast-paced)\b/i.test(
      t
    )
  ) {
    return false;
  }
  if (/\bcome across as\b/i.test(t)) return false;
  if (/\bmore heart than head\b/i.test(t)) return false;
  return true;
}

function pickIllustrativeExcerpt(options?: BuildMatchmakerSummaryOptions): string | null {
  const full = buildCorpusText(options);
  if (full.length < 55) return null;
  let cleaned = full.replace(/\s+/g, ' ').replace(EMAILISH, '').trim();
  const emotionalHit =
    /\b(feel|felt|feeling|scared|angry|hurt|love|cry|cried|anxious|ashamed|proud|tension|relief|overwhelmed|lonely|safe|heard)\b/i;
  let segment = cleaned.slice(0, 280);
  const idx = cleaned.search(emotionalHit);
  if (idx >= 0 && idx < 420) {
    segment = cleaned.slice(Math.max(0, idx - 24), Math.min(cleaned.length, idx + 130));
  }
  segment = segment.trim();
  const flat = segment.replace(/[.?!]+/g, ',').replace(/\s+/g, ' ').trim();
  let cut = flat.slice(0, 100);
  const sp = cut.lastIndexOf(' ');
  if (sp > 44) cut = cut.slice(0, sp);
  if (cut.length < 38) return null;
  if (!excerptPassesChipSafe(cut)) return null;
  return cut;
}

function appendExcerptToS1(base: string, excerpt: string | null, key: number): string {
  if (!excerpt) return base;
  const glue = pick(
    [
      "; one thread that keeps surfacing in their wording sounds like: '{ex}'",
      "; when they thicken an answer it often gravitates toward phrasing like: '{ex}'",
      "; a representative stretch of how they talk runs: '{ex}'",
    ],
    key,
  ).replace('{ex}', excerpt);
  return `${base}${glue}`;
}

/** Scenario vs personal word economy — proxy for "register variance" without a dedicated DB column. */
function registerEconomyClause(
  scenarioC: string,
  personalC: string,
  registerMismatch: boolean,
  key: number
): string {
  if (registerMismatch || scenarioC.length < 140 || personalC.length < 140) return '';
  const wpc = (s: string) => wordCountApprox(s) / Math.max(1, s.length);
  const a = wpc(scenarioC);
  const b = wpc(personalC);
  const rel = Math.max(a, b) / Math.min(a, b) - 1;
  if (rel < 0.22) return '';
  const scenDenser = a > b;
  return pick(
    scenDenser
      ? [
          '; in the scripted beats their replies stay comparatively lean, while the personal prompts draw longer, more meandering clauses',
          '; hypothetical answers stay tight on the page, then the personal arc opens into wider, slower unpacking',
        ]
      : [
          '; reflective personal answers stay comparatively tight while the early scenario stretches sprawl more per beat',
          '; they pack more words into vignette judgments than into the later personal-thread replies, so density shifts mid-interview',
        ],
    key,
  );
}

/**
 * Three sentences (behavioral prose only):
 * 1) How they tend to order and carry substance when they explain something.
 * 2) What a partner needs to do communicatively for it to land as mutual understanding.
 * 3) One plausible tension with someone whose defaults differ (repairable if named aloud).
 */
export function buildMatchmakerSummaryFromProfile(
  profile: MatchmakerSummaryProfileInput,
  options?: BuildMatchmakerSummaryOptions
): string {
  const ea = profile.emotional_analytical_score;
  const nc = profile.narrative_conceptual_score;
  const ca = profile.certainty_ambiguity_score;
  const ri = profile.relational_individual_score;
  const audioOk = profile.audio_confidence > 0.4;
  const expr = profile.emotional_expressiveness;
  const rate = profile.speech_rate;
  const warmth = profile.warmth_score;
  const evd = profile.emotional_vocab_density;
  const qd = profile.qualifier_density;
  const arl = profile.avg_response_length;
  const fpr = profile.first_person_ratio ?? 0.5;
  const ev = profile.energy_variation ?? 0.35;

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

  const corpus = buildCorpusText(options);
  const scenarioC = (options?.scenarioUserCorpus ?? '').trim();
  const personalC = (options?.personalUserCorpus ?? '').trim();
  const registerMismatch =
    scenarioC.length > 0 && personalC.length > 0 && scenarioPersonalRegisterMismatch(scenarioC, personalC);
  const longWinded = arl >= 165 || (corpus.length > 0 && wordCountApprox(corpus) >= 320);
  const richEmotionLexicon = evd >= 7;
  const hedgingLexicon = qd >= 6;
  const hints = options?.styleHints ?? null;
  const vKey = summaryVariantKey(profile, corpus.length, options);
  const excerpt = pickIllustrativeExcerpt(options);

  // --- Sentence 1: sequencing and texture (no taxonomy that mirrors UI chips)
  let s1 = '';
  if (registerMismatch) {
    s1 = pick(
      [
        'Their communication shifts between registers across the interview: in the scripted vignettes they often answer with fast, definitive character judgments, while in the personal questions they tend to take more room for nuance, uncertainty, and reflective self-appraisal',
        'They move between registers across the interview: vignette answers can sound verdict-forward, then the personal arc opens into slower self-interrogation and softer hedging',
        'They show a split tone—crisp moral framing on the hypotheticals versus more tentative, first-person processing once the questions turn personal',
      ],
      vKey,
    );
  } else if (headyScore >= 0.62) {
    s1 = pick(
      [
        'They usually start by lining up causes and structure—what follows from what—rather than opening with a loose check-in on mood alone',
        'They reach for frameworks, contingencies, and clean causal chains before they linger on how it felt in the body',
        'Order-of-operations thinking shows up first: premises, then implications, with feelings folded in after the map is drawn',
      ],
      vKey,
    );
  } else if (feelingForward && narrativeForward) {
    let s1Base = pick(
      [
        'How it landed for them and what happened step by step tend to show up before they flatten the situation into a single takeaway',
        'They let scene-level detail and emotional charge arrive in the same breath early on, and synthesis tends to trail behind lived sequence',
        'They braid felt impact with chronological specifics before they compress everything into one headline judgment',
      ],
      vKey,
    );
    if (hints?.storytellerPrimary) {
      s1Base = pick(
        [
          `${s1Base}, and they return to distinct episodes rather than staying abstract`,
          `${s1Base}, with several separate moments named instead of one generic pattern`,
        ],
        vKey,
      );
    }
    s1 = s1Base;
  } else if (feelingForward) {
    const baseFeel = pick(
      [
        'They track stakes, tone, and what carried charge while the account is still forming, even before the through-line feels tidy',
        'They foreground how things felt in the room before they seal the narrative with a neat label',
        'Heat, care, and risk register early while the causal spine is still half-built',
        'They let interpersonal voltage show before they insist on a clean moral of the story',
        'They keep returning to what stung or steadied them while the facts are still being sorted',
      ],
      vKey,
    );
    s1 = hints?.storytellerPrimary
      ? pick(
          [
            `${baseFeel}, often hopping between concrete beats instead of one abstract frame`,
            `${baseFeel}, stitching feeling to specific beats even when the arc is unfinished`,
          ],
          vKey,
        )
      : baseFeel;
    if (hints?.expressivePrimary && audioOk) {
      s1 += pick(
        [
          ', and the vocal line tends to carry the lift and drop with them',
          ', with audible shifts that track the emotional contour of what they say',
        ],
        vKey,
      );
    }
  } else if (narrativeForward) {
    s1 = pick(
      [
        'They keep events in order and pin answers to concrete specifics before they zoom out to a general point',
        'They anchor claims in what happened when and who said what, then widen toward meaning',
        'Chronology and concrete detail lead; abstraction is something they arrive at, not where they begin',
      ],
      vKey,
    );
  } else if (analyticalForward && conceptualForward) {
    s1 = pick(
      [
        'Buckets, reasons, and if-then logic are the natural on-ramp when they explain what went on',
        'They sort situations into types, tradeoffs, and principles before they dramatize a single scene',
        'Pattern language and mechanism talk show up before they rehearse a blow-by-blow story',
      ],
      vKey,
    );
  } else {
    s1 = pick(
      [
        'Whether tone or structure goes first shifts with the topic—they do not stay glued to one lane every time',
        'They oscillate between heart-first and map-first openings depending on what the prompt pulls',
        'Their default entry point moves: sometimes charge leads, sometimes a tidy frame does',
      ],
      vKey,
    );
  }

  if (!registerMismatch) {
    if (relationalForward) {
      s1 += pick(
        [
          ', and they often keep how something lands between people in view—not only a private takeaway',
          ', and the space between people reads as live data, not background noise',
        ],
        vKey,
      );
    } else if (individualForward) {
      s1 += pick(
        [
          ', and their own vantage point with interior detail comes through readily',
          ', and first-person interiority is easy for them to surface when pressed',
        ],
        vKey,
      );
    }

    if (longWinded) {
      s1 += pick(
        [
          '; they often take time and space to unfold nuance when they talk',
          '; answers stretch while they circle the same emotional ridge from a few angles',
        ],
        vKey,
      );
    } else if (richEmotionLexicon && headyScore < 0.62) {
      s1 += pick(
        [
          '; word choice keeps circling back to affect and sore spots when something mattered',
          '; language keeps hugging hurt, relief, and risk when the topic has weight',
        ],
        vKey,
      );
    } else if (hedgingLexicon && ambiguityForward) {
      s1 += pick(
        [
          '; their wording often leaves room to revise and not-knowing',
          '; qualifiers and partial views show up even when they care about the outcome',
        ],
        vKey,
      );
    }

    if (fpr >= 0.68 && individualForward && !relationalForward) {
      s1 += pick(
        [
          '; heavy use of first-person framing shows up even when the question is relational',
          '; the I-lens stays bright even when the prompt invites a joint frame',
        ],
        vKey,
      );
    }

    s1 += registerEconomyClause(scenarioC, personalC, registerMismatch, vKey);
  }

  s1 = appendExcerptToS1(s1, excerpt, vKey);
  s1 += '.';

  // --- Sentence 2: partner communicative needs
  let s2Core = '';
  if (feelingForward && headyScore < 0.58) {
    s2Core = pick(
      [
        'To register as heard, they need someone who joins the charged layer first—before debating fixes—and still offers concrete detail so the exchange does not drift into fog',
        'They light up when a partner mirrors the emotional load first, then co-builds specifics instead of jumping to solutions',
        'What lands as caring is someone who stays with the feeling thread, then grounds it with tangible examples—not the reverse order',
      ],
      vKey,
    );
    if (hints?.leadsWithFeelingPrimary) {
      s2Core = pick(
        [
          s2Core,
          'To feel met, they need a partner who tracks affect before efficiency, then still names what would actually change day to day',
        ],
        vKey,
      );
    }
  } else if (headyScore >= 0.58 && !feelingForward) {
    s2Core = pick(
      [
        'To register as heard, they need someone who can name the point cleanly and show the reasoning, then add care that is specific—not only reassurance with no anchor',
        'They want the thesis and the steps legible first, then warmth that points to real behaviors, not vague soothing',
        'Precision and rationale read as respect; broad sympathy without structure can feel hollow to them',
      ],
      vKey,
    );
  } else {
    s2Core = pick(
      [
        'To register as heard, they need someone who pairs kindness with concrete detail—neither pure venting nor detached grilling',
        'They do best when care shows up as specificity: names, moments, and commitments—not either mush or cross-examination',
        'Balance matters: enough softness to trust the room, enough clarity to know what actually changed',
      ],
      vKey,
    );
  }

  let s2Tail = '';
  if (relationalForward) {
    s2Tail = pick(
      [
        'It helps when the other person can join the shared impact between them—not only parallel solo positions',
        'They relax when the other person names the “between us” layer, not just two private monologues',
      ],
      vKey,
    );
  } else if (individualForward) {
    s2Tail = pick(
      [
        'They need space to name their own lens accurately before being pushed into instant alignment or compromise language',
        'Pushing for quick “we” language before their interior picture is spoken can feel like skipping a step',
      ],
      vKey,
    );
  } else if (ambiguityForward) {
    s2Tail = pick(
      [
        'Forced early closure can feel dismissive, so room to revisit and refine matters',
        'They need permission to revise aloud without being read as waffling',
      ],
      vKey,
    );
  } else if (closureForward) {
    s2Tail = pick(
      [
        'Clear expectations and dependable follow-through read as care when open-ended drift would read as avoidance',
        'They steady when next steps are explicit; endless exploration without a landing plan can spike anxiety',
      ],
      vKey,
    );
  }

  const s2 = s2Tail.trim()
    ? `${s2Core.trimEnd()}; ${s2Tail.trim()}.`
    : `${s2Core.trimEnd()}.`;

  // --- Sentence 3: friction with a different default partner
  let s3 = '';
  if (feelingForward && narrativeForward && headyScore < 0.55) {
    s3 = pick(
      [
        'With a partner who opens only with abstractions, bullet points, or detached diagnosis, pace and order can clash until both say how much room the charged detail needs up front.',
        'If the other person leads with frameworks and never touches lived sequence or feeling, the opening moves can feel mismatched until pace gets negotiated explicitly.',
      ],
      vKey,
    );
  } else if (feelingForward && headyScore < 0.55) {
    s3 = pick(
      [
        'With a partner who habitually opens with abstractions or facts alone, the first stretch can feel off until both name pace and what has to happen before problem-solving.',
        'A partner who skips straight to fixes can feel like they missed the signal until both spell out what has to be witnessed first.',
      ],
      vKey,
    );
  } else if (headyScore >= 0.58 && ea < 0.52) {
    s3 = pick(
      [
        'With a partner who needs heavy mirroring before any structure, they can feel briefly unseen until they agree on order—comfort then clarity, or the reverse.',
        'When the other person needs a long emotional runway before logic, they may need to co-design whether comfort or map-making goes first.',
      ],
      vKey,
    );
  } else if (relationalForward) {
    s3 = pick(
      [
        'With a partner who treats every exchange as purely individual positioning, the shared layer they hold can be missed until they slow down and name what sits between them.',
        'If the other person only tracks private stakes, the joint field they care about can feel invisible until someone narrates the “we” explicitly.',
      ],
      vKey,
    );
  } else if (individualForward) {
    s3 = pick(
      [
        'With a partner who expects joint framing before inner clarity feels finished, timing can be read as distance until they distinguish processing space from disengagement.',
        'A partner hungry for instant “we” language may read their interior pacing as cold until they label processing time as engagement, not retreat.',
      ],
      vKey,
    );
  } else if (ambiguityForward && !closureForward) {
    s3 = pick(
      [
        'With a partner who needs fast closure, rhythm can feel uneven until they negotiate tolerance for gray space versus decisiveness.',
        'Deadlines and quick decisions from the other side can feel jarring until both calibrate how much ambiguity each can hold.',
      ],
      vKey,
    );
  } else if (closureForward && !ambiguityForward) {
    s3 = pick(
      [
        'With a partner who lives comfortably in gray zones, they can feel pressed until they negotiate when a decision is needed versus when exploration still helps.',
        'Someone who loves open loops may read their push for clarity as controlling until they time-box exploration versus commitment.',
      ],
      vKey,
    );
  } else if (audioOk && expr >= 0.7 && warmth <= 0.48) {
    s3 = pick(
      [
        'With a partner attuned to low vocal affect, intensity can be misread as conflict until baseline and tempo are calibrated.',
        'Their voice carries a lot of color; with a flatter-affect partner, intensity can scan as fight until baselines are compared out loud.',
      ],
      vKey,
    );
  } else if (audioOk && rate >= 158) {
    s3 = pick(
      [
        'With a slower-paced partner, rapid delivery can feel rushed until pauses are named as care rather than withdrawal.',
        'Their tempo runs hot; with someone who needs air between thoughts, they may need to mark pauses as intentional, not absent.',
      ],
      vKey,
    );
  } else if (audioOk && ev >= 0.72 && hints?.expressivePrimary) {
    s3 = pick(
      [
        'With a partner who prefers very steady delivery, their wide dynamic range can feel startling until range is framed as enthusiasm, not volatility.',
        'Big swings in vocal energy can land as unpredictable until they narrate what the shift means emotionally.',
      ],
      vKey,
    );
  } else {
    s3 = pick(
      [
        'With a partner whose default pace, directness, or affect-versus-structure order differs, friction stays small when those defaults are spoken aloud.',
        'Most tension tracks unstated defaults about speed, bluntness, and whether heart or map leads; naming those keeps differences workable.',
        'When pace and directness stay implicit, small mismatches stack; making preferences explicit keeps repair straightforward.',
      ],
      vKey,
    );
  }

  const joined = `${s1} ${s2} ${s3}`.replace(/\s+/g, ' ').trim();
  return joined
    .replace(/\bfog Forced early closure\b/gi, 'fog; Forced early closure')
    .replace(/\bfog Forced\b/gi, 'fog; Forced');
}
