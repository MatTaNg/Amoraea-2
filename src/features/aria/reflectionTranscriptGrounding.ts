/**
 * Grounding guards for M4/M5 client reflections — reflections must cite the user's transcript,
 * not invented relational qualities.
 */

import { MOMENT5_LIKELY_PROPER_NAME_RE } from './moment5SpecificityRedirect';

const REFLECTION_GROUNDING_STOPWORDS = new Set([
  'about',
  'after',
  'before',
  'being',
  'between',
  'could',
  'experience',
  'explaining',
  'focused',
  'happened',
  'heard',
  'named',
  'repair',
  'something',
  'starts',
  'their',
  'there',
  'these',
  'those',
  'toward',
  'turning',
  'understand',
  'what',
  'would',
  'your',
  'yourself',
]);

export const M4_REFLECTION_TRANSCRIPT_ONLY_CONSTRAINT = `Generate the reflection using only content the user explicitly stated in their answer. Do not infer, project, or attribute relational qualities or behaviors that are not directly present in their words. If no clear standout moment exists in their answer, write a neutral acknowledgment such as "Thanks for sharing that" rather than inventing a characterization.`;

function normalizeGroundingText(text: string): string {
  return (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/** True when the user named a specific person, situation, action, or framing — not pure philosophy. */
export function userAnswerHasReflectionAnchor(text: string): boolean {
  const t = normalizeGroundingText(text);
  if (!t || t.split(/\s+/).filter(Boolean).length < 5) return false;
  if (
    MOMENT5_LIKELY_PROPER_NAME_RE.test(text) &&
    !/\b(People|Communication|Relationships|Something|Important|Honestly|Because)\b/.test(text)
  ) {
    return true;
  }
  if (
    /\b(my (?:ex(?:-partner)?|mom|mother|dad|father|friend|partner|roommate|wife|husband|boyfriend|girlfriend|spouse|coworker|colleague))\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\b(falling out|fell out|grudge|resentment|hard time|got under your skin|moved out|unanswered|text(?:ed)?|fight|argument|conflict|rupture|tension)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  if (
    /\b(looking forward|dreading|work through|third strike|tipping point|turning point)\b/i.test(
      t,
    )
  ) {
    return true;
  }
  // Hypothetical repair with a named partner move (scenario or personal).
  if (
    /\b(ask (?:her|him|them)|how (?:she|he|they)(?:'s| is)? feeling)\b/i.test(t) &&
    /\b(apolog\w*|sorry|listen|hear (?:her|him|them) out)\b/i.test(t)
  ) {
    return true;
  }
  if (/\b(voicemail|boundar\w*|commit to)\b/i.test(t)) return true;
  if (/\b(ryan|james|daniel|emma|sarah)\b/i.test(t)) return true;
  if (/\b(i (?:would|will|'d|walk)|then i)\b/i.test(t) && /\bwalk away\b/i.test(t)) return true;
  return false;
}

/**
 * True only when the user explicitly described turning toward a partner's experience
 * before explaining themselves — not merely "apologized" + "before" in unrelated order.
 */
export function userTurnDescribesRestorativeTurnTowardPartner(text: string): boolean {
  const l = normalizeGroundingText(text);
  if (!l) return false;
  const hasRepairMove =
    /\b(apolog\w*|sorry|listen(?:ed|ing)?|hear (?:her|him|them) out|turn(?:ing)? toward|understand (?:how |what )?(?:she|he|they)|how (?:she|he|they)(?:'s| is)? feeling|ask (?:her|him|them))\b/i.test(
      l,
    );
  const hasBeforeExplain =
    /\b(before|first)\b/i.test(l) &&
    /\b(explain(?:ing|ed)?|my side|defend(?:ing)?|justify(?:ing)?)\b/i.test(l);
  if (hasRepairMove && hasBeforeExplain) return true;
  if (
    /\b(apolog\w*|sorry)\b/i.test(l) &&
    /\b(how (?:she|he|they)(?:'s| is)? feeling|how (?:she|he|they) (?:felt|was feeling|were feeling)|what (?:she|he|they) needed|ask (?:her|him|them)|listen(?:ed|ing)?|hear (?:her|him|them) out)\b/i.test(
      l,
    )
  ) {
    return true;
  }
  return false;
}

/** Combine user turns from a Moment 4 transcript slice into one grounding corpus. */
export function combineMoment4UserTurnText(
  transcript: readonly { role?: string; content?: string | null; interviewMoment?: number }[] | null | undefined,
): string {
  if (!Array.isArray(transcript)) return '';
  const parts: string[] = [];
  for (const turn of transcript) {
    if (turn?.role !== 'user') continue;
    const moment = turn.interviewMoment;
    if (moment != null && moment !== 4) continue;
    const c = (turn.content ?? '').trim();
    if (c) parts.push(c);
  }
  if (parts.length > 0) return parts.join(' ');
  for (const turn of transcript) {
    if (turn?.role !== 'user') continue;
    const c = (turn.content ?? '').trim();
    if (c) parts.push(c);
  }
  return parts.join(' ');
}

/**
 * True when a reflection cites something the user actually said — a person, action, or framing cue.
 * Rejects invented relational qualities (e.g. "turn toward her experience") absent from the transcript.
 */
export function reflectionIsGroundedInUserAnswer(reflection: string, userAnswer: string): boolean {
  const u = normalizeGroundingText(userAnswer);
  const r = normalizeGroundingText(reflection);
  if (!u || !r) return false;

  if (
    /\bturning toward\b.*\bexperience\b.*\bbefore explaining\b/i.test(r) ||
    /\brepair, for you, starts by turning toward\b/i.test(r)
  ) {
    return userTurnDescribesRestorativeTurnTowardPartner(u);
  }

  if (/\brepair, for you, starts with making sure it doesn't happen again\b/i.test(r)) {
    return /\b(voicemail|commit|make sure|happen again|not happen|won't happen|during dates)\b/i.test(u);
  }

  if (/\brepair, for you, starts with drawing a line\b/i.test(r)) {
    return /\b(boundar\w*|limit|line|voicemail|space)\b/i.test(u);
  }

  if (/\brepair, for you, means owning your part\b/i.test(r)) {
    return /\b(apolog\w*|sorry|boundar\w*|voicemail|guardrail)\b/i.test(u);
  }

  if (
    /\bwhen someone(?:'s| is) hurt, you(?:'d| would) reach for emotional acknowledgment\b/i.test(r)
  ) {
    return /\b(feel|feeling|listen|heard|before|instead of|practical|logistic)\b/i.test(u);
  }

  if (/\bcelebration land before any practical\b/i.test(r)) {
    return /\b(happy for|appreciat\w*|celebrat\w*|logistic|practical|jump(?:ing)? to)\b/i.test(u);
  }

  if (/\bshared date time getting traded for family priorities\b/i.test(r)) {
    return /\bshared time\b/i.test(u) && /\b(family|mom|mother|taking)\b/i.test(u);
  }

  if (/\bstructural limits\b/i.test(r) && /\b(date time|calls|family)\b/i.test(r)) {
    return /\b(voicemail|calls?|during dates?|boundar\w*|mom|mother|family|dinner dates?)\b/i.test(u);
  }

  if (/\breassuring safety with finishing hard conversations\b/i.test(r)) {
    return /\b(safe|doesn'?t have to leave|finish(?:ing)? (?:the )?conversation|emotion regulation|therapy|breathwork)\b/i.test(
      u,
    );
  }

  if (/\bworking together directly instead of talking around\b/i.test(r)) {
    return (
      /\b(team|together|as a couple)\b/i.test(u) &&
      /\b(side comment|snide comment|talking behind|gossip|sniping|reaction instead of)\b/i.test(u)
    );
  }

  if (/\bunclear expectations\b/i.test(r)) {
    return (
      /\bexpect/i.test(u) ||
      /\b(what'?s okay|acceptable|agreement on|not communication|painful pattern)\b/i.test(u)
    );
  }

  if (/\bteamwork instead of side comments\b/i.test(r)) {
    return (
      (/\bexpect/i.test(u) || /\b(what'?s okay|acceptable|agreement on|not communication)\b/i.test(u)) &&
      /\b(team|together)\b/i.test(u) &&
      /\b(side comment|snide comment|gossip)\b/i.test(u)
    );
  }

  if (/\bassuring her and following through\b/i.test(r)) {
    return /\b(assure|follow through|happen again|not happen again)\b/i.test(u);
  }

  if (/\bcheck in about what celebration looked like\b/i.test(r)) {
    return /\b(celebrat|appreciat|how (?:she|sarah) wanted|didn'?t feel appreciated|different type of celebration)\b/i.test(
      u,
    );
  }

  if (
    /\b(leaving as on the table|walk(?:ing)? away|work(?:ing)? through)\b/i.test(r) &&
    /\b(walk(?:ing)? away|leave|end (?:it|the relationship)|throw(?:ing)? in the towel|call it quits|keep working|work(?:ing)? through|work at it|red flags?|deal[- ]?breaker)\b/i.test(
      u,
    )
  ) {
    return true;
  }

  const userWords =
    u.match(/\b[a-z]{4,}\b/g)?.filter((w) => !REFLECTION_GROUNDING_STOPWORDS.has(w)) ?? [];
  if (userWords.length === 0) return false;

  const hits = userWords.filter((w) => r.includes(w));
  if (hits.length >= 2) return true;
  if (hits.some((w) => w.length >= 7)) return true;

  const personPatterns: RegExp[] = [
    /\bmy ex\b/,
    /\bmy (?:mom|mother|dad|father|friend|partner|roommate)\b/,
    /\b(?:moved out|unanswered|grudge|falling out|dreading|looking forward)\b/,
  ];
  for (const re of personPatterns) {
    if (re.test(u) && re.test(r)) return true;
  }

  return false;
}

/** Drop reflections that invent content not present in the user's words. */
export function rejectUnanchoredPersonalMomentReflection(
  reflection: string,
  userAnswer: string,
): string {
  const trimmed = (reflection ?? '').trim();
  if (!trimmed) return '';
  if (!userAnswerHasReflectionAnchor(userAnswer)) return '';
  if (!reflectionIsGroundedInUserAnswer(trimmed, userAnswer)) return '';
  return trimmed;
}

/** Inject Moment 4 user transcript into the system prompt for model-generated reflections. */
export function buildMoment4TranscriptSystemSuffix(
  messages: readonly { role?: string; content?: string | null; interviewMoment?: number }[],
  currentMoment: number,
): string {
  if (currentMoment < 4) return '';
  const corpus = combineMoment4UserTurnText(messages);
  if (!corpus.trim()) return '';
  return [
    '',
    'MOMENT 4 USER TRANSCRIPT (for reflections only — do not read aloud):',
    `moment_4_transcript: ${corpus}`,
    M4_REFLECTION_TRANSCRIPT_ONLY_CONSTRAINT,
  ].join('\n');
}
