import { hasScenarioBoundaryWrapPhrase } from './emotionModalTransitionOrchestration';
import { isTruncatedScenarioABoundaryReflectionOpener } from './scenarioAContemptProbeTextMatch';
import { looksLikeScenarioBRepairAsJamesQuestion } from './interviewDisengagementProbes';
import { chooseBriefScenarioAck } from './interviewReflectionAckVariation';
import type { MessageWithScenario } from './interviewScenarioScoringSlice';
import { looksLikeMoment4ThresholdQuestion } from './moment4ProbeLogic';
/**
 * Scenario A repair prompt often leads with "That makes (a lot of) sense" before the scripted Ryan question.
 * {@link stripFlatReflectionAcknowledgmentOpeners} would otherwise strip "That makes sense." via the comma rule
 * because "What if…" looks like a new clause — keep the full lead-in for TTS/display.
 */
function isPreservedAckBeforeScenarioARepairLead(text: string): boolean {
  const t = text.trim();
  if (!/^that makes (?:a lot of )?sense\b/i.test(t)) return false;
  const rest = t.replace(/^that makes (?:a lot of )?sense\s*[.,;—–-]?\s*/i, '').trim();
  return (
    /^what if you were ryan\b/i.test(rest) ||
    /^how would you repair this relationship if you were ryan\b/i.test(rest) ||
    (/^if you were ryan\b/i.test(rest) && /\brepair\b/i.test(rest))
  );
}

/**
 * Scenario B James-differently Q2: prompt requires a short ack ("Got it.") before the question; stripper would
 * otherwise remove "Sure." / "Absolutely." via {@link stripFlatReflectionAcknowledgmentOpeners} reComma.
 */
function isPreservedAckBeforeScenarioBJamesQ2(text: string): boolean {
  const t = text.trim();
  const afterAck = t.replace(/^(got it|okay|fair|thanks|sure|absolutely)\s*[.,;—–-]?\s*/i, '').trim();
  if (afterAck === t) return false;
  const low = afterAck.toLowerCase();
  return (
    /\bjames\b/.test(low) &&
    /\b(done differently|could'?ve done differently|could have done differently|might have helped|feel appreciated)\b/.test(
      low
    )
  );
}

/** Scenario B repair-as-James often leads with "Got it." before the repair ask; keep for TTS/display. */
function isPreservedAckBeforeScenarioBJamesRepair(text: string): boolean {
  const t = text.trim();
  const afterAck = t.replace(/^(got it|okay|fair|thanks|sure|absolutely)\s*[.,;—–-]?\s*/i, '').trim();
  if (afterAck === t) return false;
  return looksLikeScenarioBRepairAsJamesQuestion(afterAck);
}

/**
 * Hard blocklist: empty acknowledgments before the real reflection (applied on every assistant line before TTS/display).
 * Does not remove phrases that are integrated into one idea (e.g. "That makes sense that you'd feel…").
 */
export function stripFlatReflectionAcknowledgmentOpeners(text: string): string {
  const original = text.trim();
  if (!original) return original;
  if (isPreservedAckBeforeScenarioARepairLead(original)) return original;
  if (isPreservedAckBeforeScenarioBJamesQ2(original)) return original;
  if (isPreservedAckBeforeScenarioBJamesRepair(original)) return original;
  const MIN_REMAINDER = 14;
  const orderedPhrases = [
    'That makes sense',
    'That checks out',
    'That lands',
    'Absolutely',
    'Sure',
  ];
  let t = original;
  let guard = 0;
  let changed = true;
  while (changed && guard++ < 4) {
    changed = false;
    for (const phrase of orderedPhrases) {
      const esc = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const reComma = new RegExp(`^${esc}\\s*[,;.]\\s+`, 'i');
      const reDash = new RegExp(`^${esc}\\s*[—–]\\s*`, 'i');
      const reSpaceClause = new RegExp(
        `^${esc}\\s+(?=[IY]|I'm\\b|I've\\b|You're\\b|That\\s|What\\s|So\\s|It\\s|This\\s|The\\s|When\\s|If\\s|Here\\b|There\\b|For\\s|From\\s)`,
        'i'
      );
      for (const re of [reComma, reDash, reSpaceClause]) {
        const next = t.replace(re, '').trim();
        if (next !== t && next.length >= MIN_REMAINDER) {
          t = next;
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }
  return t || original;
}

/** Model sometimes emits "— something a lighter note" instead of "On a lighter note" before personal prompts (legacy / tolerant stripping). */
export function repairBrokenMoment5BridgeGrammar(text: string): string {
  if (!text?.trim()) return text;
  return text
    .replace(/\b[—–-]\s*something\s+a\s+lighter\s+note\b/gi, '— On a lighter note')
    .replace(/\bsomething\s+a\s+lighter\s+note\b/gi, 'On a lighter note')
    .replace(/\b(and\s+)?something\s+a\s+little\s+different\s+on\s+a\s+warmer\s+note\.?\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+[.,]\s*$/g, '.')
    .trim();
}

/** Removes recurring hollow acknowledgment tails/leads from the first paragraph (pre-TTS). Does not touch later paragraphs (e.g. final thanks). */
export function stripGenericReflectionFillersFirstParagraph(text: string): string {
  if (!text?.trim()) return text;
  /** Scripted M4 commitment follow-up — framework requires verbatim "Thanks for sharing that." before the question. */
  if (looksLikeMoment4ThresholdQuestion(text)) return text;
  const parts = text.split(/\n\n/);
  const first = parts[0] ?? '';
  let t = first;

  const stripTrailingClause = () => {
    const tailPatterns: RegExp[] = [
      /\s*[,—–-]\s*I appreciate you laying it out\.?/gi,
      /\s*[,—–-]\s*I appreciate you sharing(?: that)?\.?/gi,
      /\s*[,—–-]\s*thank you for sharing(?: that)?\.?/gi,
      /\s*[,—–-]\s*thanks for sharing\.?/gi,
      /\s*[,—–-]\s*that'?s really helpful\.?/gi,
      /\s*[,—–-]\s*that'?s helpful\.?/gi,
      /\s*[,—–-]\s*glad you shared\.?/gi,
      /\s*[,—–-]\s*good of you to (?:open up|share)\.?/gi,
      /\s*[,—–-]\s*thanks for walking me through that\.?/gi,
    ];
    for (const re of tailPatterns) {
      t = t.replace(re, '').trim();
    }
  };

  const stripLeadingFiller = () => {
    const leadPatterns = [
      /^thank you for sharing(?: that)?[.,]?\s+/i,
      /^thanks for sharing[.,]?\s+/i,
      /^that'?s really helpful[.,]?\s+/i,
      /^that'?s helpful[.,]?\s+/i,
      /^I appreciate you laying it out[.,]?\s+/i,
      /^I appreciate you sharing(?: that)?[.,]?\s+/i,
      /^glad you shared[.,]?\s+/i,
    ];
    for (const re of leadPatterns) {
      const next = t.replace(re, '').trim();
      if (next !== t) t = next;
    }
  };

  for (let i = 0; i < 3; i++) {
    const before = t;
    stripTrailingClause();
    stripLeadingFiller();
    if (t === before) break;
  }

  t = t.replace(/\s+,/g, ',').replace(/^\s*[.,—–-]+\s*/g, '').replace(/[,—–-]\s*$/g, '').trim();
  t = repairBrokenMoment5BridgeGrammar(t);
  if (!t) return text;

  parts[0] = t;
  return parts.join('\n\n');
}

/** Prompt 1: strip system-state / hollow interviewer lines the model may still emit. */
export function stripHollowSystemInterviewerPhrases(text: string): string {
  if (!text?.trim()) return text;
  const parts = text.split(/\n\n/);
  let first = parts[0] ?? '';
  const patterns: RegExp[] = [
    /\bI'?m\s+tracking\s+you\.?/gi,
    /^\s*I'?m\s+with\s+you\s+on\s+[^.!?\n—]{1,120}\s+and\s+[^.!?\n—]{1,120}\s*/i,
    /\bgot\s+it\s*[.,—–-]\s*continuing\.?(?=\s|$|\n)/gi,
    /\b(okay|alright|yeah|right|mm)\s*[—–-]\s*continuing\.?(?=\s|$|\n)/gi,
    /\s*[,—–-]\s*continuing\.(?=\s|$|\n)/gi,
  ];
  for (const re of patterns) {
    first = first.replace(re, ' ').trim();
  }
  first = first.replace(/\s{2,}/g, ' ').replace(/^[.,—–-]+\s*/g, '').trim();
  if (!first) return text;
  parts[0] = first;
  return parts.join('\n\n');
}

/**
 * Model sometimes stacks warm opener + mandatory template: "That's a real read — I hear you: …" (reads redundant).
 */
export function collapseStackedEmpathyIHearYouInFirstParagraph(text: string): string {
  if (!text?.trim()) return text;
  const parts = text.split('\n\n');
  const fixLine = (line: string): string =>
    line
      .replace(/^(that's a real read)\s*[—–-]\s*i hear you\s*:\s*/i, '$1 — ')
      .replace(/^(i see what you mean)\s*[—–-]\s*i hear you\s*:\s*/i, '$1 — ')
      .replace(/^(yeah, i can see that)\s*[—–-]\s*i hear you\s*:\s*/i, '$1 — ')
      .replace(
        /^(good|got it|great|nice|makes sense)\s*[—–-]\s*(yeah, i can see that)\s*[—–-]\s*i hear you\s*:\s*/i,
        '$1 — I hear you: '
      )
      .trim();
  parts[0] = fixLine(parts[0] ?? '');
  return parts.join('\n\n');
}

/**
 * Strip model output that pastes the user's words verbatim (leading quotes) or opens with "Noted".
 * Verbatim user paste + truncation was coming from buildMandatoryAckPrefix (removed); this catches model-only echoes.
 */
export function stripForbiddenReflectionLead(text: string): string {
  if (!text?.trim()) return text;
  const paras = text.split(/\n\n/);
  let first = paras[0].trim();

  const stripNotedLead = (s: string) =>
    s
      .replace(/^noted[.,]?\s*[—–-]\s*/i, '')
      .replace(/^noted[.,]?\s+/i, '')
      .trim();

  first = stripNotedLead(first);
  let guard = 0;
  while (guard++ < 8 && first.length > 0) {
    const before = first;
    if (/^["“]/.test(first)) {
      const open = first[0];
      const close = open === '“' ? '”' : '"';
      const rest = first.slice(1);
      const closeIdx = rest.indexOf(close);
      if (closeIdx >= 8) {
        first = rest.slice(closeIdx + 1).trim().replace(/^[.,;]\s*/, '');
      } else {
        const cut = rest.search(/[.!?\n…]/);
        first = (cut >= 0 ? rest.slice(cut + 1) : '').trim();
      }
    } else if (/^['‘’]/.test(first)) {
      const rest = first.slice(1);
      const closeIdx = rest.indexOf("'");
      if (closeIdx >= 12) {
        first = rest.slice(closeIdx + 1).trim().replace(/^[.,;]\s*/, '');
      } else {
        const cut = rest.search(/[.!?\n…]/);
        first = (cut >= 0 ? rest.slice(cut + 1) : '').trim();
      }
    }
    first = stripNotedLead(first);
    if (first === before) break;
  }

  if (!first) {
    if (paras.length > 1) {
      paras.shift();
      return paras.join('\n\n').trim();
    }
    return text;
  }
  paras[0] = first;
  return paras.join('\n\n');
}

export function isScenarioBoundaryClosureTurn(text: string): boolean {
  const low = (text ?? '').trim().toLowerCase();
  if (!low) return false;
  if (hasScenarioBoundaryWrapPhrase(text)) return true;
  if (isTruncatedScenarioABoundaryReflectionOpener(text)) return true;
  if (/\bthat situation is complete\b/.test(low)) return true;
  if (/\b(?:situation\s+1|that situation)\s+(?:is\s+)?wrap(?:ped)?\s+up\b/.test(low)) return true;
  if (/\b(?:here'?s the (?:second|third|next) situation|on to the (?:second|third) situation)\b/.test(low)) {
    return true;
  }
  if (/\bsophie and daniel\b/.test(low) && !/\?/.test(low)) return true;
  if (/\bsarah and james\b/.test(low) && !/\?/.test(low)) return true;
  if (
    (/\bso (?:your (?:instinct|read|repair|inst)|for you,?)\b/.test(low) ||
      /^so your inst(?:inct)?(?:\s+is)?(?:\s+that)?\b/.test(low) ||
      /\bwhat i (?:heard|got) was\b/.test(low) ||
      /\bwhat came through was\b/.test(low) ||
      /\bwhat landed for me was\b/.test(low) ||
      /\bi can see that\b/.test(low)) &&
    !/\?/.test(low)
  ) {
    return true;
  }
  return false;
}

/**
 * Mid-interview boundary reflection delivered as its own streaming sentence
 * (e.g. "Nice work, Matt — you focused on getting to an agreement…").
 */
export function isScenarioBoundaryPositiveAddressReflection(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || /\?\s*$/.test(t)) return false;
  if (!/^(?:nice|good)\s+work,\s+/i.test(t)) return false;
  return /\byou (?:focused(?:\s+on)?|saw|recognized|picked up on|read|named|framed|pointed to|highlighted)\b/i.test(
    t,
  );
}

function paragraphStartsWithBriefAck(para: string): boolean {
  return /^(got it|makes sense|well done|good|great|nice|fair|okay|ok|thanks|i'?m with you|that makes (?:a lot of )?sense)\b[.,!]?\s/i.test(
    para.trim(),
  );
}

function paragraphContainsSubstantiveScenarioQuestion(para: string): boolean {
  if (!/\?/.test(para)) return false;
  return /\b(what do you think|how would you|what if you were|if you were|what about when|did that read as contempt|what do you make of|how do you think this situation could be repaired|anything james could|done differently)\b/i.test(
    para,
  );
}

const MID_SCENARIO_RELATIONAL_REFLECTION_LEAD =
  /^(?:What I (?:got|heard) was that|What (?:came through|landed for me) was that|So (?:for you,?|your (?:instinct|read|repair|inst)(?:inct)?(?:\s+is)?(?:\s+that)?|you locate)|I can see that)[^.!?]{8,220}[.!?]\s+/i;

const INCOMPLETE_REFLECTION_BEFORE_QUESTION =
  /^(?:What I (?:got|heard) was that|What (?:came through|landed for me) was that|So (?:for you,?|your (?:inst(?:inct)?|read|repair))(?:\s+is)?(?:\s+that)?|I can see that)\b[^.!?]*?(?=(?:What |How |If you |And if |Before things ))/i;

function replaceMidScenarioReflectionWithBriefAck(para: string, ack: string): string {
  const complete = para.match(MID_SCENARIO_RELATIONAL_REFLECTION_LEAD);
  if (complete) {
    const rest = para.slice(complete[0].length).trim();
    if (rest) return `${ack} ${rest}`;
  }
  const incomplete = para.match(INCOMPLETE_REFLECTION_BEFORE_QUESTION);
  if (incomplete) {
    const rest = para.slice(incomplete[0].length).trim();
    if (rest) return `${ack} ${rest}`;
  }
  return para;
}

/**
 * Within a scenario, replace relational-pattern reflection before the next question with a brief ack only.
 * Prepends a brief ack when a substantive question has no acknowledgment lead.
 * Full reflection is reserved for scenario boundary closure turns.
 */
export function coerceMidScenarioRelationalReflectionToBriefAck(
  text: string,
  recentAssistant: MessageWithScenario[] = [],
): string {
  const original = (text ?? '').trim();
  if (!original || isScenarioBoundaryClosureTurn(original)) return text;

  const ack = chooseBriefScenarioAck(recentAssistant);
  const parts = original.split(/\n\n/);
  let first = parts[0] ?? '';

  if (!paragraphStartsWithBriefAck(first)) {
    first = replaceMidScenarioReflectionWithBriefAck(first, ack);
    if (
      first === parts[0] &&
      paragraphContainsSubstantiveScenarioQuestion(first) &&
      !paragraphStartsWithBriefAck(first)
    ) {
      first = `${ack} ${first}`;
    }
  }

  parts[0] = first;
  const out = parts.join('\n\n').trim();
  return out || original;
}

/** True when model leaked internal reflection schema (reflection_reasoning / snake_case fields). */
export function looksLikeInternalReflectionSchemaLeak(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t) return false;
  return (
    /\breflection_reasoning\s*:/.test(t) ||
    /\bspecific_element_from_answer\s*:/.test(t) ||
    /\brelational_orientation_identified\s*:/.test(t)
  );
}

/** Drop internal reflection schema blocks before TTS or closing handoff. */
export function stripInternalReflectionSchemaLeak(text: string): string {
  let out = (text ?? '').trim();
  if (!out) return out;
  out = out.replace(/reflection_reasoning\s*:\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}\s*/gi, '');
  out = out.replace(/reflection_reasoning\s*:\s*\{[\s\S]*$/i, '');
  out = out.replace(
    /\b(specific_element_from_answer|relational_orientation_identified)\s*:\s*(?:"[^"]*"|'[^']*'|[^\n.!?]+)/gi,
    '',
  );
  out = out.replace(/^\s*reflection_reasoning\s*:?\s*$/gim, '');
  out = out.replace(/^\s*[\{\}]\s*$/gm, '');
  return out.replace(/\s+/g, ' ').trim();
}

/** Suppress streaming sentence fragments that are only internal schema keys/values. */
export function isInternalReflectionSchemaStreamFragment(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return false;
  if (looksLikeInternalReflectionSchemaLeak(t)) return true;
  if (/^reflection_reasoning\s*:?\s*$/i.test(t)) return true;
  if (/^(specific_element_from_answer|relational_orientation_identified)\s*:/i.test(t)) return true;
  if (/^[\{\}]\s*,?\s*$/.test(t)) return true;
  return false;
}
