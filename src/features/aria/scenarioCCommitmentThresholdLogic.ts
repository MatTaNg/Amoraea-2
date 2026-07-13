import { normalizeInterviewTypography } from './interviewTypography';
import {
  sliceTranscriptForScenario3Scoring,
  type ScenarioCorpusMessageSlice,
} from './scenarioCTranscriptSlicing';

const SCENARIO_C_TOPIC_RE =
  /\b(sophie|daniel|repair|argument|silent|avoid|come back|relationship|communicat|boundary|listen|upset|resolved)\b/i;

/** Scenario C Q2: on-topic repair engagement (separate from commitment-threshold probe forcing). */
export function hasScenarioCQ2OnTopicEngagement(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 10) return false;
  return SCENARIO_C_TOPIC_RE.test(t);
}

/** Debug/instrumentation: which Scenario C commitment-threshold regex bucket matched (if any). */
export function scenarioCCommitmentThresholdMatchDetail(text: string): {
  irrecoverable: boolean;
  relationshipOutcome: boolean;
  decisionProcess: boolean;
} {
  const t = text.replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 12) return { irrecoverable: false, relationshipOutcome: false, decisionProcess: false };
  const irrecoverable =
    /\b(irrecover|unworkable|incompatib|deal[- ]?breaker|isn't working|isnt working|is not working|relationship is not working|not worth (it|continuing)|should (end|split)|break up|breakup|divorce|call it quits|done with (the relationship|them|him|her))\b/.test(
      t
    );
  const relationshipOutcome =
    /\b(walk away from (the relationship|it all|them|him|her)|leave (for good|the relationship)|end things|end(ing)? the relationship|leave them for good|time to go|split up|separate for good)\b/.test(
      t
    );
  const decisionProcess =
    /\b(at what point (would|do) (you|they|i|we)|when (i|we) would (end|leave|quit)|when to (end|leave|call it)|before (i|we) give up|last straw|line in the sand|non[- ]?negotiable|if (it|they) keeps? happening|this pattern keeps? happening|pattern keeps? happening|pattern (never|doesn't|does not) change|after (multiple|repeated)|years of the same)\b/.test(
      t
    );
  return { irrecoverable, relationshipOutcome, decisionProcess };
}

/**
 * Scenario C: true only when the user named relationship-level exit / unworkability criteria — not vignette motion
 * alone ("Daniel leaves", "walk away" from the room) or generic repair language.
 */
export function hasScenarioCCommitmentThresholdInUserAnswer(text: string): boolean {
  const f = scenarioCCommitmentThresholdMatchDetail(text);
  return f.irrecoverable || f.relationshipOutcome || f.decisionProcess;
}

/**
 * Threshold-style language **and** Daniel/Sophie named — satisfies the scripted Scenario C commitment probe.
 * Repair-only answers ("they're incompatible") without naming the characters do **not** skip forcing the question.
 */
export function hasScenarioCVignetteCommitmentThresholdSignal(text: string): boolean {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length < 12) return false;
  if (!/\b(daniel|sophie)\b/i.test(t)) return false;
  return hasScenarioCCommitmentThresholdInUserAnswer(t);
}

/**
 * True when assistant text embeds the canonical scripted Scenario C commitment-threshold line
 * (client inject or model). Used to avoid duplicate forces, resume false negatives, and races
 * before `scenarioCCommitmentThresholdProbeAskedRef` flips.
 */
export function assistantContainsScenarioCCommitmentThresholdForcedLine(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '')
    .replace(/\u2019/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (t.length < 50) return false;
  if (!t.includes('at what point would you say daniel or sophie should decide')) return false;
  return (
    t.includes("this relationship isn't working") ||
    t.includes('this relationship is not working') ||
    (t.includes('relationship') && (/\bisn'?t working\b/.test(t) || /\bis not working\b/.test(t)))
  );
}

/** Scenario C follow-up: when Daniel/Sophie should decide the relationship is not working (not the repair prompt). */
export function looksLikeScenarioCCommitmentThresholdAssistantPrompt(text: string): boolean {
  if (assistantContainsScenarioCCommitmentThresholdForcedLine(text)) return true;
  const raw = normalizeInterviewTypography(text ?? '');
  const t = raw.replace(/\u2019/g, "'").replace(/\s+/g, ' ').trim().toLowerCase();
  if (t.length < 24) return false;
  if (!/\bdaniel\b/.test(t) || !/\bsophie\b/.test(t)) return false;

  const relationshipBroken =
    t.includes("this relationship isn't working") ||
    t.includes('this relationship is not working') ||
    t.includes("relationship isn't working") ||
    t.includes('relationship is not working') ||
    /\b(isn'?t|is not)\s+working\b/.test(t) ||
    (/\brelationship\b/.test(t) && /\bnot working\b/.test(t));

  if (!relationshipBroken) return false;

  const canonical =
    t.includes('at what point would you say daniel or sophie should decide this relationship') ||
    t.includes("at what point would you say daniel or sophie should decide this relationship isn't working");

  const pointAsk = /\b(at what point|what point)\b/.test(t);
  const framedAsk =
    pointAsk &&
    (/\bwould you say\b/.test(t) || /\bdo you decide\b/.test(t)) &&
    (/\bshould decide\b/.test(t) || /\brelationship\b/.test(t));
  /** e.g. "At what point would you decide Sophie and Daniel's relationship isn't working?" — models omit "say" / "should". */
  const wouldYouDecideBothNamed =
    pointAsk &&
    /\bwould you decide\b/.test(t) &&
    /\bdaniel\b/.test(t) &&
    /\bsophie\b/.test(t) &&
    relationshipBroken;

  return Boolean(canonical || framedAsk || wouldYouDecideBothNamed);
}

/** User answer(s) to the Scenario C commitment-threshold follow-up only (Daniel/Sophie), for sole-source scoring. */
export function extractScenario3CommitmentThresholdUserAnswerAfterPrompt(
  msgs: readonly ScenarioCorpusMessageSlice[],
): string {
  const scoped = sliceTranscriptForScenario3Scoring(msgs);
  let threshIdx = -1;
  for (let i = 0; i < scoped.length; i++) {
    const m = scoped[i];
    if (
      m.role === 'assistant' &&
      m.scenarioNumber === 3 &&
      typeof m.content === 'string' &&
      looksLikeScenarioCCommitmentThresholdAssistantPrompt(m.content)
    ) {
      threshIdx = i;
      break;
    }
  }
  if (threshIdx < 0) return '';
  const parts: string[] = [];
  for (let i = threshIdx + 1; i < scoped.length; i++) {
    const m = scoped[i];
    if (m.role === 'assistant') break;
    if (m.role === 'user' && m.scenarioNumber === 3) {
      const t = String(m.content ?? '').trim();
      if (t) parts.push(t);
    }
  }
  return parts.join(' ');
}

export function isLikelyMisplacedPersonalNarrativeForScenarioCThreshold(text: string): boolean {
  /**
   * Answers that already express commitment / exit timing (e.g. "third time… end the relationship")
   * often omit "Daniel/Sophie/their" — must not be treated as misplaced personal Moment-4 narrative
   * (session_logs: SC3_MISPLACED_THRESHOLD_SEQUENCE after threshold probe + whisper "end the relationship").
   */
  if (hasScenarioCCommitmentThresholdInUserAnswer(text)) return false;
  const t = text.toLowerCase();
  /**
   * Third-person about the vignette couple often uses "their relationship" / "them" — not `\bthey\b`.
   * Misclassifying that as a personal Moment-4 narrative re-fires the redirect + threshold TTS loop (see SC3_MISPLACED_THRESHOLD_SEQUENCE).
   */
  const referencesScenarioCharacters =
    /\b(daniel|sophie|they|their|them)\b/.test(t) &&
    /\b(should|would|relationship|not working|walk away|end|ending|fight|fighting|couple|together)\b/.test(t);
  if (referencesScenarioCharacters) return false;
  const hasPersonalNarrativeSignals =
    /\b(i|my|me|we|our|us)\b/.test(t) &&
    /\b(ex|relationship|partner|wife|husband|boyfriend|girlfriend|friend|family|when i|i had|i was|i felt|i decided|i left|i stayed)\b/.test(
      t
    );
  return hasPersonalNarrativeSignals;
}
