import type { ConflictStyleKey } from "@/data/assessments/instruments/conflictStyleTypes";
import type { ConflictStyleCounts } from "@/data/assessments/instruments/conflictStyleScoring";
import {
  dominantAndSecondary,
  hasDominantTie,
  tiedForDominant,
} from "@/data/assessments/instruments/conflictStyleScoring";

const LABEL: Record<ConflictStyleKey, string> = {
  competing: "Competing",
  collaborating: "Collaborating",
  compromising: "Compromising",
  avoiding: "Avoiding",
  accommodating: "Accommodating",
};

export function buildRelationshipInterpretation(
  counts: ConflictStyleCounts
): { paragraphs: string[]; demandWithdrawNote?: string } {
  const tiedTop = tiedForDominant(counts);
  const dominantTie = hasDominantTie(counts);
  const { dominant, secondary } = dominantAndSecondary(counts);
  const paras: string[] = [];

  if (dominantTie && tiedTop.length > 1) {
    const names = tiedTop.map((t) => LABEL[t]).join(" and ");
    paras.push(
      `Your scores tie at the top between ${names}. ` +
        `That mix shapes how you pace disagreement, how direct you are, and what you need to feel respected when things get tense.`
    );
  } else {
    const d = LABEL[dominant];
    const s = LABEL[secondary];
    paras.push(
      `Your strongest tendency is toward ${d}, with ${s} showing up as a close second. ` +
        `That mix shapes how you pace disagreement, how direct you are, and what you need to feel respected when things get tense.`
    );
  }

  const topStyles = dominantTie ? tiedTop : [dominant];

  if (
    topStyles.includes("collaborating") ||
    (!dominantTie && (dominant === "collaborating" || secondary === "collaborating"))
  ) {
    paras.push(
      `A strong collaborating streak usually means you do best when both people can slow down enough to understand intent — not just positions. ` +
        `Friction often shows up when time, energy, or safety to go deep is missing.`
    );
  } else if (
    topStyles.includes("compromising") ||
    (!dominantTie && (dominant === "compromising" || secondary === "compromising"))
  ) {
    paras.push(
      `Leaning compromising often reflects a preference for workable outcomes: you may trade something you want to keep momentum and fairness in view. ` +
        `Watch for resentment if compromises feel one-sided over time.`
    );
  } else if (!dominantTie && dominant === "accommodating") {
    paras.push(
      `With accommodating high in your profile, harmony and the other person’s emotional temperature may matter a lot to you — sometimes at the cost of your own position. ` +
        `Naming limits kindly can protect closeness without forcing fake agreement.`
    );
  } else if (!dominantTie && dominant === "avoiding") {
    paras.push(
      `Higher avoiding can be a strength when it prevents damage during flooding — and a risk when important topics keep getting deferred. ` +
        `Pairing avoidance with scheduled follow-through often works better than “later” without a plan.`
    );
  } else if (!dominantTie && dominant === "competing") {
    paras.push(
      `A competing lean often shows up as clarity and conviction — you may push for outcomes you believe are fair or necessary. ` +
        `The relational skill is pairing clarity with repair so intensity doesn’t become disconnection.`
    );
  }

  let demandWithdrawNote: string | undefined;
  const dwSource = dominantTie ? tiedTop[0] : dominant;
  if (dwSource === "competing" || dwSource === "avoiding") {
    demandWithdrawNote =
      `Research on couples often links strong pursue–withdraw cycles to situations where one partner escalates for resolution while the other steps back for safety. ` +
      `If your profile leans ${LABEL[dwSource]}, it can help to name pace explicitly (when to talk, how long, what “pause” means) so escalation doesn’t train the dynamic.`;
  }

  return { paragraphs: paras, demandWithdrawNote };
}

export function styleDisplayName(style: ConflictStyleKey): string {
  return LABEL[style];
}
