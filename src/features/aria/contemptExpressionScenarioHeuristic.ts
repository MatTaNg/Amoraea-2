/**
 * When the model is **lenient** on `contempt_expression`, user-turn text can **cap** scores (Math.min):
 * 1) **Egregious character contempt** — high-precision lexicon (dehumanization, etc.).
 * 2) **Wholesale dismissal without character engagement** — relationship verdicts / writing the pair off
 *    without curiosity about internal experience → cap at **6** (scores 7+ require engagement per rubric).
 *
 * Ordinary moral language about bad behavior (rude, wrong, hurtful) is **not** listed here; the LLM rubric handles it.
 */
import { sliceTranscriptBeforeScenarioCToPersonalHandoff } from './probeAndScoringUtils';

/** Insults, dehumanization, global “trash person” stance — *not* “rude / wrong / inconsiderate” re actions. */
export const SCENARIO_CONTEMPT_VERDICT_REGEXES: readonly RegExp[] = [
  /\b(he|she|they)('?s| is| are) (?:an? |a |the |)(?:complete |total |utter |)(?:idiot|loser|worthless|trash|garbage|a joke|disgusting|vile|subhuman)\b/i,
  /\b(what|such) (?:a|an) (?:loser|idiot|jerk|joke|disaster|waste|pathetic|piece)\b/i,
  /\b(he|she|they)('?s| is) (?:just |)(?:a |)(?:bad|toxic|horrible|nasty) (?:person|human|guy|man|woman|people)\b/i,
  /\b(you'?re|u r) (?:a |)(?:loser|idiot|pathetic|worthless|garbage|trash)\b/i,
  /\b(piece of (?:sh|trash|garbage)|human trash|subhuman|dehumaniz|sleazebag|scum)\b/i,
  /\b(they'?re|he'?s|she'?s) (?:a |)(?:narcissist|psychopath|sociopath|monster)\b/i,
  /\b(worthless|trash) (?:person|human)\b/i,
  /\bpathetic (?:excuse|loser|man|woman|guy|girl|attempt)\b/i,
  /\b(hate her|hate him|despise her|despise him) (?:as|for being|for who|)\b/i,
  /\b(dumbass|dumb ass|moron|stupid (?:person|loser))\b/i,
];

/** User lines for one fictional scenario (tags transcript `scenarioNumber`). */
export function userTurnTextForInterviewScenario(
  transcript: Array<{ role?: string; content?: string; scenarioNumber?: number } | null | undefined> | null | undefined,
  scenarioNum: 1 | 2 | 3,
): string {
  if (!Array.isArray(transcript)) return '';
  const base =
    scenarioNum === 3 ? sliceTranscriptBeforeScenarioCToPersonalHandoff(transcript) : transcript;
  return base
    .filter(
      (m): m is { role: string; content: string; scenarioNumber?: number } =>
        !!m &&
        m.role === 'user' &&
        m.scenarioNumber === scenarioNum &&
        typeof m.content === 'string',
    )
    .map((m) => m.content.trim())
    .filter(Boolean)
    .join(' ');
}

export function countScenarioContemptVerdictSignals(text: string): number {
  const t = (text ?? '').replace(/\u2019/g, "'").toLowerCase();
  let n = 0;
  for (const re of SCENARIO_CONTEMPT_VERDICT_REGEXES) {
    if (re.test(t)) n += 1;
  }
  return n;
}

/**
 * Verdict-style dismissal of the relationship or both characters **without** naming inner life.
 * High-precision: avoid matching nuanced answers that only *mention* therapy/issues alongside mentalizing.
 */
export const WHOLESALE_DISMISSAL_REGEXES: readonly RegExp[] = [
  /\bthey shouldn'?t be together\b/i,
  /\bshouldn'?t be in a relationship\b/i,
  /\b(?:this |the )relationship (?:isn'?t|is not) working\b/i,
  /\bthey (?:both )?have (?:a lot of )?issues\b/i,
  /\bboth (?:of them )?have issues\b/i,
  /\bthey need (?:couples |relationship )?therapy\b/i,
  /\b(?:both )?need(?:s)? (?:couples |relationship )?therapy\b/i,
  /\bnot (?:a )?good (?:match|fit) (?:for each other)?\b/i,
  /\bit'?s (?:pretty )?(?:clear|obvious) (?:that )?(?:they|this relationship)\b/i,
  /\bjust (?:end (?:it|the relationship)|break up|walk away|leave)\b/i,
  /\b(?:total|complete) waste of time\b/i,
];

/** Curiosity / care about internal states — need ≥2 distinct signals to avoid the absent-engagement cap. */
export const CHARACTER_ENGAGEMENT_SIGNAL_REGEXES: readonly RegExp[] = [
  /\b(feel|felt|feeling|feelings)\b/i,
  /\b(hurt|hurting|harmed|wounded)\b/i,
  /\b(afraid|fear|fears|fearful|scared)\b/i,
  /\b(anxious|anxiety|panic|overwhelm)\b/i,
  /\b(shame|ashamed|embarrassed|vulnerable)\b/i,
  /\b(why (?:he|she|they|emma|ryan|daniel|sophie|daniel|sophie)\b)/i,
  /\bwhat(?:'s| is) (?:going on|happening) (?:for|with)\b/i,
  /\b(from (?:his|her|their) (?:perspective|side|point of view))\b/i,
  /\b(both (?:partners|people|of them)|each (?:person|partner))\b/i,
  /\b(underneath|deeper|attachment|avoidant|withdraw|bid for)\b/i,
];

export function countWholesaleDismissalSignals(text: string): number {
  const t = (text ?? '').replace(/\u2019/g, "'");
  let n = 0;
  for (const re of WHOLESALE_DISMISSAL_REGEXES) {
    if (re.test(t)) n += 1;
  }
  return n;
}

export function countCharacterEngagementSignals(text: string): number {
  const t = (text ?? '').replace(/\u2019/g, "'");
  let n = 0;
  for (const re of CHARACTER_ENGAGEMENT_SIGNAL_REGEXES) {
    if (re.test(t)) n += 1;
  }
  return n;
}

/** True → `contempt_expression` must not exceed 6 (healthy-side scale) for this scenario text. */
export function absentCharacterEngagementCapApplies(text: string): boolean {
  const w = countWholesaleDismissalSignals(text);
  if (w <= 0) return false;
  return countCharacterEngagementSignals(text) < 2;
}

const ABSENT_ENGAGEMENT_CAP = 6;

export const CONTEMPT_EXPRESSION_ABSENT_ENGAGEMENT_CAP = ABSENT_ENGAGEMENT_CAP;

/**
 * Max allowed **good** `contempt_expression` score (higher = healthier) when egregious lexicon hits
 * are present: lower = stricter cap (worse for participant = lower numeric result after merge with model).
 * Scale: higher pillar score = less contempt in how they express. These caps are **only** for the
 * character-attack lexicon above, not for moral disapproval of behavior.
 */
export function contemptExpressionScoreFromVerdictHitCount(hitCount: number): number {
  if (hitCount <= 0) return NaN;
  if (hitCount >= 4) return 2.5;
  if (hitCount === 3) return 3.5;
  if (hitCount === 2) return 4.5;
  return 5.5; // 1 strong hit: still a soft cap, not 2–3 unless model already low
}

export function applyContemptExpressionHeuristicToScenarioScores(
  userTurnsText: string,
  pillarScores: Record<string, number | null | undefined>,
  keyEvidence: Record<string, string> | undefined,
): {
  pillarScores: Record<string, number | null | undefined>;
  keyEvidence: Record<string, string>;
} {
  const nextPs: Record<string, number | null | undefined> = { ...pillarScores };
  const ke: Record<string, string> = { ...(keyEvidence ?? {}) };

  const hits = countScenarioContemptVerdictSignals(userTurnsText);
  const hScore = contemptExpressionScoreFromVerdictHitCount(hits);
  if (hits > 0 && Number.isFinite(hScore)) {
    const note = `Lexicon-backed contempt-expression signal from vignette answers (${hits} hit(s)); caps upward bias when model omitted or softened contempt_expression.`;

    const cur = nextPs.contempt_expression;
    const curN = typeof cur === 'number' && Number.isFinite(cur) ? cur : null;
    nextPs.contempt_expression = curN == null ? hScore : Math.min(curN, hScore);

    const prev = (ke.contempt_expression ?? '').trim();
    ke.contempt_expression = prev ? `${prev} | ${note}` : note;
  }

  if (absentCharacterEngagementCapApplies(userTurnsText)) {
    const cur = nextPs.contempt_expression;
    const curN = typeof cur === 'number' && Number.isFinite(cur) ? cur : null;
    if (curN != null && curN > ABSENT_ENGAGEMENT_CAP) {
      nextPs.contempt_expression = Math.min(curN, ABSENT_ENGAGEMENT_CAP);
      const note =
        `Relationship-level dismissal without sufficient character-engagement cues (<2 internal-state/curiosity signals); caps contempt_expression at ${ABSENT_ENGAGEMENT_CAP} per rubric.`;
      const prev = (ke.contempt_expression ?? '').trim();
      ke.contempt_expression = prev ? `${prev} | ${note}` : note;
    }
  }

  return { pillarScores: nextPs, keyEvidence: ke };
}

export type ScenarioSliceForContemptHeuristic = {
  pillarScores?: Record<string, number | null | undefined>;
  keyEvidence?: Record<string, string>;
} | null;

/** Apply {@link applyContemptExpressionHeuristicToScenarioScores} to a stored scenario slice (admin, recompute). */
export function enrichScenarioSliceWithContemptHeuristic(
  slice: ScenarioSliceForContemptHeuristic,
  userText: string,
): ScenarioSliceForContemptHeuristic {
  if (!slice || !userText.trim()) return slice;
  const ps = slice.pillarScores ?? {};
  const ke = slice.keyEvidence ?? {};
  const out = applyContemptExpressionHeuristicToScenarioScores(userText, ps, ke);
  return {
    ...slice,
    pillarScores: out.pillarScores,
    keyEvidence: out.keyEvidence,
  };
}
