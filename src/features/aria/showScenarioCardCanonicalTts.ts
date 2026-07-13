import {
  SHOW_SCENARIO_1_FULL_EXACT,
  SHOW_SCENARIO_1_OPENING_EXACT,
  SHOW_SCENARIO_1_VIGNETTE_EXACT,
  SHOW_SCENARIO_2_FULL_EXACT,
  SHOW_SCENARIO_2_OPENING_EXACT,
  SHOW_SCENARIO_2_VIGNETTE_EXACT,
  SHOW_SCENARIO_3_FULL_EXACT,
  SHOW_SCENARIO_3_OPENING_EXACT,
  SHOW_SCENARIO_3_VIGNETTE_EXACT,
} from '@features/aria/interviewShowScenarioExactCopy';
import { stripControlTokens } from '@features/aria/interviewControlTokens';
import {
  detectActiveScenarioFromMessage,
  SCENARIO_1_OPENING,
} from '@features/aria/interviewScenarioOpeningStreamGate';
import { looksLikeMoment4GrudgePrompt, MOMENT_4_GRUDGE_QUESTION_TEXT } from '@features/aria/moment4ProbeLogic';
import { assistantTextLooksLikeMoment4HandoffLead } from '@features/aria/interviewTransitionBundles';
import { hasScenarioBoundaryWrapPhrase } from '@features/aria/emotionModalTransitionOrchestration';
import { isPrematureStandaloneM4PersonalTransitionLine } from '@features/aria/prematureMoment4HandoffPlaybackGuard';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from '@features/aria/moment5ProbeCopy';
import {
  looksLikeScenarioAContemptProbeQuestion,
  spokenTextStartsMoment5PrimaryConflictQuestion,
  transcriptAssistantContainsMoment5PrimaryConflictQuestion,
} from '@features/aria/probeAndScoringUtils';
import { SCENARIO_1_VIGNETTE } from '@features/aria/interviewScenarioVignetteCopy';
import {
  looksLikeScenarioARepairQuestion,
  looksLikeScenarioARepairReAskQuestion,
} from '@features/aria/scenarioARepairQuestionHelpers';
import { isScenarioABoundaryReflectionWithoutNextVignette } from '@features/aria/scenarioAContemptProbeTextMatch';
import {
  isScenarioBBoundaryReflectionWithoutNextVignette,
  isScenarioBScriptedProbeForTts,
  looksLikeScenarioBFullAppreciationProbeQuestion,
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBQ1Question,
  looksLikeScenarioBRepairAsJamesQuestion,
} from '@features/aria/scenarioBProbeLogic';
import {
  isApprovedElongatingProbeOnly,
  looksLikeInterviewClosingAssistantMessage,
} from '@features/aria/elongatingProbe';
import {
  isSituation1ModalAdvancedPastOpening,
  type Situation1ModalDeliveryState,
} from '@features/aria/situation1ExactModalPrompt';
import {
  buildScenarioBoundaryLeadForInterview,
} from '@features/aria/interviewTransitionBundles';
import { resolveScenarioUserTextForBoundaryReflection } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import {
  reflectionLooksLikeGenericScenarioTheme,
  textHasScenarioBoundaryConclusion,
  reflectionLooksLikeKnownCannedBoundaryTemplate,
} from '@features/aria/relationalPatternReflection';
import { isScenarioBoundaryPositiveAddressReflection } from '@features/aria/interviewReflectionTextStrips';
import {
  isScenarioCQ1Prompt,
  isScenarioCRepairAssistantPrompt,
  looksLikeScenarioCSophiePerspectiveQuestion,
  transcriptContainsScenario3VignetteSetup,
} from '@features/aria/scenarioCPromptDetection';

export type ShowScenarioCardKind = 'situation_1' | 'situation_2' | 'situation_3' | 'moment_4' | 'moment_5';

export type ShowScenarioCardCanonicalPlaybackConfirmedKinds = Partial<
  Record<ShowScenarioCardKind, true>
>;

const SHOW_SCENARIO_CARD_BODY_START: Record<ShowScenarioCardKind, RegExp[]> = {
  situation_1: [/\bEmma and Ryan\b/i],
  situation_2: [
    /\bSarah has been job hunting\b/i,
    /\bSarah has been looking for work\b/i,
    /\bSarah was looking for work\b/i,
    /\bSarah (?:and James|has been)\b/i,
    /\bShe gets an offer\b/i,
    /\bHe gets an offer\b/i,
  ],
  situation_3: [/\bSophie and Daniel\b/i],
  moment_4: [
    /\bThink of someone you(?:'ve| have) had a really hard time with\b/i,
    /\bThink about someone you(?:'ve| have) had a really hard time with\b/i,
    /\bHave you ever held a grudge\b/i,
    /\bThink of someone you(?:'ve| have) really didn't like\b/i,
    /\bThink about someone you really didn't like\b/i,
    /\bIs there someone in your life\b/i,
    /\bsomeone from your past\b/i,
    /\bThink of someone who got under your skin\b/i,
    /\bNow I want to ask you about something\b/i,
  ],
  moment_5: [
    /\bThink of a time when you had a conflict with someone important to you\b/i,
    /\bThink of a time when you had a conflict with someone important\b/i,
  ],
};

function normalizeForCompare(text: string): string {
  return (text ?? '')
    .replace(/\u2019/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function isExactShowScenario1VignetteText(text: string): boolean {
  const norm = normalizeForCompare(stripControlTokens(text));
  return norm.includes(normalizeForCompare(SHOW_SCENARIO_1_VIGNETTE_EXACT));
}

export function isExactShowScenario1FullText(text: string): boolean {
  const norm = normalizeForCompare(stripControlTokens(text));
  return (
    norm.includes(normalizeForCompare(SHOW_SCENARIO_1_VIGNETTE_EXACT)) &&
    norm.includes(normalizeForCompare(SHOW_SCENARIO_1_OPENING_EXACT))
  );
}

export function isExactShowScenario2VignetteText(text: string): boolean {
  const norm = normalizeForCompare(stripControlTokens(text));
  return norm.includes(normalizeForCompare(SHOW_SCENARIO_2_VIGNETTE_EXACT));
}

export function isExactShowScenario2FullText(text: string): boolean {
  const norm = normalizeForCompare(stripControlTokens(text));
  return (
    norm.includes(normalizeForCompare(SHOW_SCENARIO_2_VIGNETTE_EXACT)) &&
    norm.includes(normalizeForCompare(SHOW_SCENARIO_2_OPENING_EXACT))
  );
}

export function isExactShowScenario3VignetteText(text: string): boolean {
  const norm = normalizeForCompare(stripControlTokens(text));
  return norm.includes(normalizeForCompare(SHOW_SCENARIO_3_VIGNETTE_EXACT));
}

export function isExactShowScenario3FullText(text: string): boolean {
  const norm = normalizeForCompare(stripControlTokens(text));
  return (
    norm.includes(normalizeForCompare(SHOW_SCENARIO_3_VIGNETTE_EXACT)) &&
    norm.includes(normalizeForCompare(SHOW_SCENARIO_3_OPENING_EXACT))
  );
}

export function isLockedShowScenarioExactTtsText(text: string): boolean {
  const trimmed = stripControlTokens(text).trim();
  if (!trimmed) return false;
  return (
    isExactShowScenario1VignetteText(trimmed) ||
    isExactShowScenario1FullText(trimmed) ||
    isExactShowScenario2VignetteText(trimmed) ||
    isExactShowScenario2FullText(trimmed) ||
    isExactShowScenario3VignetteText(trimmed) ||
    isExactShowScenario3FullText(trimmed)
  );
}

export function textContainsScenario1VignetteMarkers(text: string): boolean {
  const t = stripControlTokens(text).trim().toLowerCase();
  if (!t) return false;
  return (
    t.includes('emma and ryan') ||
    t.includes('ryan takes a call') ||
    t.includes('made that very clear')
  );
}

export function textContainsScenario2VignetteMarkers(text: string): boolean {
  const t = stripControlTokens(text).trim().toLowerCase();
  if (!t) return false;
  if (
    looksLikeScenarioBJamesDifferentlyQuestion(text) ||
    looksLikeScenarioBRepairAsJamesQuestion(text) ||
    looksLikeScenarioBFullAppreciationProbeQuestion(text)
  ) {
    return false;
  }
  return (
    t.includes('sarah has been job hunting') ||
    t.includes('sarah has been looking for work') ||
    t.includes('sarah was looking for work') ||
    (t.includes('sarah') &&
      t.includes('james') &&
      /job hunting for four months|gets an offer|never feels appreciated|fight starts/.test(t))
  );
}

export function textContainsScenario3VignetteMarkers(text: string): boolean {
  const t = stripControlTokens(text).trim().toLowerCase();
  if (!t) return false;
  return (
    t.includes('sophie and daniel') ||
    t.includes('same argument') ||
    (t.includes('daniel') && t.includes('i need ten minutes'))
  );
}

export function buildLockedShowScenarioCardTtsText(kind: ShowScenarioCardKind): string | null {
  switch (kind) {
    case 'situation_1':
      return SHOW_SCENARIO_1_FULL_EXACT;
    case 'situation_2':
      return SHOW_SCENARIO_2_FULL_EXACT;
    case 'situation_3':
      return SHOW_SCENARIO_3_FULL_EXACT;
    default:
      return null;
  }
}

/** Scenario just completed when canonical card opens the next situation (S2 card → S1 scored). */
export function completedScenarioForShowScenarioCardKind(
  kind: 'situation_1' | 'situation_2' | 'situation_3' | 'moment_4',
): 1 | 2 | 3 | null {
  if (kind === 'situation_2') return 1;
  if (kind === 'situation_3') return 2;
  if (kind === 'moment_4') return 3;
  return null;
}

export function resolveShowScenarioCardKindForInterview(args: {
  fullStream: string;
  interviewMoment?: number;
  interviewScenario?: number;
}): ShowScenarioCardKind | null {
  const kind = detectShowScenarioCardKind(args.fullStream);
  if (kind) return kind;
  if (
    args.interviewMoment === 2 &&
    args.interviewScenario === 2 &&
    textContainsScenario2VignetteMarkers(args.fullStream)
  ) {
    return 'situation_2';
  }
  if (
    args.interviewMoment === 1 &&
    /here'?s the next situation/i.test(args.fullStream) &&
    textContainsScenario2VignetteMarkers(args.fullStream)
  ) {
    return 'situation_2';
  }
  if (
    args.interviewMoment === 1 &&
    args.interviewScenario === 1 &&
    textContainsScenario1VignetteMarkers(args.fullStream)
  ) {
    return 'situation_1';
  }
  if (
    args.interviewScenario === 1 &&
    args.interviewMoment === 1 &&
    (hasScenarioBoundaryWrapPhrase(args.fullStream) ||
      /\bhere'?s the next situation\b/i.test(args.fullStream))
  ) {
    return 'situation_2';
  }
  if (
    args.interviewMoment === 2 &&
    args.interviewScenario === 2 &&
    textContainsScenario3VignetteMarkers(args.fullStream)
  ) {
    return 'situation_3';
  }
  if (
    args.interviewScenario === 2 &&
    args.interviewMoment === 2 &&
    (hasScenarioBoundaryWrapPhrase(args.fullStream) ||
      /\bhere'?s the third situation\b/i.test(args.fullStream) ||
      /\bthat scenario is complete\b/i.test(args.fullStream))
  ) {
    return 'situation_3';
  }
  if (
    args.interviewMoment === 2 &&
    args.interviewScenario === 3 &&
    textContainsScenario3VignetteMarkers(args.fullStream)
  ) {
    return 'situation_3';
  }
  if (
    args.interviewScenario === 3 &&
    (args.interviewMoment ?? 5) <= 4 &&
    (looksLikeMoment4GrudgePrompt(args.fullStream) ||
      assistantTextLooksLikeMoment4HandoffLead(args.fullStream) ||
      (args.interviewMoment === 3 &&
        isPrematureStandaloneM4PersonalTransitionLine(args.fullStream)))
  ) {
    return 'moment_4';
  }
  return null;
}

export function shouldSuppressParallelStreamNonExactShowScenarioCardSpeech(args: {
  spokenForTts: string;
  interviewMoment: number;
  interviewScenario: number;
  showScenarioCardCanonicalSpokenThisStream: boolean;
  fullStream?: string;
}): boolean {
  if (args.showScenarioCardCanonicalSpokenThisStream) return false;
  const spoken = stripControlTokens(args.spokenForTts).trim();
  const fullStream = stripControlTokens(args.fullStream ?? args.spokenForTts).trim();
  const handoffSituation2 =
    resolveShowScenarioCardKindForInterview({
      fullStream,
      interviewMoment: args.interviewMoment,
      interviewScenario: args.interviewScenario,
    }) === 'situation_2' &&
    args.interviewScenario === 1 &&
    args.interviewMoment === 1;
  const handoffSituation3 =
    resolveShowScenarioCardKindForInterview({
      fullStream,
      interviewMoment: args.interviewMoment,
      interviewScenario: args.interviewScenario,
    }) === 'situation_3' &&
    args.interviewScenario === 2 &&
    args.interviewMoment === 2;
  const handoffMoment4 =
    resolveShowScenarioCardKindForInterview({
      fullStream,
      interviewMoment: args.interviewMoment,
      interviewScenario: args.interviewScenario,
    }) === 'moment_4' &&
    args.interviewScenario === 3 &&
    args.interviewMoment === 3;
  // Canonical card delivers S2 at S1→S2 boundaries — never duplicate via parallel stream.
  if (handoffSituation2) {
    if (
      textContainsScenario2VignetteMarkers(spoken) ||
      /\bSarah (?:and James|has been)\b/i.test(spoken)
    ) {
      return true;
    }
    if (hasScenarioBoundaryWrapPhrase(spoken)) return true;
    if (isScenarioHandoffTransitionPhraseOnly(spoken)) return true;
    if (isScenarioABoundaryReflectionWithoutNextVignette(spoken)) return true;
    if (isScenarioBoundaryPositiveAddressReflection(spoken)) return true;
  }
  // Canonical card delivers S3 at S2→S3 boundaries — never duplicate via parallel stream.
  if (handoffSituation3) {
    if (textContainsScenario3VignetteMarkers(spoken)) return true;
    if (hasScenarioBoundaryWrapPhrase(spoken)) return true;
    if (isScenarioHandoffTransitionPhraseOnly(spoken)) return true;
    if (isScenarioBBoundaryReflectionWithoutNextVignette(spoken)) return true;
    if (isScenarioBoundaryPositiveAddressReflection(spoken)) return true;
    if (/\bhere'?s the next situation\b/i.test(spoken)) return true;
  }
  if (handoffMoment4) {
    if (looksLikeMoment4GrudgePrompt(spoken)) return true;
    if (assistantTextLooksLikeMoment4HandoffLead(spoken)) return true;
    if (isPrematureStandaloneM4PersonalTransitionLine(spoken)) return true;
    if (/\bend of the three described situations\b/i.test(spoken)) return true;
    if (/\bend of the three situations\b/i.test(spoken)) return true;
    if (/\btwo questions left\b/i.test(spoken) && /\bmore personal\b/i.test(spoken)) {
      return true;
    }
  }
  // Canonical S1 scripted follow-ups must always reach TTS (repair contains "if you were Ryan").
  if (
    looksLikeScenarioAContemptProbeQuestion(spoken) ||
    looksLikeScenarioARepairQuestion(spoken) ||
    looksLikeScenarioARepairReAskQuestion(spoken)
  ) {
    return false;
  }
  if (isScenarioBScriptedProbeForTts(spoken) && !textContainsScenario2VignetteMarkers(spoken)) {
    return false;
  }
  if (
    args.interviewMoment === 1 &&
    args.interviewScenario === 1 &&
    (isShowScenarioCardFollowUpProbeSentence(args.spokenForTts) ||
      /\b(if you were ryan|you were ryan)\b/i.test(args.spokenForTts))
  ) {
    return true;
  }
  const kind = resolveShowScenarioCardKindForInterview({
    fullStream: args.spokenForTts,
    interviewMoment: args.interviewMoment,
    interviewScenario: args.interviewScenario,
  });
  if (kind === 'situation_1') {
    if (isExactShowScenario1FullText(args.spokenForTts)) return false;
    return textContainsScenario1VignetteMarkers(args.spokenForTts);
  }
  if (kind === 'situation_2') {
    if (isExactShowScenario2FullText(args.spokenForTts)) return false;
    return textContainsScenario2VignetteMarkers(args.spokenForTts);
  }
  if (kind === 'situation_3') {
    if (isExactShowScenario3FullText(args.spokenForTts)) return false;
    return textContainsScenario3VignetteMarkers(args.spokenForTts);
  }
  return false;
}

export function isScenarioHandoffTransitionPhraseOnly(text: string): boolean {
  const t = stripControlTokens(text).trim();
  if (!t) return false;
  return (
    /^here'?s the next situation\.?$/i.test(t) ||
    /^on to the (?:second|next|third) situation\.?$/i.test(t) ||
    /^here'?s the third situation\b/i.test(t)
  );
}

function stripPrefixSentencesAlreadyInSpoken(prefix: string, spokenNorm: string): string {
  const sentences = prefix.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [prefix];
  const kept = sentences
    .map((s) => s.trim())
    .filter((s) => {
      const norm = normalizeForCompare(s);
      return norm.length > 0 && !spokenNorm.includes(norm);
    });
  return kept.join(' ').trim();
}

/**
 * Model sometimes streams a vignette-theme reflection before the client boundary lead.
 * Treat those as not-yet-spoken so the grounded client lead still plays.
 */
function spokenBoundaryReflectionIsGenericThemeOnly(spokenSoFar: string): boolean {
  const spoken = (spokenSoFar ?? '').trim();
  if (!spoken) return false;
  if (!textHasScenarioBoundaryConclusion(spoken) && !/\byou (?:focused on|named|framed|pointed to|highlighted|saw|recognized|picked up on|read)\b/i.test(spoken)) {
    return false;
  }
  const sentences = spoken.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [spoken];
  const reflectionLike = sentences
    .map((s) => s.trim())
    .filter(
      (s) =>
        textHasScenarioBoundaryConclusion(s) ||
        /\byou (?:focused on|named|framed|pointed to|highlighted|saw|recognized|picked up on|read)\b/i.test(s),
    );
  if (reflectionLike.length === 0) return false;
  if (reflectionLike.some((s) => reflectionLooksLikeKnownCannedBoundaryTemplate(s))) {
    return true;
  }
  return reflectionLike.every((s) => reflectionLooksLikeGenericScenarioTheme(s));
}

function stripBoundaryReflectionSentencesFromPrefix(prefix: string): string {
  const sentences = prefix.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [prefix];
  return sentences
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 0 &&
        !isScenarioBoundaryPositiveAddressReflection(s) &&
        !(
          textHasScenarioBoundaryConclusion(s) &&
          /\byou (?:focused|saw|recognized|picked up on|read|named)\b/i.test(s)
        ),
    )
    .join(' ')
    .trim();
}

export function mergeShowScenarioCardTransitionPrefixWithSpoken(
  prefix: string,
  spokenSoFar: string,
): string {
  let p = (prefix ?? '').trim();
  const spoken = (spokenSoFar ?? '').trim();
  if (!p) return '';
  if (!spoken) return p;
  /**
   * Generic vignette-theme reflections must not silence the client-grounded lead —
   * keep returning the full client prefix so it can replace the weak model line.
   */
  if (spokenBoundaryReflectionIsGenericThemeOnly(spoken) && textHasScenarioBoundaryConclusion(p)) {
    return p;
  }
  const spokenNorm = normalizeForCompare(spoken);
  const prefixNorm = normalizeForCompare(p);
  if (spokenNorm.includes(prefixNorm)) return '';
  const ackMatch = p.match(/^(Got it\.|Makes sense\.|Well done\.|Good work\.)\s*/i);
  if (ackMatch && spokenNorm.includes(normalizeForCompare(ackMatch[1]!))) {
    p = p.slice(ackMatch[0].length).trim();
  }
  if (
    isScenarioBoundaryPositiveAddressReflection(spoken) ||
    (textHasScenarioBoundaryConclusion(spoken) &&
      /\b(?:nice|good)\s+work\b/i.test(spoken))
  ) {
    p = stripBoundaryReflectionSentencesFromPrefix(p);
  }
  return stripPrefixSentencesAlreadyInSpoken(p, spokenNorm);
}

/** True when canonical show-scenario-card long-form TTS already delivered a bundled S1→S2 (etc.) handoff. */
export function parallelStreamDeliveredBundledHandoffViaCanonicalCard(
  playbackConfirmedKinds: ShowScenarioCardCanonicalPlaybackConfirmedKinds,
  assistantContentToPersist: string,
): boolean {
  const expected = stripControlTokens(assistantContentToPersist).trim();
  if (!expected) return false;
  if (
    isShowScenarioCardCanonicalPlaybackConfirmed(playbackConfirmedKinds, 'situation_2') &&
    (textContainsScenario2VignetteMarkers(expected) || isExactShowScenario2FullText(expected))
  ) {
    return true;
  }
  if (
    isShowScenarioCardCanonicalPlaybackConfirmed(playbackConfirmedKinds, 'situation_3') &&
    (textContainsScenario3VignetteMarkers(expected) || isExactShowScenario3FullText(expected))
  ) {
    return true;
  }
  if (
    isShowScenarioCardCanonicalPlaybackConfirmed(playbackConfirmedKinds, 'moment_4') &&
    (looksLikeMoment4GrudgePrompt(expected) || assistantTextLooksLikeMoment4HandoffLead(expected))
  ) {
    return true;
  }
  return false;
}

/** Prefer client-injected boundary lead (ack + reflection + transition) over model paraphrase. */
export function resolveClientScenarioBoundaryPrefixForCanonicalTts(args: {
  kind: ShowScenarioCardKind;
  messages: ReadonlyArray<{ role: string; content?: string; scenarioNumber?: number }>;
  firstName: string;
  extractedPrefix: string;
}): string {
  const completingScenario =
    args.kind === 'situation_2' ? 1 : args.kind === 'situation_3' ? 2 : args.kind === 'moment_4' ? 3 : null;
  if (!completingScenario) return args.extractedPrefix.trim();
  const userCorpus = resolveScenarioUserTextForBoundaryReflection(
    args.messages as Parameters<typeof resolveScenarioUserTextForBoundaryReflection>[0],
    completingScenario,
  );
  const clientLead = buildScenarioBoundaryLeadForInterview(
    completingScenario,
    args.firstName,
    userCorpus || null,
  );
  return clientLead;
}

export function composeShowScenarioCardTtsWithTransitionPrefix(args: {
  prefix: string;
  canonicalText: string;
  spokenSoFar: string;
  transitionAlreadySpoken: boolean;
}): string {
  const canonical = (args.canonicalText ?? '').trim();
  if (args.transitionAlreadySpoken || !args.prefix.trim()) return canonical;
  const mergedPrefix = mergeShowScenarioCardTransitionPrefixWithSpoken(args.prefix, args.spokenSoFar);
  if (!mergedPrefix) return canonical;
  return `${mergedPrefix}\n\n${canonical}`.replace(/\n{3,}/g, '\n\n').trim();
}

/** True when parallel stream already delivered the boundary closing lead, not just the next card body. */
export function streamAlreadySpokeScenarioBoundaryClosingLead(
  streamSpokeText: string,
  scenarioJustCompleted: 1 | 2 | 3,
): boolean {
  const stream = (streamSpokeText ?? '').trim();
  const streamLower = stream.toLowerCase().replace(/\s+/g, ' ');
  if (!streamLower.trim()) return false;
  /** Generic theme-only reflections do not count as a completed grounded boundary lead. */
  if (spokenBoundaryReflectionIsGenericThemeOnly(stream)) {
    return false;
  }
  if (scenarioJustCompleted === 1) {
    return (
      (streamLower.includes("that's a wrap on this situation") ||
        streamLower.includes("that's a wrap on that one") ||
        streamLower.includes("that's the end of this situation") ||
        streamLower.includes("that's the end of that situation") ||
        streamLower.includes("we've got two more situations")) &&
      (/\bnext situation\b/.test(streamLower) ||
        /\btwo more situations\b/.test(streamLower) ||
        /\bnice work\b/.test(streamLower) ||
        /\bgood work\b/.test(streamLower))
    );
  }
  if (scenarioJustCompleted === 2) {
    return (
      /\bthat scenario is complete\b/.test(streamLower) ||
      /\bsecond one done\b/.test(streamLower) ||
      /\bone more situation and then we'?ll get personal\b/.test(streamLower) ||
      (/\bnice work\b/.test(streamLower) &&
        (/\bthird situation\b/.test(streamLower) || /\bget personal\b/.test(streamLower)))
    );
  }
  return (
    /\bend of the three described situations\b/.test(streamLower) ||
    /\bend of the three situations\b/.test(streamLower) ||
    (/\b(?:nice|good) work\b/.test(streamLower) && /\btwo questions left\b/.test(streamLower)) ||
    (/\b(?:nice|good) work\b/.test(streamLower) &&
      /\b(?:more personal|personal questions)\b/.test(streamLower))
  );
}

export function resolveShowScenarioCardTransitionAlreadySpoken(args: {
  prefix: string;
  spokenSoFar: string;
  scenarioJustCompleted?: 1 | 2 | 3;
}): boolean {
  const prefix = (args.prefix ?? '').trim();
  if (!prefix) return false;
  if (
    args.scenarioJustCompleted &&
    streamAlreadySpokeScenarioBoundaryClosingLead(args.spokenSoFar, args.scenarioJustCompleted)
  ) {
    return true;
  }
  const mergedPrefix = mergeShowScenarioCardTransitionPrefixWithSpoken(prefix, args.spokenSoFar);
  return !mergedPrefix.trim();
}

export function splitParallelBatchBeforeShowScenarioCardBody(
  batchText: string,
  kind: ShowScenarioCardKind,
): { transitionPrefix: string; hadVignetteBody: boolean } {
  const trimmed = batchText.trim();
  if (!trimmed) return { transitionPrefix: '', hadVignetteBody: false };
  const start = findShowScenarioCardBodyStartIndex(trimmed, kind);
  if (start < 0) return { transitionPrefix: trimmed, hadVignetteBody: false };
  return {
    transitionPrefix: trimmed.slice(0, start).trim(),
    hadVignetteBody: true,
  };
}

export function buildCanonicalShowScenarioCardTtsBody(kind: ShowScenarioCardKind): string {
  switch (kind) {
    case 'situation_1':
      return `${SCENARIO_1_VIGNETTE}\n\n${SCENARIO_1_OPENING}`;
    case 'situation_2':
      return `${SHOW_SCENARIO_2_VIGNETTE_EXACT}\n\n${SHOW_SCENARIO_2_OPENING_EXACT}`;
    case 'situation_3':
      return `${SHOW_SCENARIO_3_VIGNETTE_EXACT}\n\n${SHOW_SCENARIO_3_OPENING_EXACT}`;
    case 'moment_4':
      return MOMENT_4_GRUDGE_QUESTION_TEXT;
    case 'moment_5':
      return MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT;
  }
}

export function detectShowScenarioCardKind(fullText: string): ShowScenarioCardKind | null {
  const t = stripControlTokens(fullText).trim();
  if (!t) return null;

  if (
    transcriptAssistantContainsMoment5PrimaryConflictQuestion(t) ||
    spokenTextStartsMoment5PrimaryConflictQuestion(t)
  ) {
    return 'moment_5';
  }

  if (
    looksLikeMoment4GrudgePrompt(t) ||
    (t.toLowerCase().includes("really didn't like") && t.toLowerCase().includes('someone')) ||
    (t.toLowerCase().includes('held a grudge') && t.toLowerCase().includes('someone'))
  ) {
    return 'moment_4';
  }

  const scenario = detectActiveScenarioFromMessage(t);
  if (!scenario) return null;
  switch (scenario.label) {
    case 'Situation 1':
      return 'situation_1';
    case 'Situation 2':
      return 'situation_2';
    case 'Situation 3':
      return 'situation_3';
    default:
      return null;
  }
}

export function findShowScenarioCardBodyStartIndex(fullText: string, kind: ShowScenarioCardKind): number {
  const patterns = SHOW_SCENARIO_CARD_BODY_START[kind];
  let earliest = -1;
  for (const re of patterns) {
    const m = re.exec(fullText);
    if (!m) continue;
    if (earliest < 0 || m.index < earliest) earliest = m.index;
  }
  return earliest;
}

export function extractShowScenarioCardTransitionPrefix(fullText: string, kind: ShowScenarioCardKind): string {
  const start = findShowScenarioCardBodyStartIndex(fullText, kind);
  if (start <= 0) return '';
  return fullText.slice(0, start).trim();
}

export function buildCanonicalShowScenarioCardTtsFromStream(fullText: string): string | null {
  const kind = detectShowScenarioCardKind(fullText);
  if (!kind) return null;
  // Character-name reflections (e.g. S2 closing "you recognized… Sarah… celebrate") must not
  // invent a full vignette card when no vignette body start is present in the stream text.
  const bodyStart = findShowScenarioCardBodyStartIndex(fullText, kind);
  if (bodyStart < 0) return null;
  const canonicalBody = buildCanonicalShowScenarioCardTtsBody(kind);
  const prefix = fullText.slice(0, bodyStart).trim();
  if (!prefix) return canonicalBody;
  return `${prefix}\n\n${canonicalBody}`.replace(/\n{3,}/g, '\n\n').trim();
}

export function isShowScenarioCardCanonicalPlaybackConfirmed(
  confirmed: ShowScenarioCardCanonicalPlaybackConfirmedKinds,
  kind: ShowScenarioCardKind,
): boolean {
  return confirmed[kind] === true;
}

/** Skip replaying the Situation 1 opening card after contempt/repair or when opening TTS already confirmed. */
export function shouldSkipSituation1CanonicalReplay(args: {
  playbackConfirmedKinds: ShowScenarioCardCanonicalPlaybackConfirmedKinds;
  delivery?: Situation1ModalDeliveryState | null;
  lastQuestionText?: string | null;
  contemptSpokeThisStream?: boolean;
}): boolean {
  if (args.contemptSpokeThisStream) return true;
  if (isShowScenarioCardCanonicalPlaybackConfirmed(args.playbackConfirmedKinds, 'situation_1')) {
    return true;
  }
  return isSituation1ModalAdvancedPastOpening(args.delivery, args.lastQuestionText);
}

export function isShowScenarioCardCanonicalDeliveryText(text: string): ShowScenarioCardKind | null {
  const trimmed = stripControlTokens(text).trim();
  if (!trimmed) return null;
  const kind = detectShowScenarioCardKind(trimmed);
  if (!kind) return null;
  const canonical = buildCanonicalShowScenarioCardTtsBody(kind);
  const norm = normalizeForCompare(trimmed);
  const canonicalNorm = normalizeForCompare(canonical);
  const vignetteNorm = normalizeForCompare(canonical.split('\n\n')[0] ?? canonical);
  if (norm.includes(canonicalNorm) || (vignetteNorm.length > 40 && norm.includes(vignetteNorm))) {
    return kind;
  }
  return null;
}

export function shouldTreatShowScenarioCardCanonicalAsAlreadyDelivered(args: {
  messages: ReadonlyArray<{ role: string; content?: string }>;
  kind: ShowScenarioCardKind;
  playbackConfirmedKinds: ShowScenarioCardCanonicalPlaybackConfirmedKinds;
}): boolean {
  if (args.kind === 'situation_3') {
    return (
      transcriptContainsScenario3VignetteSetup(args.messages) &&
      isShowScenarioCardCanonicalPlaybackConfirmed(args.playbackConfirmedKinds, args.kind)
    );
  }
  return (
    transcriptContainsCanonicalShowScenarioCardBody(args.messages, args.kind) &&
    isShowScenarioCardCanonicalPlaybackConfirmed(args.playbackConfirmedKinds, args.kind)
  );
}

export function transcriptContainsCanonicalShowScenarioCardBody(
  messages: ReadonlyArray<{ role: string; content?: string }>,
  kind: ShowScenarioCardKind,
): boolean {
  const canonical = buildCanonicalShowScenarioCardTtsBody(kind);
  const canonicalNorm = normalizeForCompare(canonical);
  const vignetteOnlyNorm = normalizeForCompare(canonical.split('\n\n')[0] ?? canonical);
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== 'assistant') continue;
    const c = normalizeForCompare(stripControlTokens(m.content ?? ''));
    if (!c) continue;
    if (c.includes(canonicalNorm) || c.includes(vignetteOnlyNorm)) return true;
  }
  return false;
}

/** Follow-up probes within a scenario — never replace with the opening Show Scenario card. */
export function isShowScenarioCardFollowUpProbeSentence(text: string): boolean {
  const t = stripControlTokens(text).trim();
  if (!t) return false;
  if (looksLikeScenarioAContemptProbeQuestion(t)) return true;
  if (looksLikeScenarioARepairQuestion(t) || looksLikeScenarioARepairReAskQuestion(t)) return true;
  if (looksLikeScenarioBJamesDifferentlyQuestion(t)) return true;
  if (looksLikeScenarioBQ1Question(t)) return true;
  if (looksLikeScenarioBFullAppreciationProbeQuestion(t)) return true;
  if (looksLikeScenarioBRepairAsJamesQuestion(t)) return true;
  if (isApprovedElongatingProbeOnly(t)) return true;
  if (looksLikeInterviewClosingAssistantMessage(t)) return true;
  if (isScenarioCQ1Prompt(t)) return true;
  if (looksLikeScenarioCSophiePerspectiveQuestion(t)) return true;
  if (isScenarioCRepairAssistantPrompt(t)) return true;
  return false;
}

export function shouldArmShowScenarioCardStreamMute(args: {
  sentence: string;
  fullStream: string;
  messagesToUse: ReadonlyArray<{ role: string; content?: string }>;
  streamShowScenarioCardMuteActive: boolean;
  showScenarioCardCanonicalSpokenThisStream: boolean;
  streamContemptProbeMuteActive: boolean;
  playbackConfirmedKinds?: ShowScenarioCardCanonicalPlaybackConfirmedKinds;
  interviewMoment?: number;
  interviewScenario?: number;
}): boolean {
  if (args.streamShowScenarioCardMuteActive || args.showScenarioCardCanonicalSpokenThisStream) return false;
  if (args.streamContemptProbeMuteActive) return false;
  if (isShowScenarioCardFollowUpProbeSentence(args.sentence)) return false;

  const kind = resolveShowScenarioCardKindForInterview({
    fullStream: args.fullStream,
    interviewMoment: args.interviewMoment,
    interviewScenario: args.interviewScenario,
  });
  if (!kind) return false;
  if (
    shouldTreatShowScenarioCardCanonicalAsAlreadyDelivered({
      messages: args.messagesToUse,
      kind,
      playbackConfirmedKinds: args.playbackConfirmedKinds ?? {},
    })
  ) {
    return false;
  }

  const start = findShowScenarioCardBodyStartIndex(args.fullStream, kind);
  if (start < 0) return false;

  const sentenceStart = args.fullStream.lastIndexOf(stripControlTokens(args.sentence).trim());
  if (sentenceStart >= start) return true;

  return findShowScenarioCardBodyStartIndex(stripControlTokens(args.sentence).trim(), kind) >= 0;
}

export function streamSpokenTextAlreadyMatchesCanonicalCard(
  spokenCompleteText: string,
  fullStream: string,
): boolean {
  const kind = detectShowScenarioCardKind(fullStream);
  if (!kind) return false;
  if (kind === 'situation_2') return isExactShowScenario2FullText(spokenCompleteText);
  if (kind === 'situation_1') return isExactShowScenario1FullText(spokenCompleteText);
  if (kind === 'situation_3') return isExactShowScenario3FullText(spokenCompleteText);
  const canonical = buildCanonicalShowScenarioCardTtsFromStream(fullStream);
  if (!canonical) return false;
  const spokenNorm = normalizeForCompare(spokenCompleteText);
  const canonicalNorm = normalizeForCompare(canonical);
  const bodyNorm = normalizeForCompare(buildCanonicalShowScenarioCardTtsBody(kind));
  return spokenNorm.includes(canonicalNorm) || spokenNorm.includes(bodyNorm);
}

/** @internal test hooks */
export const __showScenarioCardCanonicalTtsTest = {
  normalizeForCompare,
  findShowScenarioCardBodyStartIndex,
};
