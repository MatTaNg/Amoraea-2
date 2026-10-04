import { INABILITY_RES, patternScore, wordCount } from './metaCommentPatternScoring';
import type { InabilityOverrideDetail } from '@features/aria/metaCommentClassificationTypes';

const SCENARIO_CHARACTER_RE = /\b(James|Sarah|Emma|Ryan|Sophie|Daniel)\b/i;
const SCENARIO_CONTENT_RE =
  /\b(James|Sarah|Emma|Ryan|Sophie|Daniel|appreciation|appreciate|genuine|joy|excited|excitement|emotion|feel|felt|crying|tears|dinner|family|call|repair|apologize|conversation|avoid|conflict|argument|resolved?)\b/i;
const CAUSAL_OR_EXPLANATORY_RE = /\b(because|since|which means|that'?s why|so that)\b/i;
const SUGGESTION_RE =
  /\b(should|could|would|need(?:s|ed)? to|has to|have to|might|maybe|probably)\b.{0,120}\b(do|say|ask|listen|acknowledge|repair|apologize|show|share|give|make|try|tell)\b/i;
const ACTION_OR_PATTERN_RE =
  /\b(did|didn'?t|does|doesn'?t|show(?:ed|s)?|ask(?:ed|s)?|listen(?:ed|s)?|acknowledg(?:e|ed|es)|repair(?:ed|s)?|apologi(?:ze|zed|zes)|avoid(?:ed|s)?|came back|went|left|said|told|prioritiz(?:e|ed|es)|put|made|gave|shared|respond(?:ed|s)?|celebrat(?:e|ed|es)|redirect(?:ed|s)?)\b/i;

function splitClauses(text: string): string[] {
  return text
    .split(/[.!?;,]|\s+\b(?:but|and|because|since|so)\b\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Bare "I'm not sure" is inability. Any words after that hedge are an answer. */
function notSureHedgeIsFollowedByMoreContent(text: string): boolean {
  const t = text.trim();
  if (/^\s*i'?m\s+not\s+(?:quite\s+)?sure\s*[.!?…]*\s*$/i.test(t)) return false;
  return /\bi'?m\s+not\s+(?:quite\s+)?sure\b/i.test(t);
}

export function getInabilitySubstantiveOverrideDetail(text: string): InabilityOverrideDetail | null {
  const t = text.trim();
  if (!t) return null;
  const wc = wordCount(t);
  if (notSureHedgeIsFollowedByMoreContent(t)) {
    const hasCharacterName = SCENARIO_CHARACTER_RE.test(t);
    return {
      inability_override_fired: true,
      override_trigger: wc >= 40 && hasCharacterName ? 'word_count_fallback' : 'behavioral_observation_detected',
      full_response_word_count: wc,
    };
  }
  const inabilityScore = patternScore(t, INABILITY_RES);
  const hasExplicitInability =
    inabilityScore > 0 ||
    /\b(honestly\s+)?(i\s+)?(have\s+)?no\s+idea\s+what\s+to\s+say\b/i.test(t) ||
    /\bdrawing\s+a\s+blank\b/i.test(t) ||
    /\bnothing\s+comes\s+to\s+mind\b/i.test(t);
  if (!hasExplicitInability) return null;

  const hasCharacterName = SCENARIO_CHARACTER_RE.test(t);
  if (wc >= 40 && hasCharacterName) {
    return {
      inability_override_fired: true,
      override_trigger: 'word_count_fallback',
      full_response_word_count: wc,
    };
  }

  if (hasCharacterName && wc >= 8) {
    return {
      inability_override_fired: true,
      override_trigger: 'character_name_detected',
      full_response_word_count: wc,
    };
  }

  if (CAUSAL_OR_EXPLANATORY_RE.test(t) || SUGGESTION_RE.test(t)) {
    return {
      inability_override_fired: true,
      override_trigger: 'behavioral_observation_detected',
      full_response_word_count: wc,
    };
  }

  if (wc >= 6 && ACTION_OR_PATTERN_RE.test(t) && SCENARIO_CONTENT_RE.test(t)) {
    return {
      inability_override_fired: true,
      override_trigger: 'behavioral_observation_detected',
      full_response_word_count: wc,
    };
  }

  const substantiveClause = splitClauses(t).some((clause) => {
    const clauseWc = wordCount(clause);
    return (
      (clauseWc >= 6 && ACTION_OR_PATTERN_RE.test(clause)) ||
      (clauseWc >= 8 && SCENARIO_CONTENT_RE.test(clause))
    );
  });
  if (substantiveClause) {
    return {
      inability_override_fired: true,
      override_trigger: 'behavioral_observation_detected',
      full_response_word_count: wc,
    };
  }

  return null;
}
