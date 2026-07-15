/**
 * Client-injected scenario → scenario and Moment 4 handoff copy for the live interview.
 * Transition leads omit the participant's first name; optional boundary reflections can be
 * re-enabled via {@link INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS}.
 */

import { resolveBoundaryReflectionForBundle } from './relationalPatternReflection';
import { buildPersonalMomentHandoffReflection } from './personalMomentHandoffReflection';
import type { BuildPersonalMomentHandoffReflectionOptions } from './personalMomentHandoffReflection';
import { MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT } from './moment5ProbeCopy';
import { SCENARIO_2_TEXT, SCENARIO_3_TEXT } from './interviewScenarioVignetteCopy';
import { MOMENT_4_GRUDGE_QUESTION_TEXT } from './moment4ProbeLogic';
import { remoteLog } from '@utilities/remoteLog';
import { textContainsScenarioBVignetteBody, textContainsScenarioCVignetteBody } from './scenarioVignetteBodyDetection';

/** Brief ack when M4 threshold reflection pipeline returns empty but the user did answer. */
const M4_THRESHOLD_TO_M5_ACK_FALLBACK = 'Thanks for sharing that.';

/**
 * When false, scenario + personal-moment boundary handoffs use only short wrap / pivot lines
 * (no "Nice work, {name} — …" or closing content reflections). Flip back to true to restore.
 * Covers S1→S2, S2→S3, S3→M4, M4→M5, and Moment 5 interview closings.
 */
export const INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS = false;

const BOUNDARY_POSITIVE_ADDRESSES = ['Nice work', 'Good work'] as const;

function resolveScenarioBoundaryReflection(
  firstName: string,
  lastUserAnswer: string | null | undefined,
  opts: { scenario: 1 | 2 | 3; reflectionOverride?: string },
): string {
  if (!INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS) return '';
  return resolveBoundaryReflectionForBundle(firstName, lastUserAnswer, opts);
}

function formatScenarioBoundaryLead(args: {
  segmentClose: string;
  transition: string;
  firstName: string;
  reflection: string;
  positiveAddressIndex?: number;
  fallbackWithoutReflection: string;
  completedScenario?: 1 | 2 | 3;
}): string {
  const reflection = args.reflection.trim();
  if (!reflection) {
    if (args.completedScenario && INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS) {
      void remoteLog('[BOUNDARY_REFLECTION_GENERIC_FALLBACK]', {
        completedScenario: args.completedScenario,
        reason: 'no_grounded_client_reflection',
        fallbackPreview: args.fallbackWithoutReflection.slice(0, 220),
      });
    }
    return args.fallbackWithoutReflection;
  }
  const address =
    BOUNDARY_POSITIVE_ADDRESSES[
      (args.positiveAddressIndex ?? 0) % BOUNDARY_POSITIVE_ADDRESSES.length
    ]!;
  const name = args.firstName.trim();
  const reflectionBody = reflection.replace(/\.\s*$/, '');
  const addressBlock = name
    ? `${address}, ${name} — ${reflectionBody}`
    : `${address} — ${reflectionBody}`;
  return `${args.segmentClose} ${addressBlock}. ${args.transition}`;
}

/** True when a scenario handoff bundle is missing the next segment vignette body. */
export function scenarioHandoffBundleMissingNextSegmentVignette(
  bundleText: string,
  completedScenario: 1 | 2 | 3,
): boolean {
  const t = (bundleText ?? '').trim();
  if (!t) return true;
  if (completedScenario === 1) return !textContainsScenarioBVignetteBody(t);
  if (completedScenario === 2) return !textContainsScenarioCVignetteBody(t);
  return false;
}

/**
 * Scenario boundary transitions — named per completed scenario (not an index array).
 * S1/S2 must never use S3→M4 "last of the three / two personal questions" language.
 */
/** Short S1→S2 close — no content reflection. Do not paraphrase Situation 2 vignette after this. */
export const SCENARIO_1_TO_2_TRANSITION =
  "Good work — that's the end of this scenario. Here's the next situation.";

export const SCENARIO_2_TO_3_TRANSITION =
  "That's the second one done. One more situation and then we'll get personal.";

/** @deprecated Prefer {@link SCENARIO_1_TO_2_TRANSITION} — kept as alias for existing imports. */
export const SCENARIO_1_TO_2_TRANSITION_FALLBACK = SCENARIO_1_TO_2_TRANSITION;

/** @deprecated Prefer {@link SCENARIO_2_TO_3_TRANSITION} — kept as alias for existing imports. */
export const SCENARIO_2_TO_3_TRANSITION_FALLBACK = SCENARIO_2_TO_3_TRANSITION;

/** S3 → M4 lead when no boundary reflection is available — do not reuse for S1/S2. */
export const MOMENT_4_HANDOFF_NO_NAME_LEAD =
  "Good work — you just finished the three situations. There are only two questions left. Now I want to ask you about something a bit more personal.";

/**
 * Assistant copy that opens Moment 4 (handoff and/or grudge question). Used by {@link inferPersonalMomentSlices}
 * so scoring does not depend on a single brittle substring when the model paraphrases the lead.
 */
export function assistantTextLooksLikeMoment4HandoffLead(text: string): boolean {
  const t = (text ?? '').toLowerCase();
  if (/held a grudge|really didn't like/.test(t)) return true;
  if (/really hard time with|got under your skin/.test(t)) return true;
  if (/finished the three situations/.test(t)) return true;
  if (/end of (the )?three (situations|described situations|vignettes)/.test(t)) return true;
  if (/done with those three scenarios?/.test(t)) return true;
  if (t.includes('three situations') && (t.includes('two questions') || t.includes('more about you'))) return true;
  if (t.includes("we're done with those three") || t.includes('done with those three')) return true;
  return false;
}

export function buildScenario1To2BundleForInterview(
  firstName: string,
  scenario2Text: string,
  lastUserAnswer?: string | null,
  opts?: { reflectionOverride?: string },
): string {
  const segmentClose = "Good work — that's the end of this scenario.";
  const transition = "Here's the next situation.";
  const reflection = resolveScenarioBoundaryReflection(firstName, lastUserAnswer, {
    scenario: 1,
    reflectionOverride: opts?.reflectionOverride,
  });
  const lead = formatScenarioBoundaryLead({
    segmentClose,
    transition,
    firstName,
    reflection,
    positiveAddressIndex: 0,
    fallbackWithoutReflection: SCENARIO_1_TO_2_TRANSITION,
    completedScenario: 1,
  });
  return `${lead}\n\n${scenario2Text}`.trim();
}

/** Client-injected Scenario A opening after the participant confirms readiness. */
export function buildScenario1VignetteIntroBundle(vignetteText: string, openingQuestion: string): string {
  return `Here's the first situation:\n\n${vignetteText.trim()}\n\n${openingQuestion.trim()}`.trim();
}

/**
 * Situation 1 → 2: model sometimes emits only Scenario B Q1 (vignette stripped). Repair with the canonical bundle.
 * Must not run mid–Scenario B (`currentScenario >= 2`) — moment index can lag behind scenario during S2.
 */
export function ensureScenario2BundleWhenOpeningWithoutVignette(
  text: string,
  interviewMoment: number,
  firstName: string,
  scenario2Text: string,
  currentScenario = 1,
): string {
  if (interviewMoment !== 1) return text;
  if (currentScenario >= 2) return text;
  const raw = text.trim();
  if (!raw || /sarah has been job hunting/i.test(raw)) return text;
  if (!/what do you think is going on here\??\s*$/i.test(raw)) return text;
  return buildScenario1To2BundleForInterview(firstName, scenario2Text).trim();
}

export function buildScenario2To3BundleForInterview(
  firstName: string,
  scenario3Text: string,
  lastUserAnswer?: string | null,
  opts?: { reflectionOverride?: string },
): string {
  const segmentClose = "That's the second one done.";
  const transition = "One more situation and then we'll get personal.";
  const reflection = resolveScenarioBoundaryReflection(firstName, lastUserAnswer, {
    scenario: 2,
    reflectionOverride: opts?.reflectionOverride,
  });
  const lead = formatScenarioBoundaryLead({
    segmentClose,
    transition,
    firstName,
    reflection,
    positiveAddressIndex: 0,
    fallbackWithoutReflection: SCENARIO_2_TO_3_TRANSITION,
    completedScenario: 2,
  });
  return `${lead}\n\n${scenario3Text}`.trim();
}

export function buildScenario2To3TransitionBody(
  firstName: string,
  scenario3Text: string,
  lastUserAnswer?: string | null,
): string {
  if ((lastUserAnswer ?? '').trim()) {
    return buildScenario2To3BundleForInterview(firstName, scenario3Text, lastUserAnswer);
  }
  return `${SCENARIO_2_TO_3_TRANSITION}\n\n${scenario3Text}`.trim();
}

/** Client-owned boundary handoff: reflection lead + canonical next-segment copy (vignette or personal card). */
export function buildClientScenarioBoundaryHandoffBundle(
  completedScenario: 1 | 2 | 3,
  firstName: string,
  userAnswers: { scenario1?: string; scenario2?: string; scenario3?: string },
  moment4PersonalCard: string,
  opts?: { reflectionOverride?: string },
): string {
  switch (completedScenario) {
    case 1:
      return buildScenario1To2BundleForInterview(
        firstName,
        SCENARIO_2_TEXT,
        userAnswers.scenario1,
        { reflectionOverride: opts?.reflectionOverride },
      );
    case 2:
      return buildScenario2To3BundleForInterview(
        firstName,
        SCENARIO_3_TEXT,
        userAnswers.scenario2,
        { reflectionOverride: opts?.reflectionOverride },
      );
    case 3:
      return buildScenario3ToMoment4BundleForInterview(
        firstName,
        moment4PersonalCard,
        userAnswers.scenario3,
        { reflectionOverride: opts?.reflectionOverride },
      );
  }
}

export function buildScenario3ToMoment4BundleForInterview(
  firstName: string,
  moment4PersonalCard: string,
  lastUserAnswer?: string | null,
  opts?: { reflectionOverride?: string },
): string {
  const segmentClose = "That's the end of the three described situations.";
  const transition =
    'There are only two questions left. Now I want to ask you about something a bit more personal.';
  const reflection = resolveScenarioBoundaryReflection(firstName, lastUserAnswer, {
    scenario: 3,
    reflectionOverride: opts?.reflectionOverride,
  });
  const lead = formatScenarioBoundaryLead({
    segmentClose,
    transition,
    firstName,
    reflection,
    positiveAddressIndex: 1,
    fallbackWithoutReflection: MOMENT_4_HANDOFF_NO_NAME_LEAD,
    completedScenario: 3,
  });
  return `${lead}\n\n${moment4PersonalCard}`.trim();
}

/** Ack + reflection + transition lead only (no next-segment vignette/card). */
export function buildScenarioBoundaryLeadForInterview(
  completedScenario: 1 | 2 | 3,
  firstName: string,
  lastUserAnswer?: string | null,
): string {
  const bundle =
    completedScenario === 1
      ? buildScenario1To2BundleForInterview(firstName, SCENARIO_2_TEXT, lastUserAnswer)
      : completedScenario === 2
        ? buildScenario2To3BundleForInterview(firstName, SCENARIO_3_TEXT, lastUserAnswer)
        : buildScenario3ToMoment4BundleForInterview(
            firstName,
            MOMENT_4_GRUDGE_QUESTION_TEXT,
            lastUserAnswer,
          );
  const split = bundle.indexOf('\n\n');
  return split > 0 ? bundle.slice(0, split).trim() : bundle.trim();
}

export function buildMoment4HandoffForInterview(
  firstName: string,
  moment4PersonalCard: string,
  lastUserAnswer?: string | null,
): string {
  if ((lastUserAnswer ?? '').trim()) {
    return buildScenario3ToMoment4BundleForInterview(firstName, moment4PersonalCard, lastUserAnswer);
  }
  return `${MOMENT_4_HANDOFF_NO_NAME_LEAD}\n\n${moment4PersonalCard}`;
}

/**
 * After the user answers the Moment 4 commitment-threshold follow-up: warm pivot + scripted Moment 5.
 * Content reflections are omitted while {@link INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS} is false.
 */
export function buildMoment4ThresholdAnswerToMoment5Bundle(
  firstName: string,
  moment5Question: string = MOMENT_5_ACCOUNTABILITY_QUESTION_TEXT,
  lastThresholdAnswer?: string | null,
  reflectionOpts?: BuildPersonalMomentHandoffReflectionOptions,
): string {
  void firstName;
  const pivot = "Here's one more question about you — still personal, and then we'll wrap up.";
  if (!INCLUDE_SCENARIO_BOUNDARY_REFLECTIONS) {
    return `${pivot}\n\n${moment5Question}`.trim();
  }
  const reflection = buildPersonalMomentHandoffReflection(lastThresholdAnswer ?? '', {
    ...reflectionOpts,
    context: 'm4_threshold_to_m5',
  });
  const ackOrReflection =
    reflection ||
    ((lastThresholdAnswer ?? '').trim().split(/\s+/).filter(Boolean).length >= 5
      ? M4_THRESHOLD_TO_M5_ACK_FALLBACK
      : '');
  if (ackOrReflection) {
    return `${ackOrReflection}\n\n${pivot}\n\n${moment5Question}`.trim();
  }
  return `${pivot}\n\n${moment5Question}`.trim();
}
