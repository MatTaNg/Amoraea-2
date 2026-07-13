/**
 * Client-side relational-orientation distillation for boundary reflections when the model
 * does not supply its own. Heuristic only — prompts carry the authoritative rules.
 *
 * Reflections name how the user moves through relational difficulty — not answer structure
 * (concrete vs vague, behavioral vs emotional). Structure is for scoring; orientation is for the user.
 */

import type { MessageWithScenario } from './interviewScenarioScoringSlice';
import {
  rejectUnanchoredPersonalMomentReflection,
  reflectionIsGroundedInUserAnswer,
  userAnswerHasReflectionAnchor,
  userTurnDescribesRestorativeTurnTowardPartner,
} from './reflectionTranscriptGrounding';

export const APPROVED_REFLECTION_OPENERS = [
  'What I got was that',
  'What I heard was that',
  'What came through was that',
  'What landed for me was that',
] as const;

/** Second-person observation verbs for scenario boundary reflections. */
export const SCENARIO_CONCLUSION_VERBS = [
  'You focused on',
  'You named',
  'You framed',
  'You pointed to',
  'You highlighted',
] as const;

export const MIN_SCENARIO_CORPUS_WORDS_FOR_REFLECTION = 20;
/** Single-turn answers at or above this length can yield a boundary reflection below the full-corpus minimum. */
export const MIN_SUBSTANTIVE_TURN_WORDS_FOR_REFLECTION = 8;
/** Minimum grounding score for a scenario boundary conclusion to ship (see scoreReflectionGroundingInUserAnswers). */
export const MIN_BOUNDARY_REFLECTION_GROUNDING_SCORE = 2;

/** Reflection cores that describe answer form/quality rather than relational orientation. */
const ANSWER_STRUCTURE_REFLECTION_CORES = [
  'concrete structure in place',
  'concrete change you',
  'concrete next step',
  'good intentions',
  'lead with accountability',
  'address the behavior directly',
  'clearer communication is where you',
  'turn that into a concrete',
] as const;

function normalizeAnswer(text: string): string {
  return text.replace(/^["'“”]+|["'“”]+$/g, '').replace(/\s+/g, ' ').trim();
}

/** Best-effort label for a person the user disclosed in M4/M5 (never invent names). */
function extractDisclosedPersonLabel(l: string): string | null {
  const appositive = l.match(
    /\b(?:woman|man|friend|coworker|colleague|roommate),\s+([a-z]{2,})\b/i,
  );
  if (appositive?.[1] && !/^(who|that|when|because|last|year)$/i.test(appositive[1])) {
    return appositive[1].charAt(0).toUpperCase() + appositive[1].slice(1);
  }
  if (/\bmy ex(?:-partner)?\b/i.test(l)) return 'your ex';
  if (/\bmy (?:mom|mother)\b/i.test(l)) return 'your mom';
  if (/\bmy (?:dad|father)\b/i.test(l)) return 'your dad';
  if (/\bmy best friend\b/i.test(l)) return 'your best friend';
  if (/\bmy close friend\b/i.test(l)) return 'your close friend';
  if (/\bmy friend\b/i.test(l)) return 'your friend';
  if (/\bmy (?:roommate|partner|wife|husband|boyfriend|girlfriend|spouse)\b/i.test(l)) {
    return l.match(/\bmy (roommate|partner|wife|husband|boyfriend|girlfriend|spouse)\b/i)?.[1] ?? 'them';
  }
  return null;
}

function distillPersonalMomentObservationFromAnswer(l: string): string | null {
  const person = extractDisclosedPersonLabel(l);

  if (person && /\b(grudge|falling out|fell out|resentment|hard time|got under your skin)\b/i.test(l)) {
    if (/\bmoney\b/i.test(l)) {
      return `you named ${person} and how the falling-out over money still sits with you`;
    }
    if (/\bnever apologiz|didn'?t apologiz|no apology\b/i.test(l)) {
      return `you named ${person} and how the lack of apology still carries weight for you`;
    }
    return `you named ${person} and what happened between you in that falling-out`;
  }

  if (
    person &&
    /\b(conflict|fight|argument|tension|rupture)\b/i.test(l) &&
    /\b(pull(?:ing|ed)? away|check(?:ed)? out|not show(?:ing|ed)? up|called me out|owned my part|my part)\b/i.test(l)
  ) {
    if (/\bpull(?:ing|ed)? away|check(?:ed)? out|not show(?:ing|ed)? up\b/i.test(l)) {
      return `you named ${person} and pulling away before you explained your side`;
    }
    if (/\bcalled me out\b/i.test(l)) {
      return `you named how ${person} called you out on what was missing`;
    }
    if (/\bowned my part|my part\b/i.test(l)) {
      return `you named ${person} and owning your part in what broke down`;
    }
  }

  if (
    person &&
    /\b(mom|mother|parent|marriage|married)\b/i.test(l) &&
    /\b(realized|explained|context|rationale)\b/i.test(l)
  ) {
    return `you named ${person} and filling in the context they were missing before pushing forward`;
  }

  return null;
}

function capitalizePersonalMomentObservation(core: string): string {
  const body = core.trim();
  if (/^you /i.test(body)) {
    return `You ${body.slice(4)}`;
  }
  return body.charAt(0).toUpperCase() + body.slice(1);
}

/** Full observation sentence for M4/M5 handoffs and closings (no vignette-theme templates). */
export function buildPersonalMomentObservationSentence(userTurn: string): string {
  const t = normalizeAnswer(userTurn);
  if (!t) return '';
  if (!userAnswerHasReflectionAnchor(t)) return '';
  const core = distillPersonalMomentObservationFromAnswer(t.toLowerCase());
  if (!core) return '';
  const sentence = capitalizePersonalMomentObservation(core);
  const withPeriod = sentence.endsWith('.') ? sentence : `${sentence}.`;
  return rejectUnanchoredPersonalMomentReflection(withPeriod, t);
}

/** True when reflection would mostly reuse the user's surface wording. */
export function reflectionLooksLikeSurfaceParaphrase(userTurn: string, reflection: string): boolean {
  const u = normalizeAnswer(userTurn).toLowerCase();
  const r = reflection.toLowerCase();
  if (!u || !r) return false;
  const words = u
    .split(/[^a-z0-9']+/i)
    .filter((w) => w.length > 4)
    .slice(0, 12);
  if (words.length === 0) return false;
  const hits = words.filter((w) => r.includes(w));
  return hits.length >= Math.min(3, Math.ceil(words.length * 0.45));
}

/**
 * True when the reflection body is largely a copied clause from the user's answer
 * (e.g. "You focused on [rest of user's sentence]"). Distinct from thematic overlap
 * on domain words like voicemail/calls/dates in a legitimate synthesis.
 */
export function reflectionCoreLooksLikeCopiedUserClause(
  userTurn: string,
  reflection: string,
): boolean {
  const u = normalizeAnswer(userTurn).toLowerCase();
  const core = (reflection ?? '')
    .replace(/^you read it as\s+/i, '')
    .replace(
      /^You (?:focused on|named|framed|pointed to|highlighted|linked|read|were|saw|recognized)\s*/i,
      '',
    )
    .replace(/\.\s*$/, '')
    .toLowerCase()
    .trim();
  if (!core || core.length < 18) return false;
  if (u.includes(core)) return true;
  const deYou = core.replace(/^you'?d\s+/, '').replace(/^you\s+/, '').replace(/^that\s+/, '');
  if (deYou.length >= 18 && u.includes(deYou)) return true;
  return false;
}

/** True when the reflection is a near-verbatim echo of the user's inference clause ("You read it as …"). */
export function reflectionLooksLikeVerbatimInferenceEcho(
  userTurn: string,
  reflection: string,
): boolean {
  const r = (reflection ?? '').trim();
  if (!/^you read it as\b/i.test(r)) return false;
  return reflectionCoreLooksLikeCopiedUserClause(userTurn, r);
}

/** True when the reflection describes how the answer was constructed, not relational orientation. */
export function reflectionLooksLikeAnswerStructure(reflectionCore: string): boolean {
  const core = reflectionCore.toLowerCase().replace(/\s+/g, ' ').trim();
  return ANSWER_STRUCTURE_REFLECTION_CORES.some((phrase) => core.includes(phrase));
}

/** Byte-stable model templates observed in the wild — not derived from any user corpus. */
export const KNOWN_CANNED_SCENARIO_BOUNDARY_REFLECTIONS = [
  /you focused on putting concrete limits on calls during dates so the same interruption does not repeat/i,
  /you focused on james listening to sarah instead of jumping to logistics when she was upset/i,
  /you pointed to sophie creating safety so daniel would not feel the need to leave/i,
] as const;

/** True for legacy vignette-theme boundary lines the model memorized per scenario ID. */
export function reflectionLooksLikeKnownCannedBoundaryTemplate(reflection: string): boolean {
  const t = (reflection ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  return KNOWN_CANNED_SCENARIO_BOUNDARY_REFLECTIONS.some((re) => re.test(t));
}

/** Generic scenario-level insights that must not appear unless the user's words support them. */
const SCENARIO_GENERIC_REFLECTION_CORES = [
  'care shows up in how someone wants to be received',
  'staying in the room is the baseline for resolution',
  'how something lands emotionally is what defines whether it crosses a line',
  'trust is the floor anything else has to stand on',
  'presence is how care actually registers',
  'holding on is about what the breach meant',
  'tension between staying connected and maintaining boundaries',
  'staying connected and maintaining boundaries with family',
  'importance of communication in relationships',
  'communication is important',
  'relationships require',
  'it is important to',
  "james's focus on logistics instead of emotions",
  'recognized the need for him to be more present',
  "daniel's genuine confusion about how to communicate",
  'felt dismissed by the pattern of him leaving',
  'emotional regulation',
  'experience of abandonment',
  'in that pattern',
  "daniel's need for",
] as const;

/**
 * True when the reflection is a thematic summary of the vignette that any completer could receive.
 * Used to omit or replace model/client text that is not built from this user's words.
 */
export function reflectionLooksLikeGenericScenarioTheme(reflection: string): boolean {
  const t = (reflection ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!t || t.length < 20) return true;
  if (reflectionLooksLikeKnownCannedBoundaryTemplate(reflection)) return true;
  const hasGenericThemeCore = SCENARIO_GENERIC_REFLECTION_CORES.some((g) => t.includes(g));
  /** Client/model boundary conclusions are synthesis unless they still carry generic theme cores. */
  if (
    textHasScenarioBoundaryConclusion(reflection) &&
    !hasGenericThemeCore &&
    !/\btension between\b/.test(t)
  ) {
    return false;
  }
  if (hasGenericThemeCore) return true;
  if (/\byou (?:saw|recognized|picked up on|read)\b/.test(t)) return true;
  if (/\b(?:the pattern|the dynamic|relational dynamic|repair orientation)\b/.test(t)) return true;
  if (
    /\btension between\b/.test(t) &&
    /\b(staying connected|maintaining boundaries|family|partnership)\b/.test(t) &&
    !/\b(you (?:said|named|focused|framed|pointed|highlighted))\b/.test(t)
  ) {
    return true;
  }
  if (
    /\b(always put.? family first|family (over|before) (?:the )?relationship|family vs\.? partnership)\b/.test(
      t,
    ) &&
    !/\b(ryan|emma|shared time|voicemail|call|dinner|mom|mother)\b/.test(t)
  ) {
    return true;
  }
  return false;
}

/**
 * True when the reflection core is a known scenario-level insight with no anchor in the user's answer.
 */
export function reflectionLooksScenarioGenerated(userTurn: string, reflectionCore: string): boolean {
  const core = reflectionCore.toLowerCase().replace(/\s+/g, ' ').trim();
  const u = normalizeAnswer(userTurn).toLowerCase();
  if (reflectionLooksLikeGenericScenarioTheme(core)) {
    /** Theme phrasing that still cites a concrete user cue can pass. */
    if (
      /\b(shared time|voicemail|logistics|celebrat|appreciat|left hanging|resign|stopped expecting)\b/.test(
        core,
      ) &&
      /\b(shared time|voicemail|logistic|celebrat|appreciat|left hanging|resign|stopped expecting|call during|mom)\b/i.test(
        u,
      )
    ) {
      return false;
    }
    return true;
  }
  if (!SCENARIO_GENERIC_REFLECTION_CORES.some((g) => core.includes(g))) return false;

  if (core.includes('care shows up in how someone wants to be received')) {
    return !/\b(ask (her|him|them)|how (she|he|they)('d| would) like|celebrat.*how|define what support)\b/i.test(u);
  }
  if (core.includes('staying in the room is the baseline')) {
    return !/\b(stay in the room|stay and talk|not (just )?walk away|communicat)\b/i.test(u);
  }
  if (core.includes('emotional moment needed to land before anything practical')) {
    return !/\b(feel|feeling|emotional|listen|instead of|before|logistic|practical|jump)\b/i.test(u);
  }
  return true;
}

/**
 * Prefer reflections that mention concrete cues that also appear in the user's corpus.
 * Used when picking among multiple candidate conclusions from a multi-turn scenario.
 */
export function scoreReflectionGroundingInUserAnswers(userCorpus: string, reflection: string): number {
  const u = normalizeAnswer(userCorpus).toLowerCase();
  const r = (reflection ?? '').toLowerCase();
  if (!u || !r) return 0;
  let score = 0;
  const cues: Array<[RegExp, number]> = [
    [/\blogistic/, 3],
    [/\bappreciat/, 3],
    [/\bpresent\b/, 2],
    [/\bcelebrat/, 3],
    [/\bshared time\b/, 4],
    [/\bvoicemail/, 4],
    [/\b(call|calls) during\b/, 3],
    [/\bmom|mother\b/, 2],
    [/\bresign|stopped expect/, 3],
    [/\bcontempt|dismiss|emotional weight/, 3],
    [/\bleft hanging|went silent|withdrawal/, 3],
    [/\bconfus/, 2],
    [/\bon her terms|when she.?s ready|bring(?:s)? it up/, 3],
    [/\bcompatible|fit is real/, 2],
    [/\bguardrail/, 2],
  ];
  for (const [re, w] of cues) {
    if (re.test(r) && re.test(u)) score += w;
  }
  if (reflectionLooksLikeGenericScenarioTheme(reflection)) score -= 10;
  return score;
}

const BOUNDARY_REFLECTION_CONTENT_STOPWORDS = new Set([
  'about',
  'after',
  'before',
  'being',
  'could',
  'daniel',
  'during',
  'emma',
  'focused',
  'framed',
  'highlighted',
  'instead',
  'james',
  'named',
  'pointed',
  'really',
  'ryan',
  'sarah',
  'should',
  'sophie',
  'something',
  'their',
  'there',
  'these',
  'think',
  'those',
  'through',
  'would',
  'your',
]);

function countUserContentWordsInReflection(userTurn: string, reflection: string): number {
  const r = (reflection ?? '').toLowerCase();
  const words = normalizeAnswer(userTurn)
    .toLowerCase()
    .split(/[^a-z0-9']+/i)
    .filter((w) => w.length >= 5 && !BOUNDARY_REFLECTION_CONTENT_STOPWORDS.has(w));
  if (words.length === 0) return 0;
  return words.filter((w) => r.includes(w)).length;
}

/** Reject canned vignette templates and shallow paraphrases before boundary wrap-ups ship. */
export function boundaryConclusionPassesQualityBar(userTurn: string, conclusion: string): boolean {
  const trimmed = (conclusion ?? '').trim();
  if (!trimmed) return false;
  if (reflectionLooksLikeVerbatimInferenceEcho(userTurn, trimmed)) return false;
  if (reflectionLooksLikeKnownCannedBoundaryTemplate(trimmed)) return false;
  if (reflectionLooksLikeAnswerStructure(trimmed)) return false;
  const core = trimmed.replace(
    /^You (?:focused on|named|framed|pointed to|highlighted|linked|read|were)\s*/i,
    '',
  );
  if (reflectionIsGroundedInUserAnswer(trimmed, userTurn)) {
    if (reflectionLooksLikeGenericScenarioTheme(trimmed)) return false;
    if (
      !textHasScenarioBoundaryConclusion(trimmed) &&
      reflectionLooksScenarioGenerated(userTurn, core)
    ) {
      return false;
    }
    if (reflectionCoreLooksLikeCopiedUserClause(userTurn, trimmed)) return false;
    return true;
  }
  if (reflectionLooksLikeSurfaceParaphrase(userTurn, trimmed)) return false;
  if (reflectionCoreLooksLikeCopiedUserClause(userTurn, trimmed)) return false;
  if (reflectionLooksLikeGenericScenarioTheme(trimmed)) return false;
  if (reflectionLooksScenarioGenerated(userTurn, core)) return false;
  const groundingScore = scoreReflectionGroundingInUserAnswers(userTurn, trimmed);
  if (groundingScore >= MIN_BOUNDARY_REFLECTION_GROUNDING_SCORE) return true;
  return countUserContentWordsInReflection(userTurn, trimmed) >= 2;
}

function wrapRelationalPatternAsScenarioConclusion(userTurn: string, core: string): string {
  const c = core.trim().replace(/\.\s*$/, '');
  if (!c) return '';
  let conclusion = '';
  if (/^you'?d /i.test(c)) {
    conclusion = `You focused on ${c.replace(/^you'?d /i, '')}`;
  } else if (/^you'?re /i.test(c)) {
    conclusion = `You named that ${c.replace(/^you'?re /i, '')}`;
  } else if (/^when /i.test(c)) {
    const tail = c.charAt(0).toLowerCase() + c.slice(1);
    conclusion = `You framed ${tail}`;
  } else if (/^repair, for you/i.test(c)) {
    const tail = c.replace(/^repair, for you, starts (?:with |by )?/i, '');
    conclusion = `You focused on how repair, for you, starts ${tail}`;
  } else if (/^you /i.test(c)) {
    conclusion = `You ${c.slice(4)}`;
  } else {
    conclusion = `You pointed to ${c.charAt(0).toLowerCase()}${c.slice(1)}`;
  }
  return boundaryConclusionPassesQualityBar(userTurn, conclusion) ? conclusion : '';
}

export function extractApprovedReflectionOpener(sentence: string): string | null {
  const t = sentence.trim();
  for (const verb of SCENARIO_CONCLUSION_VERBS) {
    if (t.toLowerCase().startsWith(verb.toLowerCase())) return verb;
  }
  for (const opener of APPROVED_REFLECTION_OPENERS) {
    if (t.toLowerCase().startsWith(opener.toLowerCase())) return opener;
  }
  return null;
}

/** True when text contains a scenario boundary conclusion (client- or model-generated). */
export function textHasScenarioBoundaryConclusion(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  if (extractApprovedReflectionOpener(t)) return true;
  if (/\bwhat (?:i (?:heard|got)|came through|landed for me) was\b/i.test(t)) return true;
  if (/\b(?:you (?:focused on|named|framed|pointed to|highlighted|saw|recognized|picked up on|read))\b/i.test(t)) return true;
  return false;
}

export function chooseApprovedReflectionOpener(recentReflectionSentences: string[]): string {
  const recent = new Set(
    recentReflectionSentences
      .map((s) => extractApprovedReflectionOpener(s))
      .filter((x): x is string => !!x),
  );
  const pool = APPROVED_REFLECTION_OPENERS.filter((o) => !recent.has(o));
  const pick = pool.length > 0 ? pool : [...APPROVED_REFLECTION_OPENERS];
  return pick[Math.floor(Math.random() * pick.length)]!;
}

export function recentReflectionSentencesFromAssistant(
  messages: readonly MessageWithScenario[],
): string[] {
  return messages
    .filter((m) => m.role === 'assistant')
    .slice(-6)
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .flatMap((c) => c.split(/(?<=[.!?])\s+/))
    .filter((s) => extractApprovedReflectionOpener(s));
}

function partnerPronoun(l: string): 'her' | 'him' | 'them' {
  if (/\b(sarah|emma|she|her)\b/.test(l)) return 'her';
  if (/\b(ryan|james|daniel|he|him)\b/.test(l)) return 'him';
  return 'them';
}

function experiencePhrase(them: 'her' | 'him' | 'them'): string {
  if (them === 'her') return 'her experience';
  if (them === 'him') return 'his experience';
  return 'their experience';
}

function userTurnMentionsPartnerExperience(l: string): boolean {
  return /\b(feel(?:ing)?|how (she|he|they)('re| is| was| felt)|ask (her|him|them)|understand (how |what )?(she|he|they)|what (she|he|they) needed|listen(?:ed|ing)?|hear (her|him|them) out)\b/i.test(
    l,
  );
}

function userTurnIsPreventiveRepair(l: string): boolean {
  if (
    /\b(voicemail|won't take calls|calls go to|during dates|commit to not)\b/i.test(l) &&
    /\b(voicemail|calls?|dates?|commit)\b/i.test(l)
  ) {
    return true;
  }
  if (/\bcommit\b/i.test(l) && /\b(boundar\w*|voicemail|dates?|calls?)\b/i.test(l)) {
    return true;
  }
  if (
    /\bmake sure (it |they |he |she )?doesn'?t happen\b/i.test(l) &&
    /\b(voicemail|calls?|dates?|boundar\w*|commit)\b/i.test(l)
  ) {
    return true;
  }
  return false;
}

function userTurnMentionsExplicitCallLimitsDuringDates(l: string): boolean {
  if (/\bvoicemail\b/i.test(l) && /\b(during dates?|on dates?|date nights?)\b/i.test(l)) {
    return true;
  }
  if (/\b(calls? (?:go|going) to voicemail|won'?t take calls|no calls during|calls during (?:dates?|dinner))\b/i.test(l)) {
    return true;
  }
  if (
    /\b(no |stop |don't |won'?t ).{0,24}calls?\b/i.test(l) &&
    /\b(during dates?|on dates?|date nights?)\b/i.test(l)
  ) {
    return true;
  }
  return false;
}

/**
 * Distill one relational-orientation core from a user answer (no opener).
 * Returns null when the turn is too thin for a grounded orientation.
 */
export function distillRelationalPatternFromAnswer(userTurn: string): string | null {
  const t = normalizeAnswer(userTurn);
  if (!t || t.split(/\s+/).filter(Boolean).length < 4) return null;
  const l = t.toLowerCase();

  const personalObservation = distillPersonalMomentObservationFromAnswer(l);
  if (personalObservation) return personalObservation;

  const them = partnerPronoun(l);
  const experience = experiencePhrase(them);

  /** Deference to partner's expressed needs — not assuming what support should look like. */
  if (
    /\b(ask (her|him|them|sarah|emma)|how (she|he|they)('d| would) like|how (she|he|they) want(s)? to be)\b/i.test(
      l,
    ) &&
    /\b(celebrat\w*|support|appreciat\w*|honor|receive)\b/i.test(l)
  ) {
    return `you'd let ${them} define what support looks like rather than assuming you know`;
  }

  /** Restorative repair — turn toward partner experience (apologize + feelings/understanding). */
  if (userTurnDescribesRestorativeTurnTowardPartner(l)) {
    return `repair, for you, starts by turning toward ${experience} before explaining yourself`;
  }

  /** Emotional acknowledgment before practical moves — user named that sequencing. */
  if (
    !userTurnDescribesRestorativeTurnTowardPartner(l) &&
    ((/\b(listened|listen(?:ing|s|ed)?|heard|hear (her|him|them) out)\b/i.test(l) &&
      /\b(instead of|before|not just|jump(ing)? to|logistic|practical|fix|solve|more)\b/i.test(l)) ||
      (/\b(feel|feeling|emotional|how (she|he|they) (?:'s| is |was |were )?(feeling|doing))\b/i.test(l) &&
        /\b(instead of|before|not just|logistic|practical|jump(ing)? to)\b/i.test(l)))
  ) {
    return "when someone's hurt, you'd reach for emotional acknowledgment before any practical fix";
  }

  /** Celebration / appreciation before logistics — user named that contrast. */
  if (
    /\b(happy for|appreciat\w*|celebrat\w*)\b/i.test(l) &&
    /\b(instead of|before|not just|jump(ing)? to)\b/i.test(l) &&
    /\b(logistic|practical|job|plan|fix)\b/i.test(l)
  ) {
    return "you'd let her celebration land before any practical or logistics moves";
  }

  /** Shared-time breach — user named family taking date time. */
  if (
    /\bshared time\b/i.test(l) &&
    /\b(family|mom|mother|taking|spend(?:ing)? (?:it )?with)\b/i.test(l)
  ) {
    return "you read her frustration as shared date time getting traded for family priorities";
  }

  /** Voicemail / call limits during dates — only when the user named calls/voicemail explicitly. */
  if (userTurnMentionsExplicitCallLimitsDuringDates(l)) {
    if (/\b(mom|mother|family)\b/i.test(l)) {
      return "you'd draw structural limits with family calls during date time so the interruption can't repeat";
    }
    if (/\bvoicemail\b/i.test(l) || /\bcalls? go to\b/i.test(l)) {
      return "you'd guard date time with structural limits on calls, not just a one-time promise";
    }
    if (/\b(calls? during|no calls during)\b/i.test(l)) {
      return "you'd protect date time from phone calls rather than hoping it won't happen again";
    }
  }

  /** Ownership + guardrails — apologize and structural limits together. */
  if (/\b(apolog\w*|sorry)\b/i.test(l) && /\b(boundar\w*|limit|line|voicemail|calls? during)\b/i.test(l)) {
    return 'repair, for you, means owning your part and putting guardrails in place so it can hold';
  }

  /** Preventive repair — stop recurrence before addressing past hurt. */
  if (userTurnIsPreventiveRepair(l) && !userTurnMentionsPartnerExperience(l)) {
    return "repair, for you, starts with making sure it doesn't happen again";
  }

  /** Boundaries without apology — guard the relationship. */
  if (
    /\b(boundar\w*|limit|line|space|voicemail)\b/i.test(l) &&
    /\b(i (would|will|'d)|if i were|(ryan|james|daniel|emma|sarah|he|she|they) should|set|put|tell|commit)\b/i.test(l)
  ) {
    return "repair, for you, starts with drawing a line so the same rupture can't repeat";
  }

  /** Unclear or unspoken expectations named as the core issue. */
  if (/\b(unclear|unspoken|vague|mixed|clearer) expect/i.test(l)) {
    if (/\b(team|together)\b/i.test(l) && /\b(side comment|talking behind|gossip|sniping)\b/i.test(l)) {
      return 'you named unclear expectations and pointed toward teamwork instead of side comments';
    }
    if (/\b(teamwork|together|direct(?:ly)?)\b/i.test(l)) {
      return 'you named unclear expectations and pointed toward working together more directly';
    }
    return 'you named unclear expectations as the pattern underneath the friction';
  }

  /** Teamwork vs talking around each other — synthesize the contrast, not the user's clause. */
  if (
    /\b(teamwork|work(?:ing)? together|as a team|direct(?:ly)? with (?:him|her|them)|as a couple)\b/i.test(l) &&
    /\b(side comment|snide comment|talking behind|behind (?:his|her|their) back|gossip|sniping|talking about (?:him|her|them) instead|reaction instead of)\b/i.test(
      l,
    )
  ) {
    return 'you pointed toward working together directly instead of talking around each other';
  }

  /** Unclear expectations via what's-okay framing + snide reactions vs teamwork. */
  if (
    (/\b(what'?s okay|what is acceptable|communicat\w* what|agreement on|not communication)\b/i.test(l) ||
      /\bpainful pattern\b/i.test(l)) &&
    (/\b(snide comment|side comment|reaction instead of|instead of just being mad)\b/i.test(l) ||
      /\b(team|couple|working through|as a team)\b/i.test(l))
  ) {
    return 'you named unclear expectations and pointed toward teamwork instead of side comments';
  }

  /** Celebration mismatch — James assumed presence/questions counted as celebrating. */
  if (
    /\b(different type of celebration|wanted something different|didn'?t express)\b/i.test(l) &&
    /\b(james|he|celebrat|appreciat|present moment|asking questions)\b/i.test(l)
  ) {
    return 'you focused on the mismatch between how James showed up and what Sarah actually needed celebrated';
  }

  /** Thin vague communication — orientation without inflating depth. */
  if (
    /\b(just )?(needs? to|should|have to|got to) communicat/i.test(l) &&
    !/\b(feel|listen|afraid|scared|fear|instead of|before)\b/i.test(l)
  ) {
    return 'when things stall between you, clearer communication is the move you reach for first';
  }

  /** Internal-state read — how they interpret withdrawal/silence. */
  if (/\b(scared|afraid|fear|frightened|overwhelmed|didn'?t know how|didn'?t know what)\b/i.test(l)) {
    if (/\b(avoid|withdraw|shut|silence|walk away|pull away)\b/i.test(l)) {
      return "you're reading his withdrawal as fear rather than indifference";
    }
    if (/\b(daniel|he|his)\b/i.test(l)) {
      return "you're reading his silence as fear rather than avoidance";
    }
  }

  /** Emma closing-line — attuned to emotional register, not just facts. */
  if (
    /\b(contempt|dismiss(?:ive|ed|es|ing)?|condescend(?:ing)?|harsh|cold|mean|sarcastic|passive[- ]aggressive|resigned|shutdown)\b/i.test(
      l,
    ) &&
    /\b(emma|she|line|comment|clear|that last|when she)\b/i.test(l)
  ) {
    return "you're attuned to the emotional weight in what's said, not just what happened";
  }

  /** Stay in the room vs walk away — orientation toward presence (not reassurance that someone need not leave). */
  if (
    /\b(communicat|talk it out|stay in the room|stay and talk)\b/i.test(l) &&
    userTurnMentionsLeavingAsOption(l)
  ) {
    return 'staying in the conversation matters to you more than walking away';
  }

  /** First-person repair plan with empathic move — restorative (strict: must describe the move). */
  if (
    /\b(if i were (ryan|james|daniel|emma|sarah)|as (ryan|james|daniel)|i (would|will|'d))\b/i.test(l) &&
    userTurnDescribesRestorativeTurnTowardPartner(l)
  ) {
    return `repair, for you, starts by turning toward ${experience} before explaining yourself`;
  }

  /** First-person repair plan with preventive mechanism. */
  if (
    /\b(if i were (ryan|james|daniel|emma|sarah)|as (ryan|james|daniel)|i (would|will|'d))\b/i.test(l) &&
    userTurnIsPreventiveRepair(l)
  ) {
    return "repair, for you, starts with making sure it doesn't happen again";
  }

  /** Passive deferral — wait for partner to reopen when they are ready. */
  if (
    (/\b(wait(?:ing)?|hold off|hold back)\b/i.test(l) &&
      /\b(when (she|he|they)|until (she|he|they)|brings? it up|bring(s)? it up|(?:she|he|they)('re| is)? ready|ready to)\b/i.test(
        l,
      )) ||
    /\blet (her|him|them) (?:bring|raise|start|come back to)\b/i.test(l)
  ) {
    return `you'd let ${them} choose when to reopen it rather than pushing it now`;
  }

  /** Compatibility / fit — step back rather than force a verdict (common Scenario C closing). */
  if (
    /\b(compatible|compatibility|figure out if)\b/i.test(l) &&
    /\b(time|space|need|spent)\b/i.test(l)
  ) {
    return "you'd give them room to see whether the fit is real before forcing a conclusion";
  }
  if (/\bthey (probably |might )?need\b/i.test(l) && /\b(time|space|figure out|compatible)\b/i.test(l)) {
    return "you'd step back and let the fit clarify rather than pushing a verdict";
  }

  /** Accountability / own part — prefer over withdrawal reads when both appear. */
  if (
    /\b(my part|my fault|i should have|i could have|what i did|take responsibility|own my|owned my|owned (?:that|it|my))\b/i.test(
      l,
    )
  ) {
    return 'you locate the turning point in your own part before focusing on theirs';
  }

  /** Personal M5 — stepped back from a triggered reaction once there was space. */
  if (
    /\b(triggered|blew up|overreacted|heated|in the moment|snapped)\b/i.test(l) &&
    /\b(space|cool(?:ed)? off|step(?:ped)? back|distance|time|room)\b/i.test(l) &&
    /\b(kindness|kind|not judgment|instead of judging|see (?:her|him|them)|judgment)\b/i.test(l)
  ) {
    return 'you were able to step back from that triggered moment and see their kindness once you had some space';
  }

  /** Scenario C — safety plus finishing conversations / regulation support (synthesis, not echo). */
  if (
    /\b(safe|doesn'?t have to leave|not going to attack|won'?t attack)\b/i.test(l) &&
    /\b(emotion regulation|finish(?:ing)? (?:the )?conversation|therapy|breathwork|step away|together|support each other)\b/i.test(
      l,
    ) &&
    /\b(sophie|daniel|he|she)\b/i.test(l)
  ) {
    return 'you linked reassuring safety with finishing hard conversations and building regulation support when shutdowns repeat';
  }

  /** Personal M5 conflict — own withdrawal or distance named as part of the rupture. */
  if (
    /\b(pull(?:ing|ed)? away|check(?:ed)? out|not show(?:ing|ed)? up|withdr(?:ew|aw|awal)|drift(?:ed)? apart|distance(?:d)?)\b/i.test(
      l,
    ) &&
    /\b(conflict|fight|argument|fell out|rupture|tension|friend|partner|boyfriend|girlfriend|spouse|roommate|she|he|they|her|him|them)\b/i.test(
      l,
    )
  ) {
    return "you're naming when your own withdrawal became part of what broke down";
  }

  /** Personal M5 conflict — the other person named what was missing. */
  if (
    /\b(called me out|confronted me|told me (straight|directly)|said (to me )?(straight|directly)|named what i)\b/i.test(
      l,
    ) &&
    /\b(conflict|fight|argument|fell out|rupture|tension|missing|wasn'?t show)\b/i.test(l)
  ) {
    return 'you heard how directly they named what was missing from you';
  }

  /** Personal M5 conflict — sat with discomfort before things shifted. */
  if (
    /\b(didn'?t speak|not speak|few days|couple of days|a week|uncomfortable|tense|radio silence|went silent)\b/i.test(
      l,
    ) &&
    /\b(conflict|fight|argument|fell out|rupture|tension)\b/i.test(l)
  ) {
    return 'you stayed with how uncomfortable the rupture felt before things shifted';
  }

  /** Personal M5 — recognized missing context on their side before pushing forward. */
  if (
    /\b(realized|understood|recognized|saw that)\b/i.test(l) &&
    /\b(lack(?:ed)?|didn'?t (?:have|know)|missing|without)\b/i.test(l) &&
    /\b(context|full picture|why i was|where i was coming from)\b/i.test(l) &&
    /\b(conflict|fight|argument|mom|mother|parent|dad|father|partner|she|he|they|friend)\b/i.test(l)
  ) {
    return "you'd fill in what they were missing before expecting them to read your intentions";
  }

  /** Personal M5 — explained rationale / side after conflict. */
  if (
    /\b(explain(?:ed|ing)?|walked (?:her|him|them) through|laid out|shared (?:my )?(?:side|rationale|reasoning))\b/i.test(
      l,
    ) &&
    /\b(conflict|fight|argument|mom|mother|parent|partner|she|he|they|resolved|resolution|rationale|side of things)\b/i.test(
      l,
    )
  ) {
    return 'you see repair as making your side legible before asking them to meet you';
  }

  /** Personal M5 conflict — repair through staying in the conversation. */
  if (
    /\b(talk(?:ed)? (?:it )?(?:out|through)|sat down (?:and|to)|worked (?:it )?out|made up|reconnect(?:ed)?|sorted (?:it )?out|apologi[sz](?:ed|ing)|explain(?:ed|ing))\b/i.test(
      l,
    ) &&
    /\b(conflict|fight|argument|fell out|rupture|resolved|resolution)\b/i.test(l)
  ) {
    return 'you see repair as staying with it until you can talk it through';
  }

  /**
   * Moment 4 commitment-threshold — tipping point named as looking forward → dreading
   * (common answer that never says "walk away" / "leave" explicitly).
   */
  if (
    /\b(looking forward|excited|eager)\b/i.test(l) &&
    /\b(dread(?:ing)?|don'?t want to see|avoid seeing|hate (?:seeing|meeting))\b/i.test(l)
  ) {
    return 'you can name the point where anticipation flips into dread';
  }
  if (
    /\b(the point|tipping point|turning point|when (?:it|that) happens|when i (?:know|decide|realize))\b/i.test(l) &&
    /\b(dread(?:ing)?|don'?t want|can'?t (?:keep|do)|enough|done|over)\b/i.test(l)
  ) {
    return 'you can name a real tipping point for yourself rather than staying vague about the line';
  }

  /** Commitment calibration without explicit walk-away wording. */
  if (
    /\b(red flags?|deal[- ]?breaker|warning signs?)\b/i.test(l) &&
    /\b(stay|leave|walk|work(?:ing)? (?:at|through)|relationship)\b/i.test(l)
  ) {
    return 'you weigh specific warning signs when deciding whether to stay or go';
  }
  if (
    /\b(keep working at it|work at it|throw(?:ing)? in the towel|call it quits|throw the towel)\b/i.test(l) ||
    (/\bintuitively\b/i.test(l) && /\b(keep working|walk away|leave|end it)\b/i.test(l))
  ) {
    return 'you named what keeps you working at it versus when you are done';
  }
  if (/\b(no path forward|nothing left to repair|can'?t be fixed)\b/i.test(l)) {
    return 'you named when there is no path forward left to work with';
  }

  /** Relationship exit / threshold language. */
  if (/\b(walk away|leave|end (it|the relationship)|give up on|cut (him|her|them) off|third strike)\b/i.test(l)) {
    return "you see leaving as on the table when the pattern doesn't shift";
  }

  /** Grudge / forgiveness — personal moment. */
  if (/\b(grudge|forgive|let go|move on|resentment|still (angry|mad|hurt))\b/i.test(l)) {
    return 'what they did still carries weight for you';
  }

  /** Family prioritization. */
  if (/\b(priorit|put (his |her )?(mom|mother|family) first|family (over|before)|family first)\b/i.test(l)) {
    return "you're naming who comes first when those loyalties collide";
  }

  /** Credible reassurance + follow-through after rupture. */
  if (
    /\b(assure|follow through|won'?t happen again|not happen again)\b/i.test(l) &&
    /\b(her|him|them|she|he|partner)\b/i.test(l)
  ) {
    return 'you focused on assuring her and following through so it does not happen again';
  }

  /** Thin practical fallback — orientation only. */
  if (/\b(i (would|will|'d)|he should|she should|they should|needs? to|should have)\b/i.test(l)) {
    if (/\bcommunicat/i.test(l) && !/\b(feel|listen|instead of|before)\b/i.test(l)) {
      return 'when things stall between you, clearer communication is the move you reach for first';
    }
  }

  return null;
}

function applyApprovedReflectionOpener(core: string, opener: string): string {
  let body = core.trim();
  body = body.replace(/^So for you,\s*/i, '');
  body = body.replace(/^So your instinct is to\s*/i, '');
  body = body.replace(/^So your instinct is that\s*/i, '');
  if (/^you /i.test(body)) return `${opener} ${body}`;
  if (/^the /i.test(body)) return `${opener} ${body}`;
  if (/^you're /i.test(body)) return `${opener} ${body}`;
  if (/^repair,/i.test(body)) return `${opener} ${body}`;
  if (/^when /i.test(body)) return `${opener} ${body}`;
  return `${opener} ${body.charAt(0).toLowerCase()}${body.slice(1)}`;
}

export type BuildPatternReflectionOptions = {
  recentAssistant?: readonly MessageWithScenario[];
  /** Deterministic opener pick for tests (0–3). */
  openerIndex?: number;
  /** When set, only conclusions grounded in this scenario's fiction may be returned. */
  scenario?: 1 | 2 | 3;
};

export function buildPatternReflectionSentence(
  userTurn: string,
  opts: BuildPatternReflectionOptions = {},
): string {
  if (!userAnswerHasReflectionAnchor(userTurn)) return '';
  const raw = distillRelationalPatternFromAnswer(userTurn);
  if (!raw) return '';
  if (reflectionLooksLikeAnswerStructure(raw)) return '';
  if (reflectionLooksScenarioGenerated(userTurn, raw)) return '';

  const recentSentences = opts.recentAssistant
    ? recentReflectionSentencesFromAssistant(opts.recentAssistant)
    : [];
  const opener =
    opts.openerIndex !== undefined
      ? APPROVED_REFLECTION_OPENERS[opts.openerIndex % APPROVED_REFLECTION_OPENERS.length]!
      : chooseApprovedReflectionOpener(recentSentences);

  const sentence = applyApprovedReflectionOpener(raw, opener);
  if (reflectionLooksLikeSurfaceParaphrase(userTurn, sentence)) return '';
  if (reflectionLooksLikeAnswerStructure(sentence)) return '';
  return rejectUnanchoredPersonalMomentReflection(sentence, userTurn);
}

function reflectionSentenceCore(sentence: string): string {
  const t = sentence.trim();
  for (const verb of SCENARIO_CONCLUSION_VERBS) {
    if (t.toLowerCase().startsWith(verb.toLowerCase())) {
      return t.slice(verb.length).trim().toLowerCase();
    }
  }
  for (const opener of APPROVED_REFLECTION_OPENERS) {
    if (t.toLowerCase().startsWith(opener.toLowerCase())) {
      return t.slice(opener.length).replace(/^\s*that\s+/i, '').trim().toLowerCase();
    }
  }
  return t.toLowerCase();
}

function boundaryReflectionsAreEquivalent(a: string, b: string): boolean {
  const ca = reflectionSentenceCore(a);
  const cb = reflectionSentenceCore(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  const shorter = ca.length <= cb.length ? ca : cb;
  const longer = ca.length <= cb.length ? cb : ca;
  return longer.includes(shorter.slice(0, Math.min(40, shorter.length)));
}

const WRONG_SCENARIO_CHARACTER_NAMES: Record<1 | 2 | 3, RegExp> = {
  1: /\b(daniel|sophie|james|sarah)\b/i,
  2: /\b(daniel|sophie|emma|ryan)\b/i,
  3: /\b(emma|ryan|james|sarah)\b/i,
};

/** Reject boundary reflections that name characters from a different scenario vignette. */
export function reflectionConclusionMatchesScenario(
  conclusion: string,
  scenario: 1 | 2 | 3,
): boolean {
  const low = (conclusion ?? '').toLowerCase();
  if (!low) return false;
  return !WRONG_SCENARIO_CHARACTER_NAMES[scenario].test(low);
}

function scenarioAllowsConclusionBlock(
  scenario: 1 | 2 | 3 | undefined,
  block: 's1' | 's2' | 's3',
): boolean {
  if (scenario === undefined) return true;
  if (block === 's1') return scenario === 1;
  if (block === 's2') return scenario === 2;
  return scenario === 3;
}

/** True when the user names leaving/walking away as an option — not reassurance that someone need not leave. */
function userTurnMentionsLeavingAsOption(text: string): boolean {
  const l = (text ?? '').toLowerCase();
  if (!/\b(walk away|leave|end (it|the relationship)|third strike)\b/i.test(l)) return false;
  if (
    /\b(doesn'?t|don'?t|won'?t|wouldn'?t|needn'?t|not going to|does not|do not)\s+(?:have to\s+)?leave\b/i.test(
      l,
    )
  ) {
    return false;
  }
  if (/\bfeel the need to leave\b/i.test(l) && /\b(safe|reassur|won'?t attack|doesn'?t have to)\b/i.test(l)) {
    return false;
  }
  return true;
}

/**
 * Distill one second-person observation from a user answer (scenario boundaries).
 * Names what the user said, named, or framed — not vignette psychology or construct labels.
 */
export function distillScenarioConclusionFromAnswer(
  userTurn: string,
  scenario?: 1 | 2 | 3,
): string | null {
  const t = normalizeAnswer(userTurn);
  if (!t || t.split(/\s+/).filter(Boolean).length < 4) return null;
  const l = t.toLowerCase();

  if (scenarioAllowsConclusionBlock(scenario, 's2')) {
    if (
      /\b(unclear|clearer|unspoken|vague) expect/i.test(l) &&
      /\b(team|together)\b/i.test(l) &&
      /\b(side comment|snide comment|talking behind|gossip|sniping)\b/i.test(l)
    ) {
      return 'You named unclear expectations and pointed toward teamwork instead of side comments';
    }

    if (
      (/\b(check in|check-in|how (?:she|sarah) wanted to celebrate|ask (?:her|sarah) how)\b/i.test(l) ||
        /\b(i'?m so sorry|didn'?t feel appreciated|thought that (?:that )?was a celebration)\b/i.test(l)) &&
      (/\b(celebrat|appreciat|accountab|mismatch)\b/i.test(l) ||
        /\b(didn'?t feel appreciated|plan together|what celebration)\b/i.test(l))
    ) {
      return 'You focused on how James could check in about what celebration looked like and took accountability for the mismatch';
    }

    if (
      /\b(different type of celebration|wanted something different|didn'?t express)\b/i.test(l) &&
      /\b(james|he|celebrat|appreciat|present moment|asking questions)\b/i.test(l)
    ) {
      return 'You focused on how James could check in about what celebration looked like and took accountability for the mismatch';
    }

    if (
      /\b(check in|check-in|celebrat)\b/i.test(l) &&
      /\b(accountab|mismatch|own(?:ed|ing)?)\b/i.test(l)
    ) {
      return 'You focused on how James could check in about what celebration looked like and took accountability for the mismatch';
    }

  /** Scenario B — James logistics vs emotional presence / celebration. */
    if (
      /\b(james|he)\b/i.test(l) &&
      /\b(listen|feeling|emotional|instead of|jump(ing)? to|present|happy for|mismatch)\b/i.test(l) &&
      /\b(logistic|practical|celebrat|appreciat)\b/i.test(l)
    ) {
      if (/\b(celebrat|appreciat|happy for)\b/i.test(l)) {
        return 'You focused on James appreciating her celebration instead of jumping straight to logistics';
      }
      return null;
    }

    /** Scenario B — Sarah defines how support should look. */
    if (
      /\b(ask (her|sarah)|how (she|sarah)('d| would) like|celebrat)\b/i.test(l) &&
      /\b(support|celebrat|appreciat|honor|receive|way she)\b/i.test(l)
    ) {
      return 'You focused on James asking how Sarah wanted to be celebrated rather than assuming';
    }
  }

  if (scenarioAllowsConclusionBlock(scenario, 's1')) {
    if (
      (/\b(snide comment|side comment|reaction instead of)\b/i.test(l) ||
        /\b(what'?s okay|what is acceptable|agreement on|not communication)\b/i.test(l)) &&
      (/\b(team|couple|conversation|together|working through)\b/i.test(l) ||
        /\b(painful pattern|acceptable during)\b/i.test(l))
    ) {
      return 'You named the pattern of unclear expectations and pointed toward teamwork instead of side comments';
    }

    /** Scenario A — credible follow-through / reassurance after rupture. */
    if (
      /\b(assure|follow through|won'?t happen again|not happen again|make sure)\b/i.test(l) &&
      /\b(her|him|them|emma|ryan|she|he|this|it)\b/i.test(l)
    ) {
      return 'You focused on assuring her and following through so it does not happen again';
    }

    /** Scenario A — Emma resignation beyond tonight's frustration. */
    if (
      /\b(emma|she)\b/i.test(l) &&
      /\b(resign|stop(ped)? expect|given up|doesn'?t expect|won'?t change|stopped expecting)\b/i.test(l)
    ) {
      return "You named Emma's resignation — that she'd stopped expecting things to change, not just tonight's frustration";
    }

    /** Scenario A — Emma contempt / emotional register. */
    if (
      /\b(emma|she)\b/i.test(l) &&
      /\b(contempt|dismiss|condescend|harsh|cold|sarcastic|passive[- ]aggressive|line|comment)\b/i.test(l)
    ) {
      return "You named the emotional weight in Emma's line, not just what happened tonight";
    }

    /** Scenario A — shared-time / family-priority pattern named by the user. */
    if (
      /\b(shared time|time they were supposed|taking (?:shared )?time|always (?:taking|spending)|put(?:s|ting)? (?:his |her )?family first)\b/i.test(
        l,
      ) &&
      /\b(family|mom|mother|emma|ryan)\b/i.test(l)
    ) {
      return 'You focused on Ryan taking shared time for family instead of time with Emma';
    }

    /** Preventive repair — guardrails before emotional processing (must name the mechanism). */
    if (userTurnIsPreventiveRepair(l)) {
      if (/\b(voicemail|calls? during|during dates)\b/i.test(l) && /\b(mom|mother|family)\b/i.test(l)) {
        return null;
      }
      return null;
    }

    /** Boundaries without full apology arc — only when user named a concrete mechanism. */
    if (
      /\b(boundar\w*|limit|line|voicemail|calls? during)\b/i.test(l) &&
      /\b(i (would|will|'d)|if i were|commit|set|proper)\b/i.test(l)
    ) {
      if (/\b(voicemail|calls? during|during dates)\b/i.test(l) && /\b(mom|mother|family|date)\b/i.test(l)) {
        return null;
      }
      if (/\b(mom|mother|family)\b/i.test(l) && /\b(boundar\w*|limit|interrupt)\b/i.test(l)) {
        return 'You focused on Ryan setting a real boundary with his mom so their dates stop getting interrupted';
      }
      return null;
    }
  }

  if (scenarioAllowsConclusionBlock(scenario, 's3') && /\b(daniel|sophie)\b/i.test(l)) {
    /** Scenario C — Daniel confused + Sophie dismissed (user-named, not construct labels). */
    if (
      /\bdaniel\b/i.test(l) &&
      /\b(confus|didn'?t know|at a loss|loss|how to (say|communicat|find words))\b/i.test(l) &&
      /\bsophie\b/i.test(l) &&
      /\b(dismiss\w*|unheard|left hanging|\bleft\b|leaving|silent|walk away|went silent)\b/i.test(l)
    ) {
      return 'You named Daniel not knowing what to say and how Sophie felt dismissed when he left';
    }

    /** Scenario C — Sophie dismissed / left hanging. */
    if (
      /\bsophie\b/i.test(l) &&
      /\b(dismiss\w*|unheard|left hanging|\bleft\b|leaving|silent|walk away|went silent)\b/i.test(l)
    ) {
      return 'You named how Sophie felt dismissed and left hanging when Daniel went silent or left';
    }

    /** Scenario C — honest sit-down repair. */
    if (
      /\b(sit down|honest conversation|talk it (out|through)|stay in the room)\b/i.test(l) &&
      /\b(repair|fix|resolve|repaired|conversation)\b/i.test(l)
    ) {
      return 'You framed repair around both of them staying in the room for an honest conversation';
    }

    /** Scenario C — fear/silence read. */
    if (
      /\b(scared|afraid|fear|frightened|overwhelmed)\b/i.test(l) &&
      /\bdaniel\b/i.test(l) &&
      /\b(silence|withdraw|avoid|pull away)\b/i.test(l)
    ) {
      return 'You named Daniel freezing up rather than indifference when he went silent';
    }

    /** Scenario C — Sophie reassures safety while also naming ongoing shutdown work. */
    if (
      /\b(safe|doesn'?t have to leave|not going to attack|won'?t attack|create(?:ing)? safety|reassur)\b/i.test(
        l,
      ) &&
      /\b(emotion regulation|finish(?:ing)? (?:the )?conversation|therapy|breathwork|step away|together|support)\b/i.test(
        l,
      ) &&
      /\b(sophie|daniel|he|she)\b/i.test(l)
    ) {
      return null;
    }

    /** Scenario C — emotion regulation / outside support for recurring shutdowns. */
    if (
      /\b(emotion regulation|regulat(?:e|ing)|breathwork|therapy|yoga|high emotions|outside support)\b/i.test(
        l,
      ) &&
      /\b(daniel|sophie|he|she)\b/i.test(l)
    ) {
      return 'You pointed to Daniel getting outside support for emotion regulation alongside finishing hard conversations together';
    }
  }

  /** Restorative repair — turn toward partner experience first. */
  if (
    /\b(apolog\w*|sorry)\b/i.test(l) &&
    /\b(feel|how (she|he|they)|understand|experience|needed|listen)\b/i.test(l)
  ) {
    const partner =
      scenario === 1 || (scenario === undefined && /\b(emma|ryan)\b/i.test(l) && !/\b(daniel|sophie|james|sarah)\b/i.test(l))
        ? /\b(emma|she|her)\b/i.test(l)
          ? 'her'
          : 'his'
        : scenario === 2 || (scenario === undefined && /\b(james|sarah)\b/i.test(l))
          ? /\b(sarah|she|her)\b/i.test(l)
            ? 'her'
            : 'his'
          : scenario === 3 || (scenario === undefined && /\b(daniel|sophie)\b/i.test(l))
            ? /\b(sophie|she|her)\b/i.test(l)
              ? 'her'
              : 'his'
            : /\b(sarah|emma|sophie|she|her)\b/i.test(l)
              ? 'her'
              : /\b(ryan|james|daniel|he|him)\b/i.test(l)
                ? 'his'
                : 'their';
    return `You focused on turning toward ${partner} experience before explaining yourself`;
  }

  /** Compatibility / fit — step back rather than force verdict. */
  if (/\b(compatible|compatibility|figure out if)\b/i.test(l)) {
    return 'You framed it around giving them space to see whether the fit is real';
  }

  /** Defer reopening to partner's timing. */
  if (
    /\b(wait|when (she|he|they)('re| is)? ready|brings? it up|let (her|him|them) (?:bring|raise))\b/i.test(l)
  ) {
    return 'You framed reopening on her terms rather than pushing a timeline';
  }

  /** Leaving stays on the table when pattern persists (not reassurance that someone need not leave). */
  if (
    userTurnMentionsLeavingAsOption(l) &&
    !/\b(safe to stay|doesn'?t have to leave|not going to attack|create(?:ing)? safety)\b/i.test(l)
  ) {
    return 'You named leaving as on the table when things do not shift';
  }

  /** Thin communication-only answer — proportionally simple observation. */
  if (/\bcommunicat/i.test(l) && !/\b(feel|listen|afraid|instead of|before|dismiss|confus)\b/i.test(l)) {
    return 'You focused on clearer communication as the first move when things stall';
  }

  return null;
}

export function buildScenarioBoundaryConclusionSentence(
  userTurn: string,
  opts: BuildPatternReflectionOptions = {},
): string {
  const patternCore = distillRelationalPatternFromAnswer(userTurn);
  if (patternCore) {
    const fromPattern = wrapRelationalPatternAsScenarioConclusion(userTurn, patternCore);
    if (fromPattern) {
      if (opts.scenario && !reflectionConclusionMatchesScenario(fromPattern, opts.scenario)) {
        return '';
      }
      return fromPattern;
    }
  }

  const raw = distillScenarioConclusionFromAnswer(userTurn, opts.scenario);
  if (!raw) return '';
  if (opts.scenario && !reflectionConclusionMatchesScenario(raw, opts.scenario)) return '';
  if (!boundaryConclusionPassesQualityBar(userTurn, raw)) return '';
  return raw;
}

function pickBestScenarioConclusionFromCorpus(
  corpus: string,
  opts: BuildPatternReflectionOptions,
): string {
  const candidates: string[] = [];
  const fromFull = buildScenarioBoundaryConclusionSentence(corpus, opts);
  if (fromFull) candidates.push(fromFull);

  const segments = corpus
    .split(/\n+/)
    .map((s) => normalizeAnswer(s))
    .filter((s) => s.split(/\s+/).filter(Boolean).length >= 4);
  for (const segment of segments) {
    const fromSegment = buildScenarioBoundaryConclusionSentence(segment, opts);
    if (
      fromSegment &&
      !candidates.some((c) => boundaryReflectionsAreEquivalent(c, fromSegment))
    ) {
      candidates.push(fromSegment);
    }
  }

  if (candidates.length === 0) return '';
  const viable = opts.scenario
    ? candidates.filter((c) => reflectionConclusionMatchesScenario(c, opts.scenario!))
    : candidates;
  if (viable.length === 0) return '';
  const nonVerbatim = viable.filter((c) => !reflectionLooksLikeVerbatimInferenceEcho(corpus, c));
  const pool = nonVerbatim.length > 0 ? nonVerbatim : viable;
  if (pool.length === 1) return pool[0]!;

  /** Prefer the candidate most tightly grounded in this user's wording. */
  let best = pool[0]!;
  let bestScore = scoreReflectionGroundingInUserAnswers(corpus, best);
  for (let i = 1; i < pool.length; i++) {
    const c = pool[i]!;
    const s = scoreReflectionGroundingInUserAnswers(corpus, c);
    if (s > bestScore) {
      best = c;
      bestScore = s;
    }
  }
  return best;
}

/**
 * True when a model- or stream-extracted boundary reflection must not ship to the user.
 * Covers byte-stable canned templates, vignette-theme generics, and corpus mismatches.
 */
export function extractedBoundaryReflectionIsUnsafeForUserCorpus(
  userCorpus: string,
  reflection: string,
  scenario?: 1 | 2 | 3,
): boolean {
  const r = (reflection ?? '').trim();
  if (!r) return true;
  if (reflectionLooksLikeKnownCannedBoundaryTemplate(r)) return true;
  const corpus = (userCorpus ?? '').trim();
  if (!corpus) {
    return reflectionLooksLikeGenericScenarioTheme(r);
  }
  if (reflectionLooksLikeGenericScenarioTheme(r)) return true;
  if (!boundaryConclusionPassesQualityBar(corpus, r)) return true;
  if (scenario && !reflectionConclusionMatchesScenario(r, scenario)) return true;
  return false;
}

/** Extract a grounded reflection sentence from model boundary handoff copy when present. */
export function extractScenarioBoundaryReflectionFromHandoff(text: string): string | null {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return null;

  const named = t.match(
    /\b(?:Nice work|Good work),?\s+[^—\n]+—\s+((?:You (?:focused on|named|framed|pointed to|highlighted|linked|were|read|saw)|What (?:I (?:heard|got)|came through|landed for me) was that)[^.!?]+[.!?])/i,
  );
  if (named?.[1]) {
    const reflection = named[1].trim().replace(/\.\s*$/, '');
    if (extractApprovedReflectionOpener(reflection)) {
      return reflection.charAt(0).toUpperCase() + reflection.slice(1);
    }
  }

  for (const sentence of t.split(/(?<=[.!?])\s+/)) {
    const trimmed = sentence.trim().replace(/\.\s*$/, '');
    if (trimmed && extractApprovedReflectionOpener(trimmed)) {
      return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
    }
  }
  return null;
}

/**
 * Last-resort synthesis when full heuristics fail: name a move or contrast the user actually stated.
 * Prefer shipping a thin grounded observation over omitting the evaluative clause entirely.
 */
export function buildMinimalGroundedBoundaryReflectionFromCorpus(
  userCorpus: string,
  opts: BuildPatternReflectionOptions = {},
): string {
  const corpus = normalizeAnswer(userCorpus).trim();
  if (!corpus) return '';

  const segments = corpus
    .split(/\n+/)
    .map((s) => normalizeAnswer(s).trim())
    .filter((s) => s.split(/\s+/).filter(Boolean).length >= MIN_SUBSTANTIVE_TURN_WORDS_FOR_REFLECTION);
  const segment =
    segments.sort((a, b) => b.split(/\s+/).length - a.split(/\s+/).length)[0] ?? corpus;
  if (segment.split(/\s+/).filter(Boolean).length < MIN_SUBSTANTIVE_TURN_WORDS_FOR_REFLECTION) {
    return '';
  }

  const synthesized =
    buildScenarioBoundaryConclusionSentence(segment, opts) ||
    (() => {
      const patternCore = distillRelationalPatternFromAnswer(segment);
      return patternCore
        ? wrapRelationalPatternAsScenarioConclusion(segment, patternCore)
        : '';
    })();
  if (
    synthesized &&
    (!opts.scenario || reflectionConclusionMatchesScenario(synthesized, opts.scenario))
  ) {
    return synthesized;
  }

  return '';
}

export function resolveBoundaryReflectionForBundle(
  firstName: string,
  lastUserAnswer: string | null | undefined,
  opts: { scenario?: 1 | 2 | 3; reflectionOverride?: string },
): string {
  const override = (opts.reflectionOverride ?? '').trim();
  const corpus = (lastUserAnswer ?? '').trim();
  if (
    override &&
    corpus &&
    !reflectionLooksLikeVerbatimInferenceEcho(corpus, override) &&
    boundaryConclusionPassesQualityBar(corpus, override)
  ) {
    if (!opts.scenario || reflectionConclusionMatchesScenario(override, opts.scenario)) {
      return override;
    }
  }
  if (!corpus) return '';
  return buildBoundaryReflectionFromUserCorpus(corpus, {
    scenario: opts.scenario,
    openerIndex: 0,
  });
}

/**
 * One interpretive conclusion sentence from the full scenario user corpus.
 * Omits reflection when the corpus is too thin for a grounded conclusion.
 */
export function buildBoundaryReflectionFromUserCorpus(
  userCorpus: string,
  opts: BuildPatternReflectionOptions = {},
): string {
  const corpus = normalizeAnswer(userCorpus).trim();
  if (!corpus) return '';

  const conclusion = pickBestScenarioConclusionFromCorpus(corpus, opts);
  if (!conclusion) {
    const minimal = buildMinimalGroundedBoundaryReflectionFromCorpus(corpus, opts);
    if (minimal) return minimal;
    return '';
  }
  if (opts.scenario && !reflectionConclusionMatchesScenario(conclusion, opts.scenario)) return '';
  if (!boundaryConclusionPassesQualityBar(corpus, conclusion)) return '';
  if (reflectionLooksScenarioGenerated(corpus, conclusion)) return '';

  const wordCount = corpus.split(/\s+/).filter(Boolean).length;
  if (wordCount >= MIN_SCENARIO_CORPUS_WORDS_FOR_REFLECTION) return conclusion;

  const hasSubstantiveGroundedSegment = corpus
    .split(/\n+/)
    .map((s) => normalizeAnswer(s).trim())
    .filter(Boolean)
    .some((segment) => {
      const segmentWords = segment.split(/\s+/).filter(Boolean).length;
      if (segmentWords < MIN_SUBSTANTIVE_TURN_WORDS_FOR_REFLECTION) return false;
      return Boolean(buildScenarioBoundaryConclusionSentence(segment, opts));
    });
  if (hasSubstantiveGroundedSegment) return conclusion;

  return '';
}
