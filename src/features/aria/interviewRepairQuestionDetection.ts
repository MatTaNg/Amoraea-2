import { normalizeApostrophes, normalizeWhitespace } from './disengagementProbeNormalize';
import { CLIENT_REPAIR_REFUSAL_PROBE } from './interviewDisengagementProbeCopy';
import { isScenarioCRepairAssistantPrompt } from './probeAndScoringUtils';
import {
  looksLikeScenarioARepairQuestion,
} from './scenarioARepairQuestionHelpers';

/** Scenario B Q2 / Q3 prompt detection — shared by interview flow and transcript gates. */
export {
  looksLikeScenarioBJamesDifferentlyQuestion,
  looksLikeScenarioBRepairAsJamesQuestion,
} from './scenarioBProbeLogic';

import { looksLikeScenarioBRepairAsJamesQuestion } from './scenarioBProbeLogic';

export function looksLikeRepairInterviewQuestion(text: string): boolean {
  return (
    looksLikeScenarioARepairQuestion(text) ||
    looksLikeScenarioBRepairAsJamesQuestion(text) ||
    isScenarioCRepairAssistantPrompt(text)
  );
}

/**
 * Pessimism / refusal about whether the situation can be repaired — Scenario C repair ask only.
 * Used to fire the repair refusal probe when repair pessimism appears after the Scenario C repair prompt.
 */
export function isScenarioCRepairPessimismRefusalSignal(text: string): boolean {
  const t = normalizeApostrophes(text).toLowerCase();
  if (!t.trim()) return false;
  const patterns: RegExp[] = [
    /\bnot\s+sure\s+(this|it|things?)\s+can\s+be\s+fixed\b/,
    /\b(can'?t|cannot)\s+be\s+fixed\b/,
    /\b(can'?t|cannot)\s+really\s+be\s+fixed\b/,
    /\bno\s+way\s+to\s+fix\b/,
    /\b(he|she|they)'?s\s+just\s+not\s+able\s+to\b/,
    /\bdoesn'?t\s+know\s+how\s+to\b/,
    /\bdon'?t\s+know\s+how\s+to\b/,
    /\bprobably\s+won'?t\s+work\b/,
    /\b(it\s+)?probably\s+won'?t\b/,
    /\btoo\s+far\s+gone\b/,
    /\bbeyond\s+repair\b/,
    /\b(irreparable|unfixable)\b/,
    /\b(point\s+of\s+)?no\s+return\b/,
    /\bnothing\s+(left\s+)?to\s+salvage\b/,
    /\bcan'?t\s+see\s+(this|it)\s+(working|being\s+fixed)\b/,
    /\bwon'?t\s+(ever\s+)?work\b/,
    /\bnot\s+worth\s+(fixing|trying)\b/,
    /\bit'?s\s+(too\s+)?late\s+to\s+fix\b/,
  ];
  return patterns.some((re) => re.test(t));
}

export function isRepairRefusalProbeAssistantLine(content: string): boolean {
  const n = normalizeWhitespace(content);
  return n === normalizeWhitespace(CLIENT_REPAIR_REFUSAL_PROBE);
}
