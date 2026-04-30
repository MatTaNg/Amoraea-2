/**
 * When the model is **lenient** on `contempt_expression`, **high-precision** lexicon hits on user turns
 * can cap scores down (Math.min) for **egregious character contempt / dehumanization** only.
 * **Not** for ordinary moral language about bad behavior (rude, wrong, hurtful) — those are not listed here;
 * the LLM rubric handles them.
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
  const hits = countScenarioContemptVerdictSignals(userTurnsText);
  if (hits === 0) {
    return { pillarScores, keyEvidence: { ...(keyEvidence ?? {}) } };
  }

  const hScore = contemptExpressionScoreFromVerdictHitCount(hits);
  if (!Number.isFinite(hScore)) {
    return { pillarScores, keyEvidence: { ...(keyEvidence ?? {}) } };
  }

  const nextPs: Record<string, number | null | undefined> = { ...pillarScores };
  const ke: Record<string, string> = { ...(keyEvidence ?? {}) };
  const note = `Lexicon-backed contempt-expression signal from vignette answers (${hits} hit(s)); caps upward bias when model omitted or softened contempt_expression.`;

  const cur = nextPs.contempt_expression;
  const curN = typeof cur === 'number' && Number.isFinite(cur) ? cur : null;
  nextPs.contempt_expression = curN == null ? hScore : Math.min(curN, hScore);

  const prev = (ke.contempt_expression ?? '').trim();
  ke.contempt_expression = prev ? `${prev} | ${note}` : note;

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
