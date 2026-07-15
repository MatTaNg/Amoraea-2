import {
  isScenarioThreeToMoment4EmotionModalHandoff,
  splitScenarioTransitionForEmotionModal,
} from '@features/aria/emotionModalTransitionOrchestration';
import {
  textContainsScenarioBVignetteBody,
  textContainsScenarioCVignetteBody,
} from '@features/aria/emotionScenarioTransitionInference';
import { MOMENT_4_PERSONAL_CARD } from '@features/aria/interviewMomentScenarioConfig';
import { shouldRedirectPrematureMoment4ToScenario2To3Handoff } from '@features/aria/prematureMoment4HandoffPlaybackGuard';
import {
  buildClientScenarioBoundaryHandoffBundle,
  assistantTextLooksLikeMoment4HandoffLead,
} from '@features/aria/interviewTransitionBundles';
import {
  isScenarioABoundaryReflectionWithoutNextVignette,
  isScenarioAHandoffWithoutNextVignette,
} from '@features/aria/scenarioAContemptProbeTextMatch';
import type { PostClaudeInterviewMessage } from '@features/aria/postClaudeAssistantTurnTypes';
import {
  textHasScenarioBoundaryConclusion,
  extractScenarioBoundaryReflectionFromHandoff,
  reflectionCoreLooksLikeCopiedUserClause,
  reflectionLooksLikeVerbatimInferenceEcho,
  extractedBoundaryReflectionIsUnsafeForUserCorpus,
  boundaryConclusionPassesQualityBar,
} from '@features/aria/relationalPatternReflection';
import { looksLikeInterviewClosingAssistantMessage } from '@features/aria/elongatingProbe';
import {
  isScenarioBBoundaryReflectionWithoutNextVignette,
  isScenarioBQ1Prompt,
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
  resolveScenarioBNextRequiredFollowUpPrompt,
  scenarioBMinimumEngagementForHandoff,
  scenarioBJamesRepairProbeAlreadySatisfied,
} from '@features/aria/scenarioBProbeLogic';
import {
  resolveScenarioANextRequiredFollowUpPrompt,
  scenarioAMinimumEngagementForHandoff,
  stripPrematureScenarioABoundaryFromDraft,
} from '@features/aria/scenarioFollowUpTranscriptGuard';
import { resolveScenarioUserTextForBoundaryReflection } from '@features/aria/interviewScenarioAdvanceAfterRepair';
import {
  isIncompleteScenarioCBoundaryClosureLeadSentence,
  isScenarioCBoundaryReflectionWithoutMoment4Handoff,
} from '@features/aria/scenarioCPromptDetection';
import { remoteLog } from '@utilities/remoteLog';

function resolveActiveScenario(
  currentScenario: number | null | undefined,
  interviewMoment: number,
): number {
  if (currentScenario === 1 || currentScenario === 2 || currentScenario === 3) {
    return currentScenario;
  }
  return interviewMoment;
}

function isScenarioOneBoundaryHandoffCue(raw: string): boolean {
  return (
    textContainsScenarioBVignetteBody(raw) ||
    isScenarioAHandoffWithoutNextVignette(raw) ||
    isScenarioABoundaryReflectionWithoutNextVignette(raw)
  );
}

function scenarioOneHandoffContext(activeScenario: number, interviewMoment: number): boolean {
  if (activeScenario === 1) return true;
  if (activeScenario === 2 && interviewMoment <= 2) return true;
  return false;
}

function boundaryUserAnswers(messages: PostClaudeInterviewMessage[]) {
  return {
    scenario1: resolveScenarioUserTextForBoundaryReflection(messages, 1),
    scenario2: resolveScenarioUserTextForBoundaryReflection(messages, 2),
    scenario3: resolveScenarioUserTextForBoundaryReflection(messages, 3),
  };
}

function clientBundle(
  completedScenario: 1 | 2 | 3,
  firstName: string,
  messages: PostClaudeInterviewMessage[],
  reflectionOverride?: string,
): string {
  return buildClientScenarioBoundaryHandoffBundle(
    completedScenario,
    firstName,
    boundaryUserAnswers(messages),
    MOMENT_4_PERSONAL_CARD,
    reflectionOverride ? { reflectionOverride } : undefined,
  );
}

function modelReflectionOverride(
  raw: string,
  completedScenario: 1 | 2 | 3,
  messages: PostClaudeInterviewMessage[],
): string | undefined {
  const extracted = extractScenarioBoundaryReflectionFromHandoff(raw);
  if (!extracted) return undefined;
  const corpus =
    completedScenario === 1
      ? boundaryUserAnswers(messages).scenario1
      : completedScenario === 2
        ? boundaryUserAnswers(messages).scenario2
        : boundaryUserAnswers(messages).scenario3;
  if (!corpus?.trim()) return undefined;
  if (reflectionCoreLooksLikeCopiedUserClause(corpus, extracted)) return undefined;
  if (reflectionLooksLikeVerbatimInferenceEcho(corpus, extracted)) return undefined;
  if (extractedBoundaryReflectionIsUnsafeForUserCorpus(corpus, extracted, completedScenario)) {
    void remoteLog('[BOUNDARY_REFLECTION_MODEL_OVERRIDE_REJECTED]', {
      completedScenario,
      preview: extracted.slice(0, 220),
      corpusPreview: corpus.slice(0, 160),
    });
    return undefined;
  }
  if (!boundaryConclusionPassesQualityBar(corpus, extracted)) return undefined;
  return extracted;
}

function inferCompletedScenarioForUngroundedBoundaryRebuild(args: {
  raw: string;
  activeScenario: number;
  s1HandoffCue: boolean;
  s2ToS3BoundaryCue: boolean;
  s3ToM4Cue: boolean;
  messages: PostClaudeInterviewMessage[];
}): 1 | 2 | 3 | null {
  if (
    args.s1HandoffCue &&
    scenarioAMinimumEngagementForHandoff(args.messages) &&
    args.activeScenario <= 2
  ) {
    return 1;
  }
  if (
    args.s2ToS3BoundaryCue &&
    scenarioBMinimumEngagementForHandoff(args.messages) &&
    scenarioBJamesRepairProbeAlreadySatisfied(args.messages)
  ) {
    return 2;
  }
  if (args.s3ToM4Cue && args.activeScenario >= 3) {
    return 3;
  }
  return null;
}

function isValidScenarioThreeToMoment4BoundaryHandoff(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  if (isScenarioThreeToMoment4EmotionModalHandoff(t)) return true;
  if (assistantTextLooksLikeMoment4HandoffLead(t)) return true;
  const low = t.toLowerCase();
  if (/\bend of the three described situations\b/.test(low)) return true;
  if (
    /\btwo questions left\b/.test(low) &&
    /\bmore personal\b/.test(low) &&
    !/\bhere'?s the third situation\b/.test(low)
  ) {
    return true;
  }
  if (/\b(?:held a grudge|really hard time with|got under your skin)\b/.test(low)) return true;
  return false;
}

function hasS2ToS3HandoffCue(raw: string, hasS3Vignette: boolean): boolean {
  return (
    hasS3Vignette ||
    /\b(?:here'?s the third situation|that scenario is complete|move to something more personal|on to the third situation|second one done|one more situation and then we'?ll get personal)\b/i.test(
      raw.toLowerCase(),
    )
  );
}

/** In-scenario Scenario B probes must not be replaced with S2→S3 boundary bundles. */
function looksLikeScenarioBInProgressAssistantProbe(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  if (looksLikeScenarioBRepairAsJamesQuestion(t)) return true;
  if (looksLikeScenarioBJamesDifferentlyQuestion(t)) return true;
  if (isScenarioBQ1Prompt(t)) return true;
  return false;
}

export type CoerceScenarioBoundaryHandoffOptions = {
  /**
   * Parallel-stream canonical Situation 2 card already played and advanced refs.
   * Do not yank the user back to S1 repair after that delivery (emotion + handoff must finish).
   */
  situation2PlaybackConfirmed?: boolean;
  /**
   * Stream/speak already contains the Scenario B vignette body (even if transcript lag).
   */
  situation2AlreadySpoken?: boolean;
};

/**
 * At scenario boundaries the client injects canonical vignette / personal-card copy.
 * The model supplies boundary closure only; this replaces handoff text with client bundles.
 */
export function coerceScenarioBoundaryHandoffDisplayText(
  displayText: string,
  firstName: string,
  messages: PostClaudeInterviewMessage[],
  currentScenario: number | null | undefined,
  interviewMoment: number,
  options?: CoerceScenarioBoundaryHandoffOptions,
): string {
  const raw = (displayText ?? '').trim();
  if (!raw) return displayText;

  if (interviewMoment >= 5 || looksLikeInterviewClosingAssistantMessage(raw)) {
    return displayText;
  }

  const split = splitScenarioTransitionForEmotionModal(raw);
  const activeScenario = resolveActiveScenario(currentScenario, interviewMoment);
  const hasS3Vignette = textContainsScenarioCVignetteBody(raw);
  const s2ToS3HandoffCue = hasS2ToS3HandoffCue(raw, hasS3Vignette);
  const hasApprovedReflection = textHasScenarioBoundaryConclusion(split.beforeModal);
  const s1HandoffCue = isScenarioOneBoundaryHandoffCue(raw);
  const s1Handoff =
    scenarioOneHandoffContext(activeScenario, interviewMoment) && s1HandoffCue;
  const s2DeliveryIrrevocable =
    options?.situation2PlaybackConfirmed === true ||
    options?.situation2AlreadySpoken === true ||
    messages.some(
      (m) => m.role === 'assistant' && textContainsScenarioBVignetteBody(m.content ?? ''),
    );

  if (s1Handoff) {
    if (!scenarioAMinimumEngagementForHandoff(messages) && !s2DeliveryIrrevocable) {
      const stripped = stripPrematureScenarioABoundaryFromDraft(raw);
      const redirect = resolveScenarioANextRequiredFollowUpPrompt(messages);
      void remoteLog('[S1_PREMATURE_S2_HANDOFF_BLOCKED]', {
        userTurns: messages.filter((m) => m.role === 'user').length,
        preview: raw.slice(0, 200),
        redirectPreview: (stripped.trim() || redirect).slice(0, 200),
        viaBoundaryReflection: isScenarioABoundaryReflectionWithoutNextVignette(raw),
      });
      return stripped.trim() || redirect;
    }
    if (!scenarioAMinimumEngagementForHandoff(messages) && s2DeliveryIrrevocable) {
      void remoteLog('[S1_PREMATURE_S2_HANDOFF_UNBLOCKED_AFTER_S2_DELIVERY]', {
        userTurns: messages.filter((m) => m.role === 'user').length,
        preview: raw.slice(0, 200),
        situation2PlaybackConfirmed: options?.situation2PlaybackConfirmed === true,
        situation2AlreadySpoken: options?.situation2AlreadySpoken === true,
      });
    }
    const coerced = clientBundle(
      1,
      firstName,
      messages,
      hasApprovedReflection ? modelReflectionOverride(raw, 1, messages) : undefined,
    );
    void remoteLog('[S1_BOUNDARY_HANDOFF_CLIENT_BUNDLE]', {
      beforePreview: raw.slice(0, 200),
      afterPreview: coerced.slice(0, 260),
    });
    return coerced;
  }

  if (
    (activeScenario === 2 || (activeScenario === 3 && interviewMoment <= 3)) &&
    !s1HandoffCue &&
    (hasS3Vignette || s2ToS3HandoffCue || isScenarioBBoundaryReflectionWithoutNextVignette(raw)) &&
    !scenarioBJamesRepairProbeAlreadySatisfied(messages)
  ) {
    const redirect = resolveScenarioBNextRequiredFollowUpPrompt(messages);
    void remoteLog('[S2_PREMATURE_S3_HANDOFF_BLOCKED]', {
      userTurns: messages.filter((m) => m.role === 'user').length,
      preview: raw.slice(0, 200),
      redirectPreview: redirect.slice(0, 200),
      engagementMet: scenarioBMinimumEngagementForHandoff(messages),
      activeScenario,
    });
    return redirect;
  }

  if (
    activeScenario === 1 &&
    !isScenarioABoundaryReflectionWithoutNextVignette(raw) &&
    (textContainsScenarioBVignetteBody(raw) || isScenarioAHandoffWithoutNextVignette(raw)) &&
    !scenarioAMinimumEngagementForHandoff(messages) &&
    !s2DeliveryIrrevocable
  ) {
    const redirect = resolveScenarioANextRequiredFollowUpPrompt(messages);
    void remoteLog('[S1_PREMATURE_S2_HANDOFF_BLOCKED]', {
      userTurns: messages.filter((m) => m.role === 'user').length,
      preview: raw.slice(0, 200),
      redirectPreview: redirect.slice(0, 200),
    });
    return redirect;
  }

  if (
    shouldRedirectPrematureMoment4ToScenario2To3Handoff({
      text: raw,
      currentInterviewMoment: interviewMoment,
      messages,
    }) &&
    !hasS3Vignette
  ) {
    const coerced = clientBundle(
      2,
      firstName,
      messages,
      hasApprovedReflection ? modelReflectionOverride(raw, 2, messages) : undefined,
    );
    void remoteLog('[S2_PREMATURE_M4_HANDOFF_REDIRECTED]', {
      activeScenario,
      interviewMoment,
      beforePreview: raw.slice(0, 200),
      afterPreview: coerced.slice(0, 260),
    });
    return coerced;
  }

  const s3ToM4Incomplete =
    (isScenarioThreeToMoment4EmotionModalHandoff(raw) ||
      isScenarioCBoundaryReflectionWithoutMoment4Handoff(raw) ||
      isIncompleteScenarioCBoundaryClosureLeadSentence(raw)) &&
    !split.afterModal.trim() &&
    !/\b(?:held a grudge|really hard time with|got under your skin)\b/i.test(raw) &&
    !s2ToS3HandoffCue;

  const s3ToM4MissingReflection =
    activeScenario >= 3 &&
    (assistantTextLooksLikeMoment4HandoffLead(raw) || isScenarioThreeToMoment4EmotionModalHandoff(raw)) &&
    !hasApprovedReflection &&
    !s2ToS3HandoffCue;

  if ((activeScenario >= 3 && s3ToM4Incomplete) || s3ToM4MissingReflection) {
    const coerced = clientBundle(
      3,
      firstName,
      messages,
      hasApprovedReflection ? modelReflectionOverride(raw, 3, messages) : undefined,
    );
    void remoteLog('[S3_M4_BOUNDARY_HANDOFF_CLIENT_BUNDLE]', {
      beforePreview: raw.slice(0, 200),
      afterPreview: coerced.slice(0, 260),
    });
    return coerced;
  }

  if (activeScenario >= 3 && isValidScenarioThreeToMoment4BoundaryHandoff(raw)) {
    const coerced = clientBundle(
      3,
      firstName,
      messages,
      hasApprovedReflection ? modelReflectionOverride(raw, 3, messages) : undefined,
    );
    if (coerced.trim() === raw) {
      return displayText;
    }
    void remoteLog('[S3_M4_BOUNDARY_HANDOFF_CLIENT_BUNDLE]', {
      reason: 'valid_m4_handoff',
      beforePreview: raw.slice(0, 200),
      afterPreview: coerced.slice(0, 260),
    });
    return coerced;
  }

  if (activeScenario === 2 && looksLikeScenarioBInProgressAssistantProbe(raw)) {
    return displayText;
  }

  const s2ToS3HandoffContext =
    activeScenario === 2 || (activeScenario === 3 && interviewMoment <= 3 && s2ToS3HandoffCue);

  const s2ToS3BoundaryCue =
    s2ToS3HandoffCue || isScenarioBBoundaryReflectionWithoutNextVignette(raw);

  const s2ToS3Handoff =
    s2ToS3HandoffContext &&
    s2ToS3BoundaryCue &&
    scenarioBMinimumEngagementForHandoff(messages) &&
    scenarioBJamesRepairProbeAlreadySatisfied(messages);

  if (s2ToS3Handoff) {
    const coerced = clientBundle(
      2,
      firstName,
      messages,
      hasApprovedReflection ? modelReflectionOverride(raw, 2, messages) : undefined,
    );
    void remoteLog('[S2_S3_BOUNDARY_HANDOFF_CLIENT_BUNDLE]', {
      beforePreview: raw.slice(0, 200),
      afterPreview: coerced.slice(0, 260),
    });
    return coerced;
  }

  const boundaryReflection = extractScenarioBoundaryReflectionFromHandoff(raw);
  if (boundaryReflection && textHasScenarioBoundaryConclusion(raw)) {
    const completedForRebuild = inferCompletedScenarioForUngroundedBoundaryRebuild({
      raw,
      activeScenario,
      s1HandoffCue,
      s2ToS3BoundaryCue: s2ToS3BoundaryCue,
      s3ToM4Cue:
        isValidScenarioThreeToMoment4BoundaryHandoff(raw) ||
        isScenarioCBoundaryReflectionWithoutMoment4Handoff(raw),
      messages,
    });
    if (completedForRebuild) {
      const corpus =
        completedForRebuild === 1
          ? boundaryUserAnswers(messages).scenario1
          : completedForRebuild === 2
            ? boundaryUserAnswers(messages).scenario2
            : boundaryUserAnswers(messages).scenario3;
      if (
        corpus?.trim() &&
        extractedBoundaryReflectionIsUnsafeForUserCorpus(
          corpus,
          boundaryReflection,
          completedForRebuild,
        )
      ) {
        const coerced = clientBundle(completedForRebuild, firstName, messages);
        void remoteLog('[BOUNDARY_REFLECTION_UNGROUNDED_CLIENT_REBUILD]', {
          completedScenario: completedForRebuild,
          beforePreview: raw.slice(0, 220),
          afterPreview: coerced.slice(0, 260),
          rejectedReflectionPreview: boundaryReflection.slice(0, 200),
        });
        return coerced;
      }
    }
  }

  return displayText;
}
