/**
 * Shared Scenario B (Sarah/James) prompt detection for transcript-based scoring reconciliation.
 * Kept separate from the screen to use in the scoring pipeline and scripts.
 */

import { looksLikeScenarioBRepairAsJamesQuestion } from './interviewDisengagementProbes';

/** Legacy assistant line when Q3 was skipped (older sessions). Kept for transcript reconciliation. */
const SCENARIO_B_REPAIR_COVERED_SKIP_LEGACY =
  "Got it — you've already covered how you'd approach that.";

export function isScenarioBRepairAsJamesQuestion(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  return looksLikeScenarioBRepairAsJamesQuestion(text);
}

export function isScenarioBJamesDifferentlyOrAppreciationPathQuestion(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const t = text.toLowerCase();
  if (t.includes("what do you think james could've done differently so sarah feels better")) return true;
  const jamesCtx = /\bjames\b/.test(t);
  const differently =
    /\b(could'?ve done differently|could have done differently|done differently|anything james could|what james could)\b/.test(
      t
    );
  const beforeFight =
    jamesCtx &&
    /\b(before (the )?(fight|blow|blow-?up)|might have helped|so sarah feels|feel appreciated|helped sarah)\b/.test(t);
  const leanJamesProbe = /\bis there anything james could have done\b/.test(t) && /\bhelp(ed)?\b/.test(t);
  return (jamesCtx && differently) || beforeFight || leanJamesProbe;
}

export function isScenarioBRepairCoveredInPriorTurnAssistant(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  return text.includes(SCENARIO_B_REPAIR_COVERED_SKIP_LEGACY);
}

/** Client path: S2 completion + S3 opening merged without a separate repair-as-James assistant line. */
export function isScenarioBSilentRepairSkipAssistant(text: string | null | undefined): boolean {
  const c = text ?? '';
  if (!/\[SCENARIO_COMPLETE\s*:\s*2\]/i.test(c)) return false;
  const t = c.toLowerCase();
  return (
    t.includes('sophie and daniel') ||
    t.includes("here's the third situation") ||
    t.includes('here the third situation') ||
    (t.includes('third situation') && (t.includes('more personal') || t.includes('two questions')))
  );
}

/** Repair construct was elicited or intentionally omitted as satisfied (legacy phrase, explicit repair ask, or silent S2→S3). */
export function scenarioBAssistantSignalsRepairConstructHandled(text: string | null | undefined): boolean {
  return (
    isScenarioBRepairAsJamesQuestion(text) ||
    isScenarioBRepairCoveredInPriorTurnAssistant(text) ||
    isScenarioBSilentRepairSkipAssistant(text)
  );
}

export function messagesForScenarioNumber(
  all: ReadonlyArray<{ role: string; content?: string; scenarioNumber?: number | null }>,
  scenarioNum: 1 | 2 | 3
) {
  return all.filter(
    (m) => typeof m.scenarioNumber === 'number' && m.scenarioNumber === scenarioNum
  );
}
