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
 * Copy is derived from numeric features and optional `userCorpus` only — not from label arrays.
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
};

export type BuildMatchmakerSummaryOptions = {
  /** Joined user turns from the interview (any case). Optional transcript signal for texture. */
  userCorpus?: string | null;
  /** User text from fictional scenarios only (before personal handoff). */
  scenarioUserCorpus?: string | null;
  /** User text from personal moments only (after scripted handoff). */
  personalUserCorpus?: string | null;
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
  // Substantial both sides but only one clear cue each — still a real register shift for matchmakers.
  if (s.length >= 100 && p.length >= 100 && v >= 1 && r >= 1) return true;
  return false;
}

function wordCountApprox(corpus: string): number {
  return corpus.trim().split(/\s+/).filter(Boolean).length;
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

  const corpus = (options?.userCorpus ?? '').trim();
  const scenarioC = (options?.scenarioUserCorpus ?? '').trim();
  const personalC = (options?.personalUserCorpus ?? '').trim();
  const registerMismatch =
    scenarioC.length > 0 && personalC.length > 0 && scenarioPersonalRegisterMismatch(scenarioC, personalC);
  const longWinded = arl >= 165 || (corpus.length > 0 && wordCountApprox(corpus) >= 320);
  const richEmotionLexicon = evd >= 7;
  const hedgingLexicon = qd >= 6;

  // --- Sentence 1: sequencing and texture (no taxonomy that mirrors UI chips)
  let s1 = '';
  if (registerMismatch) {
    // Numeric axes from the full transcript can look "narrative + feeling" while vignettes are verdict-heavy;
    // lead with register split so the summary reflects the whole interview, not only personal answers.
    // Do not append relational/individual tails here — they repeat the "personal questions" clause above.
    s1 =
      'Their communication shifts between registers across the interview: in the scripted vignettes they often answer with fast, definitive character judgments, while in the personal questions they tend to take more room for nuance, uncertainty, and reflective self-appraisal';
  } else if (headyScore >= 0.62) {
    s1 =
      'They usually start by lining up causes and structure—what follows from what—rather than opening with a loose check-in on mood alone';
  } else if (feelingForward && narrativeForward) {
    s1 =
      'How it landed for them and what happened step by step tend to show up before they flatten the situation into a single takeaway';
  } else if (feelingForward) {
    s1 =
      'They track stakes, tone, and what carried charge while the account is still forming, even before the through-line feels tidy';
  } else if (narrativeForward) {
    s1 =
      'They keep events in order and pin answers to concrete specifics before they zoom out to a general point';
  } else if (analyticalForward && conceptualForward) {
    s1 =
      'Buckets, reasons, and if-then logic are the natural on-ramp when they explain what went on';
  } else {
    s1 =
      'Whether tone or structure goes first shifts with the topic—they do not stay glued to one lane every time';
  }

  if (!registerMismatch) {
    if (relationalForward) {
      s1 +=
        ', and they often keep how something lands between people in view—not only a private takeaway';
    } else if (individualForward) {
      s1 += ', and their own vantage point with interior detail comes through readily';
    }

    if (longWinded) {
      s1 += '; they often take time and space to unfold nuance when they talk';
    } else if (richEmotionLexicon && headyScore < 0.62) {
      s1 += '; word choice keeps circling back to affect and sore spots when something mattered';
    } else if (hedgingLexicon && ambiguityForward) {
      s1 += '; their wording often leaves room to revise and not-knowing';
    }
  }

  s1 += '.';

  // --- Sentence 2: partner communicative needs
  let s2Core = '';
  if (feelingForward && headyScore < 0.58) {
    s2Core =
      'To register as heard, they need someone who joins the charged layer first—before debating fixes—and still offers concrete detail so the exchange does not drift into fog';
  } else if (headyScore >= 0.58 && !feelingForward) {
    s2Core =
      'To register as heard, they need someone who can name the point cleanly and show the reasoning, then add care that is specific—not only reassurance with no anchor';
  } else {
    s2Core =
      'To register as heard, they need someone who pairs kindness with concrete detail—neither pure venting nor detached grilling';
  }

  let s2Tail = '';
  if (relationalForward) {
    s2Tail =
      ' It helps when the other person can join the shared impact between them—not only parallel solo positions';
  } else if (individualForward) {
    s2Tail =
      ' They need space to name their own lens accurately before being pushed into instant alignment or compromise language';
  } else if (ambiguityForward) {
    s2Tail = ' Forced early closure can feel dismissive, so room to revisit and refine matters';
  } else if (closureForward) {
    s2Tail =
      ' Clear expectations and dependable follow-through read as care when open-ended drift would read as avoidance';
  }

  // s2Core has no terminal punctuation; s2Tail is a distinct clause — join with "; " to avoid run-ons like "…fog Forced early…".
  const s2 = s2Tail.trim()
    ? `${s2Core.trimEnd()}; ${s2Tail.trim()}.`
    : `${s2Core.trimEnd()}.`;

  // --- Sentence 3: friction with a different default partner
  let s3 = '';
  if (feelingForward && narrativeForward && headyScore < 0.55) {
    s3 =
      'With a partner who opens only with abstractions, bullet points, or detached diagnosis, pace and order can clash until both say how much room the charged detail needs up front.';
  } else if (feelingForward && headyScore < 0.55) {
    s3 =
      'With a partner who habitually opens with abstractions or facts alone, the first stretch can feel off until both name pace and what has to happen before problem-solving.';
  } else if (headyScore >= 0.58 && ea < 0.52) {
    s3 =
      'With a partner who needs heavy mirroring before any structure, they can feel briefly unseen until they agree on order—comfort then clarity, or the reverse.';
  } else if (relationalForward) {
    s3 =
      'With a partner who treats every exchange as purely individual positioning, the shared layer they hold can be missed until they slow down and name what sits between them.';
  } else if (individualForward) {
    s3 =
      'With a partner who expects joint framing before inner clarity feels finished, timing can be read as distance until they distinguish processing space from disengagement.';
  } else if (ambiguityForward && !closureForward) {
    s3 =
      'With a partner who needs fast closure, rhythm can feel uneven until they negotiate tolerance for gray space versus decisiveness.';
  } else if (closureForward && !ambiguityForward) {
    s3 =
      'With a partner who lives comfortably in gray zones, they can feel pressed until they negotiate when a decision is needed versus when exploration still helps.';
  } else if (audioOk && expr >= 0.7 && warmth <= 0.48) {
    s3 =
      'With a partner attuned to low vocal affect, intensity can be misread as conflict until baseline and tempo are calibrated.';
  } else if (audioOk && rate >= 158) {
    s3 =
      'With a slower-paced partner, rapid delivery can feel rushed until pauses are named as care rather than withdrawal.';
  } else {
    s3 =
      'With a partner whose default pace, directness, or affect-versus-structure order differs, friction stays small when those defaults are spoken aloud.';
  }

  const joined = `${s1} ${s2} ${s3}`.replace(/\s+/g, ' ').trim();
  // Belt-and-suspenders: older bundles concatenated s2 clauses without "; " (…fog Forced early…).
  return joined
    .replace(/\bfog Forced early closure\b/gi, 'fog; Forced early closure')
    .replace(/\bfog Forced\b/gi, 'fog; Forced');
}
