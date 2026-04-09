/**
 * When scenario LLM scoring omits `contempt_expression`, lexicon hits on user turns still indicate
 * dismissive / verdict-like framing toward fictional characters — same signal family as expression.
 * Merges with model scores via Math.min so missed harsh framing cannot be overwritten upward.
 */

import { sliceTranscriptBeforeScenarioCToPersonalHandoff } from './probeAndScoringUtils';

export const SCENARIO_CONTEMPT_VERDICT_REGEXES: readonly RegExp[] = [
  /\bemotionally immature\b/i,
  /\btoo immature\b/i,
  /\bnot an acceptable\b/i,
  /\bgrowing up to do\b/i,
  /\ba lot of growing up\b/i,
  /\bhas a lot of growing up\b/i,
  /\bnot capable of prioritiz/i,
  /\baren'?t capable\b/i,
  /\bjust aren'?t capable\b/i,
  /\breal problem\b/i,
  /\btoo sensitive\b/i,
  /\bnever had to put\b/i,
  /\bfundamentally incompatible\b/i,
  /\bwouldn'?t waste more time\b/i,
  /\bnot ready for (?:a )?serious relationship\b/i,
  /\bdeserves someone who\b/i,
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

/** Lower = worse participant contempt expression (harsher framing). Scale matches pillar 1–10. */
export function contemptExpressionScoreFromVerdictHitCount(hitCount: number): number {
  if (hitCount <= 0) return NaN;
  if (hitCount >= 6) return 2;
  if (hitCount >= 4) return 2.5;
  if (hitCount >= 3) return 3;
  if (hitCount >= 2) return 3.5;
  return 4.5;
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
