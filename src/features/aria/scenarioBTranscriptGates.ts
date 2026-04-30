/**
 * Shared Scenario B (Sarah/James) prompt detection for transcript-based scoring reconciliation.
 * Kept separate from the screen to use in the scoring pipeline and scripts.
 */

const SCENARIO_B_REPAIR_COVERED_SKIP =
  "Got it — you've already covered how you'd approach that.";

export function isScenarioBRepairAsJamesQuestion(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const t = text.toLowerCase();
  const asJames =
    /\bif you were james\b/.test(t) &&
    /\b(repair|fix|make it right|apologize|patch things|make up|mend|handle|approach|smooth|sort (this|it) out|navigate|move forward)\b/.test(
      t
    );
  const howRepairJames =
    /\bhow would you\b/.test(t) &&
    /\bjames\b/.test(t) &&
    /\b(repair|fix|handle|approach|make things right|make it right)\b/.test(t);
  const compact =
    t.length < 200 &&
    /\bjames\b/.test(t) &&
    /\b(you were|as james|if you were)\b/.test(t) &&
    /\b(repair|fix|handle|approach)\b/.test(t);
  return asJames || howRepairJames || compact;
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
  return text.trim().includes(SCENARIO_B_REPAIR_COVERED_SKIP);
}

export function messagesForScenarioNumber(
  all: ReadonlyArray<{ role: string; content?: string; scenarioNumber?: number | null }>,
  scenarioNum: 1 | 2 | 3
) {
  return all.filter(
    (m) => typeof m.scenarioNumber === 'number' && m.scenarioNumber === scenarioNum
  );
}
