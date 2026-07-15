import { normalizeInterviewTypography } from './interviewTypography';
import { hasScenarioBoundaryWrapPhrase } from './emotionModalTransitionOrchestration';
import { textContainsScenarioBVignetteBody } from './emotionScenarioTransitionInference';
import { looksLikeScenarioARepairQuestion } from './interviewDisengagementProbes';
import { isScenarioBoundaryPositiveAddressReflection } from './interviewReflectionTextStrips';

export const SCENARIO_A_TOPIC_RE =
  /\b(emma|ryan|dinner|mother|mom|bill|call|family|first|wrong|tension|hurt|frustrat|angry|upset|clear)\b/i;

/** NBSP + apostrophe variants from ASR/TTS when matching Emma's closing line. */
export function normalizeInterviewApostrophesForMatching(s: string): string {
  return s
    .replace(/\u00a0/g, ' ')
    .replace(/\u2019/g, "'")
    .replace(/\u2018/g, "'")
    .replace(/\u02bc/g, "'")
    .replace(/\uff07/g, "'")
    .replace(/\u2032/g, "'");
}

/**
 * ASR often mishears "that line" as "lot line" / "lotline" when the user deictically refers to Emma's last beat.
 * Normalize before Scenario A contempt skip / coverage regexes.
 */
export function normalizeScenarioAThatLineAsrTypos(s: string): string {
  return s
    .replace(/\b[Ll]ot\s*line\b/g, 'that line')
    .replace(/\b[Ll]otline\b/g, 'that line');
}

/**
 * User echoed Emma's "you've made that very clear" (or a close ASR variant).
 * When true, do not ask the scripted contempt follow-up about that same line.
 */
export function userReferencesEmmaClosingLineQuote(text: string): boolean {
  const squashed = text.replace(/\s+/g, ' ').trim();
  const lower = normalizeScenarioAThatLineAsrTypos(
    normalizeInterviewApostrophesForMatching(squashed),
  )
    .replace(/\s+/g, ' ')
    .toLowerCase();

  if (lower.includes("you've made that very clear")) return true;
  if (lower.includes('you have made that very clear')) return true;

  const variantPatterns: RegExp[] = [
    /\byou\s+made\s+that\s+very\s+clear\b/i,
    /\byou\s+made\s+that\s+(?:really|pretty|so)\s+clear\b/i,
    /\byouve\s+made\s+that\s+very\s+clear\b/i,
    /\byou'?ve\s+made\s+that\s+(?:really|pretty|so)\s+clear\b/i,
    /\byou'?ve\s+made\s+(?:that\s+)?(?:it\s+)?very\s+clear\b/i,
    /\bi\s+know[, ]+\s*you'?ve\s+made\s+that\s+very\s+clear\b/i,
    /\bshe\s+said\s+['"\u201c]?\s*you\s*(?:'ve|have)\s+made\s+that\s+very\s+clear\b/i,
    /\bwhen\s+(?:emma\s+)?says\s+['"\u201c]?\s*you\s*(?:'ve|have)\s+made\s+that\s+very\s+clear\b/i,
    /\bemma\s+says\s+['"\u201c]?\s*you\s*(?:'ve|have)\s+made\s+that\s+very\s+clear\b/i,
  ];
  if (variantPatterns.some((re) => re.test(lower))) return true;

  if (
    /\byou\s*(?:'ve\s+)?made\b[^.]{0,28}\bthat\s+(?:really|very|pretty|so)\s+clear\b/i.test(lower)
  ) {
    return true;
  }

  const idxMade = lower.search(/\bmade\b/);
  const idxThatClear = lower.search(/\bthat\s+(?:really|very|pretty|so)\s+clear\b/);
  if (idxMade >= 0 && idxThatClear >= 0 && Math.abs(idxMade - idxThatClear) <= 80) {
    const before = lower.slice(Math.max(0, idxMade - 24), idxMade);
    if (/\b(you|emma|she)\b/.test(before)) return true;
  }

  return false;
}

/**
 * User deictically points at Emma's closing beat without quoting it verbatim — e.g. "Emma's line,"
 * "when Emma says that," "the last thing Emma said." Used to skip the scripted contempt re-ask when
 * the user has already engaged that specific moment.
 */
export function userReferencesEmmaClosingLineIndirectly(text: string): boolean {
  const squashed = text.replace(/\s+/g, ' ').trim();
  if (squashed.length < 8) return false;
  const lower = normalizeScenarioAThatLineAsrTypos(
    normalizeInterviewApostrophesForMatching(squashed),
  )
    .replace(/\s+/g, ' ')
    .toLowerCase();

  if (userReferencesEmmaClosingLineQuote(text)) return true;

  const indirectPatterns: RegExp[] = [
    /\bemma'?s\s+(?:line|comment|last\s+line|closing\s+line|final\s+line|words|statement|remark|response|wording)\b/i,
    /\b(?:that|her)\s+(?:line|comment|last\s+line|closing\s+line|final\s+line|remark|statement|response|words)\b/i,
    /\b(?:that|the)\s+last\s+(?:thing|line|comment|remark|statement)\s+(?:emma|she)\b/i,
    /\b(?:the|that)\s+last\s+thing\s+emma\s+(?:said|says)\b/i,
    /\bemma'?s\s+last\s+line\b/i,
    /\bwhen\s+emma\s+(?:says?|said)\s+that\b/i,
    /\bwhat\s+emma\s+(?:said|says)\b/i,
    /\bthe\s+way\s+emma\s+(?:said|says)\b/i,
    /\bemma\s+saying\s+that\b/i,
    /\bher\s+comment\s+at\s+the\s+end\b/i,
    /\b(?:at\s+)?the\s+end\s+of\s+(?:the\s+)?scenario\b/i,
    /\bwhen\s+she\s+says\s+that\b/i,
    /\bthe\s+way\s+she\s+said\s+that\b/i,
    /\bwhat\s+she\s+said\s+at\s+the\s+end\b/i,
    /\b(?:that|her)\s+last\s+(?:line|comment|remark|thing)\b/i,
    /\b(?:that|the)\s+last\s+thing\s+(?:emma|she)\s+(?:said|says)\b/i,
    /\bwhen\s+she\s+says\s+(?:['"\u201c]?)?(?:you\s*(?:'ve|have)\s+)?made\b/i,
    /\bwhat\s+she\s+meant\s+when\s+she\s+said\b/i,
    /\bhow\s+emma\s+said\s+that\b/i,
  ];
  if (indirectPatterns.some((re) => re.test(lower))) return true;

  /** Near-verbatim fragments with Emma/she anchor (ASR may drop "you've"). */
  if (
    /\b(emma|she)\b/.test(lower) &&
    (/\bmade\s+that\s+(?:very|really|pretty|so)\s+clear\b/i.test(lower) ||
      /\bthat'?s\s+very\s+clear\b/i.test(lower) ||
      /\bthat'?s\s+(?:really|pretty|so)\s+clear\b/i.test(lower))
  ) {
    return true;
  }

  return false;
}

/** Emma's closing line from Scenario A — verbatim or common ASR variants. */
export function scenarioAEmmaVeryClearClosingLineMentioned(text: string): boolean {
  return userReferencesEmmaClosingLineQuote(text);
}

/**
 * True when assistant text re-asks about Emma's "you've made that very clear" line — canonical framework copy
 * or common model paraphrases ("What did you think when Emma said…").
 */
export function scenarioAEmmaVeryClearContemptReask(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\u2019/g, "'");
  if (!t || t.length > 360) return false;
  /** Vignette body embeds the line narratively — not a contempt re-ask. */
  if (t.includes('dinner plans') && t.includes('ryan takes a call')) return false;
  if (!scenarioAEmmaVeryClearClosingLineMentioned(t)) return false;
  /** Streaming may flush the em-dash lead before the "what do you make of…?" tail — not a delivered probe yet. */
  if (/\bwhat about when emma says\b/.test(t) && !/\bwhat do you make of\b/.test(t)) {
    return false;
  }

  const reaskCue =
    /\bwhat about when emma says\b/.test(t) ||
    /\bwhat (?:did|do) you make of\b/.test(t) ||
    /\bwhat (?:did|do) you make of emma'?s closing line\b/.test(t) ||
    /\bwhat (?:did|do) you think (?:she|emma) meant when (?:she|emma) said\b/.test(t) ||
    /\bwhat (?:did|do) you think emma (?:meant|was saying|was getting at|was trying to say)\b/.test(t) ||
    /\bwhat (?:did|do) you think (?:about )?when\b/.test(t) ||
    /** Model paraphrase: "Do you think Emma's last line … says something about how she's feeling?" */
    /\bdo you think emma'?s (?:last |closing )?line\b/.test(t) ||
    (/\bemma'?s (?:last |closing )?line\b/.test(t) &&
      (/\bsays something\b/.test(t) ||
        /\bhow she'?s feeling\b/.test(t) ||
        /\babout how she(?:'s| is) feeling\b/.test(t))) ||
    /\bhow do you (?:read|take|understand)\b/.test(t) ||
    /\bhow does that read\b/.test(t) ||
    /\bhow does that land\b/.test(t) ||
    /\bhow did that land\b/.test(t) ||
    /\bwhat does emma'?s closing line\b/.test(t) ||
    /\bthe way you read emma'?s closing line\b/.test(t) ||
    (/\bwhat'?s going on for emma\b/.test(t) && scenarioAEmmaVeryClearClosingLineMentioned(t)) ||
    (/\bclosing line\b/.test(t) && /\bemma\b/.test(t) && /\btell you\b/.test(t)) ||
    (/\bemma'?s closing line\b/.test(t) && /\bcontempt\b/.test(t)) ||
    (/\bclosing line from emma\b/.test(t) && /\bcontempt\b/.test(t)) ||
    /\bdid that read as contempt\b/.test(t) ||
    /\bread as contempt to you\b/.test(t) ||
    (/\bcontempt\b/.test(t) &&
      /\b(?:or )?something else\b/.test(t) &&
      /\bclosing line\b/.test(t) &&
      /\bemma\b/.test(t)) ||
    (/\bwhen\s+(?:emma|she)\s+says?\b/.test(t) && /\b(very\s+clear|made\s+that)\b/.test(t)) ||
    (/\bwhen emma says\b/.test(t) && /\bhow does that read\b/.test(t)) ||
    (/\breading that (?:last )?line\b/.test(t) && /\bemma\b/.test(t)) ||
    (/\b(?:that )?last line\b/.test(t) && /\bemma\s+says\b/.test(t));

  return reaskCue;
}

/** Scenario A contempt probe — "What about when Emma says 'you've made that very clear'…" */
export function looksLikeScenarioAContemptProbeQuestion(text: string): boolean {
  const tNorm = normalizeInterviewTypography(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\u2019/g, "'");
  if (
    /\bwhat do you make of emma'?s response there\b/.test(tNorm) ||
    /\bwhat did you think of emma'?s response there\b/.test(tNorm) ||
    /\bwhat do you make of emma'?s statement there\b/.test(tNorm)
  ) {
    return true;
  }
  if (
    /\bthe way you read emma'?s closing line\b/.test(tNorm) ||
    (/\bwhat'?s going on for emma\b/.test(tNorm) &&
      scenarioAEmmaVeryClearClosingLineMentioned(tNorm)) ||
    (/\bemma'?s closing line\b/.test(tNorm) &&
      (/\bcontempt\b/.test(tNorm) || /\btell you about\b/.test(tNorm)))
  ) {
    return true;
  }
  if (scenarioAEmmaVeryClearContemptReask(text)) return true;
  const t = text.toLowerCase().replace(/\u2019/g, "'");
  const mentionsEmmaClosingLine = scenarioAEmmaVeryClearClosingLineMentioned(t);
  const makeOfEmmaVeryClearProbe =
    /\bwhat\s+(?:did|do)\s+you\s+make\s+of\b/.test(t) &&
    /\bemma\b/.test(t) &&
    /\b(very\s+clear|you'?ve\s+made\s+that|you\s+made\s+that|closing\s+line)\b/.test(t);
  const makeOfEmmaClosingLineProbe =
    /\bwhat\s+(?:did|do)\s+you\s+make\s+of\s+emma'?s\s+closing\s+line\b/.test(t) &&
    mentionsEmmaClosingLine;
  const shortGarbledMakeOfEmma =
    t.length < 220 &&
    /\bwhat (?:did|do) you make of\b/.test(t) &&
    /\bemma\b/.test(t) &&
    /\bvery\s+clear\b/.test(t);
  const emmaMeantWhenSheSaidProbe =
    /\bwhat\s+(?:did|do)\s+you\s+think\s+(?:she|emma)\s+meant\s+when\s+(?:she|emma)\s+said\b/.test(t) &&
    mentionsEmmaClosingLine;
  const emmaSaysMakeOfThatTail =
    /\bwhat about when emma says\b/.test(t) && /\bwhat do you make of (that|it)\b/.test(t);
  return (
    makeOfEmmaVeryClearProbe ||
    makeOfEmmaClosingLineProbe ||
    emmaMeantWhenSheSaidProbe ||
    shortGarbledMakeOfEmma ||
    emmaSaysMakeOfThatTail ||
    (mentionsEmmaClosingLine && /\bwhat do you make of emma'?s statement\b/.test(t))
  );
}

/**
 * Streaming TTS may flush before the "what do you make of that?" tail after an em dash.
 * Hold the Emma-line lead until the next sentence completes the contempt probe.
 */
export function isIncompleteScenarioAContemptProbeLeadSentence(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/\u2019/g, "'");
  if (!t) return false;
  /** Defer em-dash split leads even when reask heuristics would treat the chunk as a full probe. */
  if (
    scenarioAEmmaVeryClearClosingLineMentioned(t) &&
    /\bwhat about when emma says\b/.test(t) &&
    !/\bwhat do you make of (that|it|emma)\b/.test(t)
  ) {
    return true;
  }
  if (looksLikeScenarioAContemptProbeQuestion(text)) return false;
  if (!scenarioAEmmaVeryClearClosingLineMentioned(t)) {
    /** Truncated model/stream cutoff: "What do you think Emma" without completing the probe. */
    if (/\bwhat (?:do you )?think emma\b/.test(t)) return true;
    /** Partial "What about when Emma" lead without the closing-line tail. */
    if (/\bwhat about when emma\b/.test(t)) return true;
    /** Model paraphrase: "That line Emma said — does it come across…" without completing the probe. */
    if (/\bthat line emma (?:said|says)\b/.test(t)) return true;
    if (/\bdoes it come across\b/.test(t) && !/\bwhat do you make of (that|it|emma)\b/.test(t)) return true;
    return false;
  }
  if (!scenarioAEmmaVeryClearClosingLineMentioned(t)) return false;
  if (/\bwhat do you make of (that|it)\b/.test(t)) return false;
  if (/\bhow does that land\b/.test(t) || /\bhow did that land\b/.test(t)) return true;
  if (/\bthat line emma (?:said|says)\b/.test(t) && !/\bwhat do you make of (that|it|emma)\b/.test(t)) {
    return true;
  }
  if (/\bdoes it come across\b/.test(t) && !/\bwhat do you make of (that|it|emma)\b/.test(t)) return true;
  return (
    /\bwhat about when emma says\b/.test(t) ||
    (/\breading that (?:last )?line\b/.test(t) && /\bemma\b/.test(t)) ||
    (/\bwhat (?:did|do) you think when\b/.test(t) && /\bwhen\s+(?:emma|she)\s+said\b/.test(t))
  );
}

/** "That situation's done" / "that scenario's done" segment-close phrasing (contraction-tolerant). */
export function scenarioASegmentCloseDonePhrasePresent(text: string): boolean {
  const low = (text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!low) return false;
  return (
    /\bthat scenario'?s done\b/.test(low) ||
    /\bthis scenario'?s done\b/.test(low) ||
    /\bthat situation'?s done\b/.test(low) ||
    /\bthis situation'?s done\b/.test(low) ||
    /\bthat situation is (?:complete|done)\b/.test(low) ||
    /\bthat scenario is complete\b/.test(low) ||
    /\bthat situation is complete\b/.test(low)
  );
}

/** Truncated boundary reflection opener cut before "was …" (stream/API cutoff). */
export function isTruncatedScenarioABoundaryReflectionOpener(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || textContainsScenarioBVignetteBody(t)) return false;
  if (/\bwhat i (?:heard|got) was\b/i.test(t)) return false;
  if (/\bwhat came through was\b/i.test(t)) return false;
  if (/\bwhat landed for me was\b/i.test(t)) return false;
  return (
    /\bwhat i (?:heard|got)\s*$/i.test(t) ||
    /\bwhat came through\s*$/i.test(t) ||
    /\bwhat landed for me\s*$/i.test(t) ||
    /\bwhat landed\s*$/i.test(t)
  );
}

/**
 * Streaming may flush a partial S1 boundary wrap (reflection + segment close) without the S2 vignette.
 */
export function isIncompleteScenarioABoundaryClosureLeadSentence(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || /\?\s*$/.test(t)) return false;
  if (textContainsScenarioBVignetteBody(t)) return false;
  if (/\b(?:here'?s the next situation|sarah has been job hunting|on to the second)\b/i.test(t)) {
    return false;
  }
  if (isTruncatedScenarioABoundaryReflectionOpener(t)) return true;
  const low = t.toLowerCase();
  const hasClosureLead =
    scenarioASegmentCloseDonePhrasePresent(t) ||
    /\bwhat i (?:heard|got) was\b/.test(low) ||
    /\bwhat came through was\b/.test(low) ||
    /\bwhat landed for me was\b/.test(low) ||
    /\byou (?:saw|recognized|picked up on|read)\b/.test(low) ||
    /\bi can see that\b/.test(low) ||
    /\bgood work on that one\b/.test(low) ||
    /\bso (?:your|for you,? (?:the )?(?:read|repair|instinct))\b/.test(low) ||
    /\bso your (?:read|repair|instinct)\b/.test(low);
  if (!hasClosureLead) return false;
  return !looksLikeScenarioARepairQuestion(t);
}

/**
 * Sanitize mutilation after contempt/repair strips: brief ack plus a dangling clause opener
 * (e.g. "Got it. That" from a truncated "That's all for that situation…" handoff).
 */
export function isTruncatedScenarioAHandoffFragment(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || textContainsScenarioBVignetteBody(t)) return false;
  if (/\?\s*$/.test(t)) return false;
  if (/^got it\.?\s+that\.?$/i.test(t)) return true;
  const low = t.toLowerCase();
  /** Stream/API cutoff mid segment-close (e.g. "Got it. That situation's" before "done"). */
  if (
    /^got it\.?\s+that situation'?s\.?$/i.test(t) ||
    (/^got it\.?\s+that situation'?s\b/i.test(t) &&
      !scenarioASegmentCloseDonePhrasePresent(t) &&
      t.length <= 48)
  ) {
    return true;
  }
  if (
    /^got it\.?\s+\S{1,20}\.?$/i.test(t) &&
    t.length <= 32 &&
    !/\bthat'?s all\b/.test(low) &&
    !/\bon to the next\b/.test(low) &&
    !/\bhere'?s the next\b/.test(low) &&
    !/\bsarah\b/.test(low)
  ) {
    return true;
  }
  return false;
}

/**
 * S1 segment-close / transition copy without the Scenario B vignette body — including truncated
 * `[SCENARIO_COMPLETE:1]` tails and "on to the next one" without Sarah/James.
 */
export function isScenarioAHandoffWithoutNextVignette(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || textContainsScenarioBVignetteBody(t)) return false;
  if (isTruncatedScenarioAHandoffFragment(t)) return true;
  const low = t.toLowerCase();
  if (/\[\s*$/.test(t)) return true;
  if (/\bsarah has been job hunting\b/.test(low)) return false;
  return (
    /\bthat'?s all for (?:that |this )?(?:situation|one)\b/.test(low) ||
    /\b(?:that )?wraps up (?:this|that|the (?:first|second|third)) situation\b/.test(low) ||
    /\bon to the next one\b/.test(low) ||
    /\bon to the next situation\b/.test(low) ||
    (/\bhere'?s the next (?:one|situation)\b/.test(low) && !/\bsarah\b/i.test(low))
  );
}

/**
 * S1→S2 boundary attempt without the Scenario B vignette — includes truncated streaming cutoffs
 * like "What came through was that you'd address the behavior directly".
 */
export function isScenarioABoundaryReflectionWithoutNextVignette(text: string): boolean {
  const t = (text ?? '').replace(/\s+/g, ' ').trim();
  if (!t || textContainsScenarioBVignetteBody(t)) return false;
  const low = t.toLowerCase();
  /** S2/S3 character beats must not match the Scenario A boundary detector. */
  if (/\bjames\b/.test(low) && /\bsarah\b/.test(low)) return false;
  if (/\bsophie\b/.test(low) && /\bdaniel\b/.test(low)) return false;
  if (
    /\b(?:here'?s the next situation|on to the second|sarah and james|sarah has been job hunting)\b/.test(
      low,
    )
  ) {
    return false;
  }
  if (isIncompleteScenarioABoundaryClosureLeadSentence(t)) return true;
  if (isScenarioAHandoffWithoutNextVignette(t)) return true;
  if (isTruncatedScenarioABoundaryReflectionOpener(t)) return true;
  if (isScenarioBoundaryPositiveAddressReflection(t)) return true;
  return (
    hasScenarioBoundaryWrapPhrase(t) ||
    scenarioASegmentCloseDonePhrasePresent(t) ||
    /\b(?:situation\s+1|that situation)\s+(?:is\s+)?(?:wrap(?:ped)?\s+up|done)\b/.test(low) ||
    /\bthat'?s situation\s+1\s+done\b/.test(low) ||
    /\bwhat i (?:heard|got) was\b/.test(low) ||
    /\bwhat came through was\b/.test(low) ||
    /\bwhat landed for me was\b/.test(low) ||
    /\byou (?:saw|recognized|picked up on|read|focused(?:\s+on)?)\b/.test(low) ||
    /\bi can see that\b/.test(low) ||
    /\bso (?:your (?:instinct|read|repair|inst)|for you,? (?:the )?(?:read|repair|instinct))\b/.test(
      low,
    ) ||
    /^so your inst(?:inct)?(?:\s+is)?(?:\s+that)?\b/i.test(t)
  );
}
