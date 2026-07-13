import { ECR_R_ITEMS } from "./ecrItems";

export interface ECRScores {
  anxiety: number;
  avoidance: number;
}

function rawForItem(responses: Record<string, number>, itemId: number): number {
  const v = responses[String(itemId)];
  return typeof v === "number" && Number.isFinite(v) ? v : NaN;
}

/** Mean of keyed responses (1–7 raw) after reversals; keys are canonical 1-based item ids. */
export function scoreECRR(responses: Record<string, number>): ECRScores {
  const reverseScore = (raw: number): number => 8 - raw;

  const anxietyItems = ECR_R_ITEMS.filter((i) => i.subscale === "anxiety");
  const avoidanceItems = ECR_R_ITEMS.filter((i) => i.subscale === "avoidance");

  const mean = (items: typeof ECR_R_ITEMS): number => {
    const total = items.reduce((sum, item) => {
      const raw = rawForItem(responses, item.id);
      const scored = item.reversed ? reverseScore(raw) : raw;
      return sum + scored;
    }, 0);
    return total / items.length;
  };

  return {
    anxiety: mean(anxietyItems),
    avoidance: mean(avoidanceItems),
  };
}

/** @deprecated Use scoreECRR; kept for instrument registry */
export function scoreECR36(responses: Record<string, number>): ECRScores {
  return scoreECRR(responses);
}

export type AttachmentStyle = "secure" | "anxious" | "avoidant" | "disorganised";

export function classifyAttachment(scores: ECRScores): AttachmentStyle {
  const threshold = 4.0;
  const highAnx = scores.anxiety >= threshold;
  const highAvo = scores.avoidance >= threshold;

  if (!highAnx && !highAvo) return "secure";
  if (highAnx && !highAvo) return "anxious";
  if (!highAnx && highAvo) return "avoidant";
  return "disorganised";
}
