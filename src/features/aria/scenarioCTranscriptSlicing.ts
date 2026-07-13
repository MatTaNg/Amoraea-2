import { looksLikeMoment4GrudgePrompt } from './moment4ProbeLogic';
import { isMoment5AssistantAnchor } from './moment5ProbeLogic';
import { normalizeInterviewTypography } from './interviewTypography';
import type { MessageWithScenario } from './interviewScenarioScoringSlice';
import { looksLikeScenarioCCommitmentThresholdAssistantPrompt } from './scenarioCCommitmentThresholdLogic';
import { isScenarioCRepairAssistantPrompt } from './scenarioCPromptDetection';

/**
 * Assistant turn that pivots from fictional Scenario C to personal Moment 4 (grudge / dislike).
 * Production still tags post-handoff messages as `scenarioNumber: 3`, so scoring must cut here.
 */
export function isScenarioCToPersonalHandoffAssistantContent(text: string): boolean {
  const t = normalizeInterviewTypography(text ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  const grudgeOrDislike =
    t.includes('held a grudge') ||
    (t.includes("really didn't like") && /\b(someone|your life|people)\b/.test(t)) ||
    (t.includes('really hard time with') && t.includes('what happened')) ||
    (t.includes('got under your skin') && t.includes('what happened'));
  if (!grudgeOrDislike) return false;
  return (
    t.includes('three situations') ||
    t.includes("we've finished") ||
    t.includes('finished the three') ||
    t.includes('last two questions') ||
    t.includes('two questions are more personal') ||
    t.includes('only two questions') ||
    (t.includes('good work') && t.includes('three situations'))
  );
}

/** Mirrors {@link assistantTextLooksLikeMoment4HandoffLead} without importing interviewTransitionBundles (cycle). */
function assistantTextLooksLikePersonalMomentStart(content: string): boolean {
  if (isScenarioCToPersonalHandoffAssistantContent(content)) return true;
  if (looksLikeMoment4GrudgePrompt(content)) return true;
  if (isMoment5AssistantAnchor(content)) return true;
  const t = normalizeInterviewTypography(content ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (/held a grudge|really didn't like/.test(t)) return true;
  if (/really hard time with|got under your skin/.test(t)) return true;
  if (/finished the three situations/.test(t)) return true;
  if (/end of (the )?three (situations|described situations|vignettes)/.test(t)) return true;
  if (/done with those three scenarios?/.test(t)) return true;
  if (t.includes('three situations') && (t.includes('two questions') || t.includes('more about you'))) {
    return true;
  }
  if (t.includes("we're done with those three") || t.includes('done with those three')) return true;
  return false;
}

type Scenario3ScoringTurn = { role: string; content?: string; interviewMoment?: number };

/**
 * Fiction-only Scenario C band for scoring — cuts before Moment 4/5 assistant handoffs and drops
 * turns tagged `interviewMoment` ≥ 4 (personal moments still carry `scenarioNumber: 3` in production).
 */
export function sliceTranscriptForScenario3Scoring<T extends Scenario3ScoringTurn>(
  transcript: readonly T[],
): T[] {
  let cut = transcript.length;
  for (let i = 0; i < transcript.length; i++) {
    const m = transcript[i];
    if (m.role !== 'assistant') continue;
    const content = typeof m.content === 'string' ? m.content : '';
    if (
      (typeof m.interviewMoment === 'number' && m.interviewMoment >= 4) ||
      assistantTextLooksLikePersonalMomentStart(content)
    ) {
      cut = i;
      break;
    }
  }
  return transcript.slice(0, cut).filter((m) => {
    const im = m.interviewMoment;
    return im === undefined || im <= 3;
  }) as T[];
}

/** Drop assistant + user turns from personal Moment 4 onward — keeps Scenario C slice fiction-only. */
export function sliceTranscriptBeforeScenarioCToPersonalHandoff<
  T extends { role: string; content?: string },
>(transcript: readonly T[]): T[] {
  return sliceTranscriptForScenario3Scoring(transcript);
}

export type ScenarioCorpusMessageSlice = {
  role: string;
  content?: string;
  scenarioNumber?: number | null;
};

/**
 * User answer(s) to the Scenario C **repair** question only — stops before the commitment-threshold
 * assistant turn so the repair answer is never concatenated with the threshold follow-up (scoring
 * and probe logic must stay independent).
 */
export function extractScenario3UserCorpusAfterLastRepairPrompt(
  msgs: readonly ScenarioCorpusMessageSlice[],
): string {
  const scoped = sliceTranscriptForScenario3Scoring(msgs);
  let lastRepairIdx = -1;
  for (let i = scoped.length - 1; i >= 0; i--) {
    const m = scoped[i];
    if (m.role === 'assistant' && typeof m.content === 'string' && isScenarioCRepairAssistantPrompt(m.content)) {
      lastRepairIdx = i;
      break;
    }
  }
  if (lastRepairIdx < 0) return '';
  const parts: string[] = [];
  for (let i = lastRepairIdx + 1; i < scoped.length; i++) {
    const m = scoped[i];
    if (m.role === 'assistant' && m.scenarioNumber === 3 && typeof m.content === 'string') {
      if (looksLikeScenarioCCommitmentThresholdAssistantPrompt(m.content)) break;
      continue;
    }
    if (m.role === 'user' && m.scenarioNumber === 3) {
      const t = String(m.content ?? '').trim();
      if (t) parts.push(t);
    }
  }
  return parts.join(' ');
}

/**
 * User answer(s) in Scenario C **before** the general repair assistant prompt — unprompted relative to
 * "How do you think this situation could be repaired?" (typically Q1 and any prior user turns in this scenario).
 */
export function extractScenario3UserCorpusBeforeRepairPrompt(
  msgs: readonly ScenarioCorpusMessageSlice[],
): string {
  const scoped = sliceTranscriptForScenario3Scoring(msgs);
  let lastRepairIdx = -1;
  for (let i = scoped.length - 1; i >= 0; i--) {
    const m = scoped[i];
    if (m.role === 'assistant' && typeof m.content === 'string' && isScenarioCRepairAssistantPrompt(m.content)) {
      lastRepairIdx = i;
      break;
    }
  }
  if (lastRepairIdx < 0) return '';
  const parts: string[] = [];
  for (let i = 0; i < lastRepairIdx; i++) {
    const m = scoped[i];
    if (m.role === 'user' && m.scenarioNumber === 3) {
      const t = String(m.content ?? '').trim();
      if (t) parts.push(t);
    }
  }
  return parts.join(' ');
}

/** All Scenario C user turns joined — scoring helper when tagged scenarioNumber is reliable. */
export function extractScenario3UserCorpus(msgs: MessageWithScenario[]): string {
  return msgs
    .filter((m) => m.role === 'user' && m.scenarioNumber === 3)
    .map((m) => (m.content ?? '').trim())
    .filter(Boolean)
    .join(' ');
}
