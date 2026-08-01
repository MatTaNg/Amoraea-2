import {
  hasScenarioBoundaryWrapPhrase,
} from '@features/aria/emotionModalTransitionOrchestration';
import {
  resolveEffectiveActiveScenarioFromTranscript,
  textContainsScenarioCVignetteBody,
} from '@features/aria/emotionScenarioTransitionInference';
import {
  shouldAdvanceScenarioAAfterSatisfiedRepair,
} from '@features/aria/interviewDisengagementProbes';
import { isScenarioCRepairAssistantPrompt, isScenarioCBoundaryReflectionWithoutMoment4Handoff, isScenarioCQ1Prompt, looksLikeScenarioCRepairWithUserAnswerEcho, looksLikeScenarioCSophiePerspectiveQuestion, looksLikeScenarioCSophieRolePlayMisparaphraseQuestion, looksLikeScenarioCSophieReceiveMisparaphraseQuestion, scenarioCRepairConstructStillPending, scenarioCUserAnswerHasSubstantiveRepairContent, scenarioCUserAnswerSatisfiesRepairQuestionAnswer } from '@features/aria/scenarioCPromptDetection';
import { isScenarioModalFollowUpProbe } from '@features/aria/interviewScenarioModalPrompt';
import { isShortAckOnlySentence } from '@features/aria/interviewerFrameworkPrompt';
import { userAnswerHasSophiePerspectiveLanguage } from '@features/aria/interviewMentalizingAndAnswerSignals';
import {
  buildClientScenarioBoundaryHandoffBundle,
  assistantTextLooksLikeMoment4HandoffLead,
} from '@features/aria/interviewTransitionBundles';
import { MOMENT_4_PERSONAL_CARD, assistantTextIsPrematureMoment4HandoffDuringScenarioC } from '@features/aria/interviewMomentScenarioConfig';
import { isScenarioABoundaryReflectionWithoutNextVignette } from '@features/aria/scenarioAContemptProbeTextMatch';
import { aggregateScenario1Moment1UserTextForContemptGate } from '@features/aria/scenarioAContemptProbeCoverage';
import { isScenarioBBoundaryReflectionWithoutNextVignette, scenarioBMinimumEngagementForHandoff } from '@features/aria/scenarioBProbeLogic';
import { scenarioAMinimumEngagementForHandoff } from '@features/aria/scenarioFollowUpTranscriptGuard';
import {
  findLastUserWithPriorAssistantContent,
  shouldAdvanceScenarioBAfterSatisfiedRepair,
} from '@features/aria/interviewRepairRefusalDetection';
import {
  aggregateScenarioUserTurnsForNarrative,
  lastScenarioFictionUserAnswer,
} from '@features/aria/narrativeTurnIndexing';

export type PostClaudeScenarioAdvanceMessage = {
  role: string;
  content?: string | null;
  scenarioNumber?: number;
  interviewMoment?: number;
};

function mergeUniqueCorpusLines(...parts: string[]): string {
  const lines = [
    ...new Set(
      parts
        .flatMap((p) => p.split('\n'))
        .map((l) => l.trim())
        .filter(Boolean),
    ),
  ];
  return lines.join('\n').trim();
}

function scenarioUserTextForBoundaryReflection(
  messages: PostClaudeScenarioAdvanceMessage[],
  scenario: 1 | 2 | 3,
): string {
  if (scenario === 1) {
    const byScenarioNumber = aggregateScenarioUserTurnsForNarrative(messages, 1);
    const moment1 = aggregateScenario1Moment1UserTextForContemptGate(messages);
    const merged = mergeUniqueCorpusLines(byScenarioNumber, moment1);
    if (merged) return merged;
    return lastScenarioFictionUserAnswer(messages, 1);
  }
  const aggregated = aggregateScenarioUserTurnsForNarrative(messages, scenario);
  if (aggregated) return aggregated;
  return lastScenarioFictionUserAnswer(messages, scenario);
}

/** User corpus for client boundary reflection (aggregated scenario turns when available). */
export function resolveScenarioUserTextForBoundaryReflection(
  messages: PostClaudeScenarioAdvanceMessage[],
  scenario: 1 | 2 | 3,
): string {
  return scenarioUserTextForBoundaryReflection(messages, scenario);
}

function scenarioCompleteClientBundle(
  completedScenario: 1 | 2 | 3,
  firstName: string,
  messages: PostClaudeScenarioAdvanceMessage[],
): string {
  return buildClientScenarioBoundaryHandoffBundle(
    completedScenario,
    firstName,
    {
      scenario1: scenarioUserTextForBoundaryReflection(messages, 1),
      scenario2: scenarioUserTextForBoundaryReflection(messages, 2),
      scenario3: scenarioUserTextForBoundaryReflection(messages, 3),
    },
    MOMENT_4_PERSONAL_CARD,
  );
}

/**
 * After a substantive Scenario C repair answer, inject S3→M4 when the model re-asks with a thin
 * modal follow-up ("Just say whatever comes to mind") instead of boundary closure.
 */
export function shouldAdvanceScenarioCAfterSatisfiedDanielRepair(
  messages: PostClaudeScenarioAdvanceMessage[],
  strippedAssistantDraft: string,
  currentScenario: number,
): boolean {
  if (currentScenario !== 3) return false;

  const { lastUserContent, priorAssistantContent } = findLastUserWithPriorScenarioCRepairContext(messages);
  if (!lastUserContent || !priorAssistantContent) return false;
  if (!isScenarioCRepairAssistantPrompt(priorAssistantContent)) return false;
  if (!scenarioCUserAnswerSatisfiesRepairQuestionAnswer(lastUserContent)) return false;

  const draft = strippedAssistantDraft.trim();
  if (!draft) return true;
  if (isScenarioModalFollowUpProbe(draft)) return true;
  if (isShortAckOnlySentence(draft)) return true;
  if (
    isScenarioCRepairAssistantPrompt(draft) ||
    looksLikeScenarioCRepairWithUserAnswerEcho(draft)
  ) {
    return true;
  }

  return false;
}

/** Walk past resume welcome / non-repair assistants to the Scenario C repair prompt before the user turn. */
function findLastUserWithPriorScenarioCRepairContext(
  messages: PostClaudeScenarioAdvanceMessage[],
): { lastUserContent: string | null; priorAssistantContent: string | null } {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role !== 'user') continue;
    if ((messages[i] as { isWelcomeBack?: boolean }).isWelcomeBack) continue;
    const lastUserContent = (messages[i].content ?? '').trim();
    if (!lastUserContent) continue;
    for (let j = i - 1; j >= 0; j -= 1) {
      if (messages[j].role !== 'assistant') continue;
      if ((messages[j] as { isWelcomeBack?: boolean }).isWelcomeBack) continue;
      const content = (messages[j].content ?? '').trim();
      if (!content || /^welcome back\b/i.test(content)) continue;
      if (isScenarioCRepairAssistantPrompt(content)) {
        return { lastUserContent, priorAssistantContent: content };
      }
    }
    return { lastUserContent, priorAssistantContent: null };
  }
  return { lastUserContent: null, priorAssistantContent: null };
}

function incompleteWrapMissingNextSegment(strippedDraft: string, hasNextSegment: (t: string) => boolean): boolean {
  const draft = strippedDraft.trim();
  if (!draft || !hasScenarioBoundaryWrapPhrase(draft)) return false;
  return !hasNextSegment(draft);
}

function resolveActiveScenario(
  currentScenario: number | undefined,
  interviewMoment: number,
  messages: PostClaudeScenarioAdvanceMessage[],
): number {
  return resolveEffectiveActiveScenarioFromTranscript(
    currentScenario,
    interviewMoment,
    messages,
  );
}

/**
 * After a satisfied repair answer, inject canonical scenario-complete bundles when the model
 * paraphrases a boundary wrap without the next vignette / personal card body.
 */
export function applyPostClaudeScenarioAdvanceBundleOverride(
  text: string,
  firstName: string,
  messages: PostClaudeScenarioAdvanceMessage[],
  interviewMoment: number,
  currentScenario?: number,
): string | null {
  const strippedText = text.replace(/\[SCENARIO_COMPLETE:\s*\d+\]/gi, '').trim() || text.trim();
  // Scenario-complete bundles only apply during moments 1–3. At moments 4–5 the S3→M4
  // handoff already happened — never re-inject boundary leads during personal moments or close.
  if (interviewMoment > 3) {
    return null;
  }
  const activeScenario = resolveActiveScenario(currentScenario, interviewMoment, messages);

  if (activeScenario === 1) {
    if (!scenarioAMinimumEngagementForHandoff(messages)) {
      return null;
    }
    const incompleteS1Boundary = isScenarioABoundaryReflectionWithoutNextVignette(strippedText);
    if (
      incompleteS1Boundary ||
      shouldAdvanceScenarioAAfterSatisfiedRepair(messages, strippedText, interviewMoment)
    ) {
      return `[SCENARIO_COMPLETE:1]\n\n${scenarioCompleteClientBundle(1, firstName, messages)}`;
    }
  }

  if (activeScenario === 2) {
    if (!scenarioBMinimumEngagementForHandoff(messages)) {
      return null;
    }
    const incompleteS2Boundary = isScenarioBBoundaryReflectionWithoutNextVignette(strippedText);
    const prematureM4Handoff =
      assistantTextIsPrematureMoment4HandoffDuringScenarioC(strippedText) &&
      !textContainsScenarioCVignetteBody(strippedText);
    if (
      incompleteS2Boundary ||
      prematureM4Handoff ||
      shouldAdvanceScenarioBAfterSatisfiedRepair(messages, strippedText, activeScenario)
    ) {
      return `[SCENARIO_COMPLETE:2]\n\n${scenarioCompleteClientBundle(2, firstName, messages)}`;
    }
  }

  if (activeScenario === 3) {
    if (scenarioCRepairConstructStillPending(messages)) {
      return null;
    }
    const { lastUserContent, priorAssistantContent } = findLastUserWithPriorAssistantContent(messages);
    const q1AnswerSatisfiesFollowUps =
      lastUserContent != null &&
      priorAssistantContent != null &&
      isScenarioCQ1Prompt(priorAssistantContent) &&
      userAnswerHasSophiePerspectiveLanguage(lastUserContent) &&
      scenarioCUserAnswerHasSubstantiveRepairContent(lastUserContent);
    const sophiePerspectiveAnswerSatisfiesFollowUps =
      lastUserContent != null &&
      priorAssistantContent != null &&
      looksLikeScenarioCSophiePerspectiveQuestion(priorAssistantContent) &&
      scenarioCUserAnswerHasSubstantiveRepairContent(lastUserContent);
    if (
      (q1AnswerSatisfiesFollowUps || sophiePerspectiveAnswerSatisfiesFollowUps) &&
      (looksLikeScenarioCSophieRolePlayMisparaphraseQuestion(strippedText) ||
        looksLikeScenarioCSophiePerspectiveQuestion(strippedText) ||
        looksLikeScenarioCSophieReceiveMisparaphraseQuestion(strippedText) ||
        !strippedText.trim())
    ) {
      return `[SCENARIO_COMPLETE:3]\n\n${scenarioCompleteClientBundle(3, firstName, messages)}`;
    }
    const priorIsDanielRepair =
      priorAssistantContent != null && isScenarioCRepairAssistantPrompt(priorAssistantContent);
    const satisfiedDanielRepair =
      priorIsDanielRepair &&
      lastUserContent != null &&
      scenarioCUserAnswerSatisfiesRepairQuestionAnswer(lastUserContent);
    const incompleteS3Boundary = isScenarioCBoundaryReflectionWithoutMoment4Handoff(strippedText);
    const incompleteS3Wrap =
      incompleteWrapMissingNextSegment(
        strippedText,
        (t) => textContainsScenarioCVignetteBody(t) || assistantTextLooksLikeMoment4HandoffLead(t),
      ) &&
      !assistantTextLooksLikeMoment4HandoffLead(strippedText);
    const missingM4Handoff =
      hasScenarioBoundaryWrapPhrase(strippedText) &&
      !assistantTextLooksLikeMoment4HandoffLead(strippedText) &&
      !/held a grudge|really hard time with/i.test(strippedText);
    if (
      incompleteS3Boundary ||
      shouldAdvanceScenarioCAfterSatisfiedDanielRepair(messages, strippedText, activeScenario) ||
      (satisfiedDanielRepair && (incompleteS3Wrap || missingM4Handoff || !strippedText))
    ) {
      return `[SCENARIO_COMPLETE:3]\n\n${scenarioCompleteClientBundle(3, firstName, messages)}`;
    }
  }

  return null;
}
