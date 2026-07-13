import { SCENARIO_3_OPENING } from '@features/aria/interviewScenarioOpeningStreamGate';
import {
  isScenarioCQ1Prompt,
  isScenarioCQ2Prompt,
  textContainsScenarioCVignetteBody,
} from '@features/aria/scenarioCProbeLogic';

export function stripScenarioCRepairQuestionFromText(text: string): string {
  let out = text.replace(
    /\n*\s*(?:Got it\.\s*)?How do you think this situation could be repaired\??\s*/gi,
    '\n\n',
  );
  out = out.replace(
    /\n*\s*(?:Got it\.\s*)?How\s+do\s+you\s+think\s+(this\s+situation|things?|they)\s+could\s+be\s+repaired\??\s*/gi,
    '\n\n',
  );
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function stripScenarioCThresholdQuestionFromText(text: string): string {
  let out = text.replace(
    /\n*\s*At what point would you say Daniel or Sophie should decide this relationship isn't working\??\s*/gi,
    '\n\n'
  );
  out = out.replace(
    /\n*\s*At what point would you say (Daniel|Sophie) or (Daniel|Sophie) should decide[^?\n]*\??\s*/gi,
    '\n\n'
  );
  out = out.replace(
    /\n*\s*At what point do you decide[^\n]*?Daniel[^\n]*?Sophie[^\n]*?(?:isn't|is not)\s+working\??\s*/gi,
    '\n\n'
  );
  out = out.replace(
    /\n*\s*At what point[^\n]{0,120}Daniel[^\n]{0,120}Sophie[^\n]{0,160}?(?:isn't|is not)\s+working[^\n.?!]*\??\s*/gi,
    '\n\n'
  );
  return out.replace(/\n{3,}/g, '\n\n').trim();
}

export function appendCanonicalScenarioCAnalysisQuestion(text: string): string {
  const base = text.trimEnd();
  if (isScenarioCQ1Prompt(base)) return base;
  return `${base}\n\n${SCENARIO_3_OPENING}`.trim();
}

/**
 * Scenario C: vignette → Q1 (Daniel line) → Q2 repair → threshold. Never Q2/threshold in the same turn as the vignette without Q1.
 */
export function ensureScenarioCQ1SequenceAfterVignette(text: string): string {
  if (!textContainsScenarioCVignetteBody(text)) return text;
  let out = text;
  if (isScenarioCQ1Prompt(out)) {
    out = stripScenarioCRepairQuestionFromText(out);
    out = stripScenarioCThresholdQuestionFromText(out);
    return out.replace(/\n{3,}/g, '\n\n').trim();
  }
  out = stripScenarioCRepairQuestionFromText(out);
  out = stripScenarioCThresholdQuestionFromText(out);
  if (isScenarioCQ1Prompt(out)) return out.replace(/\n{3,}/g, '\n\n').trim();
  return appendCanonicalScenarioCAnalysisQuestion(out);
}

/** Prior turn showed S3 vignette but not Q1; this turn wrongly jumps to repair only — replace with Q1. */
export function replaceOrphanScenarioCRepairWithQ1(text: string, priorAssistantContent: string): string {
  if (!isScenarioCQ2Prompt(text) || textContainsScenarioCVignetteBody(text)) return text;
  if (!textContainsScenarioCVignetteBody(priorAssistantContent)) return text;
  if (isScenarioCQ1Prompt(priorAssistantContent)) return text;
  if (isScenarioCQ2Prompt(priorAssistantContent)) return text;
  return SCENARIO_3_OPENING;
}

/** First sentence of Scenario C vignette — re-inserted client-side when the model drops the repetition frame (Prompt 1). */

export const SCENARIO_C_MISPLACED_Q1_REDIRECT =
  "I was asking specifically about what you make of Daniel saying 'I didn't know what to say', what does that line tell you about where he's at?";
