/**
 * Heuristic classification of user meta-comments (frustration, confusion, checking-in, skip_request,
 * inability, already_answered, ambiguous_short) before elongating / thin-response probes.
 * Uses weighted regex hits + fixed priority when multiple categories score above threshold (see code).
 */

import {
  isClientAudioRecoveryAssistantLine,
  NON_ENGLISH_VOICE_PROMPT,
} from './interviewLanguageGate';
import { isApprovedElongatingProbeOnly } from './elongatingProbe';
import { classifyExplicitRepeatRequestPreClassification } from './metaCommentConfusionRepeat';
import {
  metaScores,
  pickMetaFromScores,
  WEAK_THRESHOLD,
  withConfusionSubtype,
  wordCount,
} from './metaCommentPatternScoring';
import type {
  ConfusionSubtype,
  MetaCommentClassification,
  MetaCommentType,
} from '@features/aria/metaCommentClassificationTypes';

export type {
  ConfusionSubtype,
  InabilityOverrideDetail,
  InabilityOverrideTrigger,
  MetaCommentClassification,
  MetaCommentType,
} from '@features/aria/metaCommentClassificationTypes';

export { getInabilitySubstantiveOverrideDetail } from './metaCommentInabilityOverride';

function stripControlTokensMini(text: string): string {
  if (!text) return text;
  return text
    .replace(/\[INTERVIEW_COMPLETE\]/gi, '')
    .replace(/\[SCENARIO_COMPLETE:\s*\d+\]/gi, '')
    .replace(/\[CLOSING_QUESTION:\d+\]/gi, '')
    .replace(/\[STAGE_[123]_COMPLETE\]/g, '')
    .replace(/\[PROBE_TRIGGERED\]/gi, '')
    .replace(/\[SKEPTICISM_CHECK\]/gi, '')
    .trim();
}

/**
 * Whether assistant text counts as a substantive interview question delivery for meta-exemption resets.
 * Infra / ratio / silent-buffer prompts are non-substantive; short meta-only acks without a question are non-substantive.
 */
export function countsAsSubstantiveInterviewQuestionDelivery(text: string): boolean {
  const raw = stripControlTokensMini(text).trim();
  if (!raw) return false;
  if (raw === NON_ENGLISH_VOICE_PROMPT.trim()) return false;
  if (isClientAudioRecoveryAssistantLine(raw)) return false;
  if (/^i only caught part of that\b/i.test(raw)) return false;
  if (/^i didn't catch any speech on that try\b/i.test(raw)) return false;
  if (/i'?m having a little trouble on my end\b/i.test(raw)) return false;
  if (isApprovedElongatingProbeOnly(raw)) return false;
  const wc = wordCount(raw);
  /** Normal interview moves include a question mark; long transitions without `?` still count. */
  if (raw.includes('?')) return true;
  if (wc >= 22) return true;
  return false;
}

/** Prior turn counts as substantive iff ≥ minWords and classifier returns null (not a meta-comment). */
export function getPriorSubstantiveNonMetaUserContentInMoment(
  messages: Array<{
    role: string;
    content?: string;
    scenarioNumber?: number;
    interviewMoment?: number;
    isWelcomeBack?: boolean;
  }>,
  scenarioNumber: 1 | 2 | 3,
  currentMoment: number,
  minWords = 8
): string | null {
  const users = messages.filter(
    (m) =>
      m.role === 'user' &&
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      (m as { scenarioNumber?: number }).scenarioNumber === scenarioNumber
  );
  if (users.length === 0) return null;
  const lastUser = users[users.length - 1];
  const lastContent = (lastUser?.content ?? '').trim();
  /** When the latest user line is meta, exclude it; otherwise include it (current turn not appended yet). */
  const priorOnly =
    lastContent && classifyUserMetaComment(lastContent) != null ? users.slice(0, -1) : users;
  if (priorOnly.length === 0) return null;
  const hasMomentTag = priorOnly.some((m) => (m as { interviewMoment?: number }).interviewMoment != null);
  const pool = hasMomentTag
    ? priorOnly.filter((m) => (m as { interviewMoment?: number }).interviewMoment === currentMoment)
    : priorOnly;

  for (let i = pool.length - 1; i >= 0; i--) {
    const c = (pool[i].content ?? '').trim();
    if (wordCount(c) < minWords) continue;
    if (classifyUserMetaComment(c) != null) continue;
    return c;
  }
  return null;
}

/**
 * Classify meta-comment type. Runs before elongating-probe logic.
 * Uses priority order when multiple categories score ≥ 0.5. Below threshold for all categories:
 * short utterances (≤10 words) default to `ambiguous_short`; longer turns return null (normal answer).
 */
export function classifyUserMetaComment(text: string): MetaCommentClassification | null {
  const t = text.trim();
  if (!t) return null;

  const explicitRepeat = classifyExplicitRepeatRequestPreClassification(t);
  if (explicitRepeat) return explicitRepeat;

  const wc = wordCount(t);
  const scores = metaScores(t);
  const picked = pickMetaFromScores(scores);
  if (picked != null) {
    return withConfusionSubtype({ type: picked, confidence: Math.min(1, scores[picked]) }, t);
  }

  const bestWeak = Math.max(
    scores.frustration,
    scores.confusion,
    scores.checking_in,
    scores.inability,
    scores.already_answered,
    scores.skip_request
  );

  if (wc <= 10) {
    if (bestWeak >= WEAK_THRESHOLD) {
      const weakOrder: MetaCommentType[] = [
        'skip_request',
        'already_answered',
        'inability',
        'frustration',
        'checking_in',
        'confusion',
      ];
      for (const kind of weakOrder) {
        if (scores[kind] >= WEAK_THRESHOLD) {
          return withConfusionSubtype({ type: kind, confidence: scores[kind] }, t);
        }
      }
    }
    return withConfusionSubtype(
      { type: 'ambiguous_short', confidence: Math.max(0.35, bestWeak) },
      t
    );
  }

  return null;
}

/** Canonical response summary for session_logs (aira_response_delivered). */
export function getMetaCommentCanonicalResponseSummary(
  type: MetaCommentType,
  repeatedFrustration: boolean,
  confusionSubtype?: ConfusionSubtype | null,
  checkingInFrustrationAdjacent?: boolean
): string {
  if (repeatedFrustration) {
    return "No pressure at all — let's just keep going. We can move on whenever you're ready.";
  }
  switch (type) {
    case 'frustration':
      return 'Structured response: reflect prior clause if any → shortened re-ask → ask whether to skip with score warning (or I need to know… path).';
    case 'confusion':
      return confusionSubtype === 'repeat_request'
        ? 'Re-read current interview question in full (verbatim); no reframing, no elaboration/content probe.'
        : 'Simpler reframing of essential ask unless repeat-request subtype; no full vignette paste unless explicit repeat.';
    case 'checking_in':
      return checkingInFrustrationAdjacent === true
        ? 'Ownership + salient reflection + pivot forward (no same-question re-ask).'
        : "Yes — got it. That works perfectly.";
    case 'skip_request':
      return 'Are you sure you want to skip this one? We can, but it may affect your score.';
    case 'inability':
      return 'Low-pressure invitation to share whatever comes to mind; same question beat; no skip counted.';
    case 'already_answered':
      return 'Verify transcript — ownership + advance if prior substantive; otherwise frustration-style re-ask with skip offer.';
    case 'ambiguous_short':
      return 'Take your time — just say whatever comes to mind.';
  }
}
