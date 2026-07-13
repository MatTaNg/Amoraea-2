import {
  isReflectionDuplicateOfRegistry,
  type DeliveredReflectionRecord,
} from './deliveredReflectionRegistry';
import {
  closingAttributesUnsupportedAccountability,
  userAnswerIsExternallyBlamingOnly,
} from './closingReflectionGrounding';
import {
  combineMoment4UserTurnText,
  rejectUnanchoredPersonalMomentReflection,
  userAnswerHasReflectionAnchor,
} from './reflectionTranscriptGrounding';
import {
  buildPatternReflectionSentence,
  buildPersonalMomentObservationSentence,
  buildScenarioBoundaryConclusionSentence,
} from './relationalPatternReflection';
import { remoteLog } from '@utilities/remoteLog';

export type PersonalMomentHandoffReflectionContext =
  | 'm4_grudge_to_threshold'
  | 'm4_threshold_to_m5'
  | 'closing';

export type BuildPersonalMomentHandoffReflectionOptions = {
  context?: PersonalMomentHandoffReflectionContext;
  deliveredRegistry?: readonly DeliveredReflectionRecord[] | readonly string[];
  openerIndex?: number;
  /** Full Moment 4 user-turn corpus when available (grudge + threshold answers). */
  moment4Transcript?: readonly { role?: string; content?: string | null; interviewMoment?: number }[];
};

const CONTEXT_FALLBACKS: Record<PersonalMomentHandoffReflectionContext, readonly [string, string]> = {
  m4_grudge_to_threshold: [
    'You named who this was with and what still weighs on you from that falling-out.',
    'You focused on what happened in that hard relationship and where things stand now.',
  ],
  m4_threshold_to_m5: [
    'You spelled out what has to shift for you to keep working at it versus when walking away is right.',
    'You focused on naming your line between working through something and walking away.',
  ],
  closing: [
    'What stays with me is how you walked through a specific conflict and what shifted once you had some space.',
    'You named what happened in that relationship moment and how you found your way back to each other.',
  ],
};

function registryEntriesForReflectionContext(
  registry: readonly DeliveredReflectionRecord[] | readonly string[] | undefined,
  context: PersonalMomentHandoffReflectionContext,
): readonly DeliveredReflectionRecord[] | readonly string[] {
  if (!registry?.length) return [];
  if (typeof registry[0] === 'string') return registry;
  return (registry as DeliveredReflectionRecord[]).filter((entry) => entry.slot === context);
}

function thresholdExclusivePatternOnNonThresholdAnswer(userAnswer: string, pattern: string): boolean {
  const low = pattern.toLowerCase();
  const answer = (userAnswer ?? '').toLowerCase();
  if (
    /\b(anticipation flips|tipping point|walking away|work through|walk away)\b/.test(low) &&
    !/\b(grudge|falling out|fell out|resentment|hard time|got under your skin|apolog|betray)\b/i.test(
      answer,
    )
  ) {
    return true;
  }
  return false;
}

function buildContextPatternReflection(
  userAnswer: string,
  context: PersonalMomentHandoffReflectionContext,
  openerIndex?: number,
): string {
  const pattern = buildPatternReflectionSentence(userAnswer, { openerIndex });
  if (!pattern) return '';
  if (
    (context === 'm4_grudge_to_threshold' || context === 'closing') &&
    thresholdExclusivePatternOnNonThresholdAnswer(userAnswer, pattern)
  ) {
    return '';
  }
  if (closingAttributesUnsupportedAccountability(pattern, userAnswer)) return '';
  return pattern.replace(/\.\s*$/, '');
}

function pickContextFallback(
  context: PersonalMomentHandoffReflectionContext,
  deliveredRegistry?: readonly DeliveredReflectionRecord[] | readonly string[],
  reason?: string,
): string {
  for (const fallback of CONTEXT_FALLBACKS[context]) {
    if (!isReflectionDuplicateOfRegistry(deliveredRegistry ?? [], fallback)) {
      if (reason) {
        void remoteLog('[PERSONAL_MOMENT_REFLECTION_CONTEXT_FALLBACK]', {
          context,
          reason,
          preview: fallback.slice(0, 160),
        });
      }
      return fallback;
    }
  }
  return '';
}

function applyDeliveredRegistryDedup(
  candidate: string,
  context: PersonalMomentHandoffReflectionContext,
  deliveredRegistry?: readonly DeliveredReflectionRecord[] | readonly string[],
): string {
  const trimmed = candidate.trim();
  if (!trimmed) return '';
  const slotRegistry = registryEntriesForReflectionContext(deliveredRegistry, context);
  if (!slotRegistry.length || !isReflectionDuplicateOfRegistry(slotRegistry, trimmed)) {
    return trimmed;
  }
  return pickContextFallback(context, slotRegistry);
}

function buildPersonalMomentHandoffReflectionInternal(
  userAnswer: string,
  context: PersonalMomentHandoffReflectionContext,
  openerIndex?: number,
  groundingCorpus?: string,
): string {
  const trimmed = (userAnswer ?? '').trim();
  if (!trimmed || trimmed.split(/\s+/).filter(Boolean).length < 5) return '';
  if (userAnswerIsExternallyBlamingOnly(trimmed)) return '';

  const corpusForGrounding = (groundingCorpus ?? trimmed).trim() || trimmed;

  const personalObservation = buildPersonalMomentObservationSentence(trimmed);
  if (personalObservation) {
    if (closingAttributesUnsupportedAccountability(personalObservation, corpusForGrounding)) return '';
    return personalObservation.replace(/\.\s*$/, '');
  }

  const pattern = buildContextPatternReflection(trimmed, context, openerIndex);
  if (pattern) return pattern;

  const scenarioConclusion = buildScenarioBoundaryConclusionSentence(trimmed, { openerIndex });
  if (scenarioConclusion) {
    return scenarioConclusion.replace(/\.\s*$/, '');
  }

  if (trimmed.split(/\s+/).filter(Boolean).length >= 12 && userAnswerHasReflectionAnchor(corpusForGrounding)) {
    return pickContextFallback(context, undefined, 'heuristic_miss_with_anchor');
  }
  return '';
}

/** Client reflection before Moment 4→5 handoffs when the model omits one. */
export function buildPersonalMomentHandoffReflection(
  userAnswer: string,
  opts: BuildPersonalMomentHandoffReflectionOptions = {},
): string {
  const context = opts.context ?? 'm4_threshold_to_m5';
  const moment4Corpus = opts.moment4Transcript?.length
    ? combineMoment4UserTurnText(opts.moment4Transcript)
    : '';
  const groundingCorpus = moment4Corpus.trim() || (userAnswer ?? '').trim();
  const groundingForReject =
    context === 'm4_threshold_to_m5' ? (userAnswer ?? '').trim() || groundingCorpus : groundingCorpus;
  const candidate = buildPersonalMomentHandoffReflectionInternal(
    userAnswer,
    context,
    opts.openerIndex,
    groundingCorpus,
  );
  const grounded = rejectUnanchoredPersonalMomentReflection(candidate, groundingForReject);
  return applyDeliveredRegistryDedup(grounded, context, opts.deliveredRegistry);
}

/** Insert a reflection sentence between the task-ack and thanks lines of a neutral closing. */
export function assembleClosingWithOptionalReflection(
  neutralClosing: string,
  reflection: string,
): string {
  const trimmedReflection = reflection.trim();
  if (!trimmedReflection) return neutralClosing;
  const ack = neutralClosing.replace(/\s*thank you\b.*$/i, '').trim();
  const thanks = neutralClosing.match(/\bthank you\b.*$/i)?.[0] ?? '';
  const reflectionBody = trimmedReflection.endsWith('.') ? trimmedReflection : `${trimmedReflection}.`;
  return `${ack} ${reflectionBody} ${thanks}`.replace(/\s+/g, ' ').trim();
}
