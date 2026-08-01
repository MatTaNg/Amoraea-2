import { looksLikeMoment4SpecificityFollowUpEcho } from './moment4SpecificityFollowUp';
import {
  looksLikeMoment5AccountabilityProbeAssistantPrompt,
  looksLikeMoment5ConflictValidityClarificationPrompt,
  looksLikeMoment5SpecificityRedirectPrompt,
  stripEmbeddedMoment5AccountabilityProbeAsk,
  stripEmbeddedMoment5SpecificityRedirectAsk,
} from './probeAndScoringUtils';
import {
  looksLikeScenarioAContemptProbeQuestion,
  SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY,
  stripEmbeddedScenarioAContemptProbeAsk,
} from './scenarioAContemptProbeLogic';
import type { MessageWithScenario } from './interviewScenarioScoringSlice';
import {
  isIncompleteScenarioARepairLeadSentence,
  isScenarioARepairFollowUpCompleteInTranscript,
  looksLikeScenarioARepairQuestionLoose,
} from './scenarioFollowUpTranscriptGuard';
import {
  isDanglingInterviewRepeatLeadFragment,
  looksLikeScenarioARepairQuestion,
  repairAssistantDraftAfterDanglingRepeatLead,
  stripEmbeddedScenarioARepairQuestionAsk,
} from './scenarioARepairQuestionHelpers';

export function stripDuplicateScenarioAContemptProbeParagraphs(
  draft: string,
  msgs: MessageWithScenario[],
  interviewMoment: number,
  contemptProbeAskedRef: boolean,
): string {
  if (interviewMoment !== 1 || !draft.trim()) return draft;
  const priorAssistants = msgs.filter(
    (m) =>
      m.role === 'assistant' &&
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      !(m as { isScoreCard?: boolean }).isScoreCard,
  );
  const alreadyAsked =
    contemptProbeAskedRef ||
    priorAssistants.some((m) =>
      looksLikeScenarioAContemptProbeQuestion((m as { content?: string }).content ?? ''),
    );
  if (!alreadyAsked) return draft;
  const blocks = draft
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length === 0) return draft;
  const isProbe = (b: string) => looksLikeScenarioAContemptProbeQuestion(b);
  if (!blocks.some(isProbe)) return draft;
  if (blocks.length <= 1) {
    if (isProbe(blocks[0]!)) return '';
    const stripped = stripEmbeddedScenarioAContemptProbeAsk(draft).trim();
    if (!stripped) return '';
    if (stripped !== draft.trim()) return stripped;
    return draft;
  }
  const filtered = blocks
    .filter((b) => !isProbe(b))
    .map((b) => stripEmbeddedScenarioAContemptProbeAsk(b).trim())
    .filter(Boolean);
  const joined = filtered.join('\n\n').trim();
  return joined || draft;
}

export function stripDuplicateScenarioARepairQuestionParagraphs(
  draft: string,
  msgs: MessageWithScenario[],
  interviewMoment: number,
  _repairQuestionAskedRef: boolean,
): string {
  if (interviewMoment !== 1 || !draft.trim()) return draft;
  const alreadyAsked = isScenarioARepairFollowUpCompleteInTranscript(msgs);
  if (!alreadyAsked) return draft;
  const blocks = draft
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length === 0) return draft;
  const isRepair = (b: string) => looksLikeScenarioARepairQuestionLoose(b);
  if (!blocks.some(isRepair) && !looksLikeScenarioARepairQuestionLoose(draft)) return draft;
  if (blocks.length <= 1) {
    const stripped = stripEmbeddedScenarioARepairQuestionAsk(draft).trim();
    if (!stripped) return '';
    if (stripped !== draft.trim()) {
      if (isIncompleteScenarioARepairLeadSentence(stripped)) {
        return SCENARIO_A_REPAIR_QUESTION_AFTER_CONTEMPT_COPY;
      }
      if (isDanglingInterviewRepeatLeadFragment(stripped)) {
        return repairAssistantDraftAfterDanglingRepeatLead(stripped);
      }
      return stripped;
    }
    if (looksLikeScenarioARepairQuestionLoose(draft)) return '';
    return draft;
  }
  const filtered = blocks
    .filter((b) => !isRepair(b))
    .map((b) => stripEmbeddedScenarioARepairQuestionAsk(b).trim())
    .filter(Boolean);
  const joined = filtered.join('\n\n').trim();
  return joined || draft;
}

/**
 * Models often repeat the conflict-validity clarification (or echo after the client injected it).
 * Drop extra matching paragraphs so the line is not spoken twice in one turn or stacked after transcript.
 */
export function stripDuplicateMoment5ConflictValidityClarificationParagraphs(
  draft: string,
  msgs: MessageWithScenario[],
  interviewMoment: number,
  clarificationIssuedRef: boolean,
): string {
  if (interviewMoment !== 5 || !draft.trim()) return draft;
  const priorAssistants = msgs.filter(
    (m) =>
      m.role === 'assistant' &&
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      !(m as { isScoreCard?: boolean }).isScoreCard,
  );
  const clarificationAlreadyAsked =
    clarificationIssuedRef ||
    priorAssistants.some((m) =>
      looksLikeMoment5ConflictValidityClarificationPrompt((m as { content?: string }).content ?? ''),
    );

  const blocks = draft
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length === 0) return draft;

  const isClar = (b: string) => looksLikeMoment5ConflictValidityClarificationPrompt(b);
  if (!blocks.some(isClar)) return draft;

  let keptClarificationInDraft = false;
  const out: string[] = [];
  for (const b of blocks) {
    if (!isClar(b)) {
      out.push(b);
      continue;
    }
    if (clarificationAlreadyAsked) {
      continue;
    }
    if (keptClarificationInDraft) {
      continue;
    }
    keptClarificationInDraft = true;
    out.push(b);
  }
  const joined = out.join('\n\n').trim();
  return joined || draft;
}

/**
 * Model sometimes repeats the client-injected Moment 5 specificity line after it is already in the transcript.
 * Drop matching paragraphs only when prior transcript already contained that redirect (welcome-back excluded upstream).
 */
export function stripDuplicateMoment5SpecificityRedirectParagraphs(
  draft: string,
  msgs: MessageWithScenario[],
  interviewMoment: number,
): string {
  if (interviewMoment !== 5 || !draft.trim()) return draft;
  const priorAssistants = msgs.filter(
    (m) =>
      m.role === 'assistant' &&
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      !(m as { isScoreCard?: boolean }).isScoreCard,
  );
  const alreadyAsked = priorAssistants.some((m) =>
    looksLikeMoment5SpecificityRedirectPrompt((m as { content?: string }).content ?? ''),
  );
  if (!alreadyAsked) return draft;
  const blocks = draft
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length <= 1) {
    const stripped = stripEmbeddedMoment5SpecificityRedirectAsk(draft).trim();
    if (!stripped) return '';
    if (stripped !== draft.trim()) return stripped;
    if (looksLikeMoment5SpecificityRedirectPrompt(draft)) return '';
    return draft;
  }
  const filtered = blocks
    .filter((b) => !looksLikeMoment5SpecificityRedirectPrompt(b))
    .map((b) => stripEmbeddedMoment5SpecificityRedirectAsk(b).trim())
    .filter(Boolean);
  const joined = filtered.join('\n\n').trim();
  return joined || draft;
}

/**
 * Model sometimes repeats the client-injected Moment 5 accountability probe (or a close paraphrase) after it is already in the transcript.
 * Drop matching paragraphs only when prior transcript already contained that probe (welcome-back excluded upstream).
 */
export function stripDuplicateMoment5AccountabilityProbeParagraphs(
  draft: string,
  msgs: MessageWithScenario[],
  interviewMoment: number,
  accountabilityProbeFiredRef: boolean,
): string {
  if (interviewMoment !== 5 || !draft.trim()) return draft;
  const priorAssistants = msgs.filter(
    (m) =>
      m.role === 'assistant' &&
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      !(m as { isScoreCard?: boolean }).isScoreCard,
  );
  const alreadyAsked =
    accountabilityProbeFiredRef ||
    priorAssistants.some((m) =>
      looksLikeMoment5AccountabilityProbeAssistantPrompt((m as { content?: string }).content ?? ''),
    );
  if (!alreadyAsked) return draft;
  const blocks = draft
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length === 0) return draft;
  const isProbe = (b: string) => looksLikeMoment5AccountabilityProbeAssistantPrompt(b);
  const draftHasAccountabilityAsk =
    /\bwhat do you think you did or said that contributed\b/i.test(draft) ||
    /\bwhat was your part in how\b/i.test(draft);
  if (!blocks.some(isProbe) && !draftHasAccountabilityAsk) return draft;
  if (blocks.length <= 1) {
    const stripped = stripEmbeddedMoment5AccountabilityProbeAsk(draft).trim();
    if (!stripped) return '';
    if (stripped !== draft.trim()) return stripped;
    if (looksLikeMoment5AccountabilityProbeAssistantPrompt(draft)) return '';
    if (draftHasAccountabilityAsk) return '';
    return draft;
  }
  const filtered = blocks
    .filter(
      (b) =>
        !isProbe(b) &&
        !/\bwhat do you think you did or said that contributed\b/i.test(b) &&
        !/\bwhat was your part in how\b/i.test(b),
    )
    .map((b) => stripEmbeddedMoment5AccountabilityProbeAsk(b).trim())
    .filter(Boolean);
  const joined = filtered.join('\n\n').trim();
  return joined || draft;
}

/**
 * Model sometimes repeats the client-injected Moment 4 specificity line (or a close paraphrase) after it is already in the transcript.
 * Drop matching paragraphs when prior assistant turns already included that follow-up.
 */
export function stripDuplicateMoment4SpecificityFollowUpParagraphs(
  draft: string,
  msgs: MessageWithScenario[],
  interviewMoment: number,
): string {
  if (interviewMoment !== 4 || !draft.trim()) return draft;
  const priorAssistants = msgs.filter(
    (m) =>
      m.role === 'assistant' &&
      !(m as { isWelcomeBack?: boolean }).isWelcomeBack &&
      !(m as { isScoreCard?: boolean }).isScoreCard,
  );
  const alreadyAsked = priorAssistants.some((m) =>
    looksLikeMoment4SpecificityFollowUpEcho((m as { content?: string }).content ?? ''),
  );
  if (!alreadyAsked) return draft;
  const blocks = draft
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  if (blocks.length <= 1) {
    if (looksLikeMoment4SpecificityFollowUpEcho(draft)) return '';
    return draft;
  }
  const filtered = blocks.filter((b) => !looksLikeMoment4SpecificityFollowUpEcho(b));
  const joined = filtered.join('\n\n').trim();
  return joined || draft;
}
