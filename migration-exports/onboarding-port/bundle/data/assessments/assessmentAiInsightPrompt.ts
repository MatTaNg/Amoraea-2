/**
 * Shared prompt text for assessment AI insights (client + keep in sync with
 * supabase/functions/assessment-ai-insight/index.ts).
 */

import { attachmentStyleFromScores } from "./insightContent";

export const ASSESSMENT_AI_SYSTEM_PROMPT = `You are a supportive educational writer for a dating-app onboarding flow. The user just completed a published psychological questionnaire (attachment style, conflict approach in disagreements, or Schwartz values).

Rules:
- Write in second person ("you"). Plain text only — no markdown, no bullet stars, no numbered lists. Use short paragraphs separated by blank lines.
- This is reflective coaching, not diagnosis or therapy. Do not claim clinical disorders. Do not give instructions that could replace professional mental health care.
- Ground everything in the numeric summary provided. Do not invent scores.
- Cover: (1) what the pattern tends to look like in relationships, during disagreements, or in values-driven choices (match the instrument), (2) one or two strengths, (3) one growth edge or communication tip, (4) one sentence on how knowing this can help compatibility with a partner.
- Keep total length roughly 180–320 words.
- Warm, specific, non-judgmental tone.`;

export function buildAssessmentAiUserMessage(
  instrument: string,
  scores: Record<string, number>
): string {
  if (instrument === "ECR-36") {
    const anxiety = scores.anxiety ?? 0;
    const avoidance = scores.avoidance ?? 0;
    const style = attachmentStyleFromScores(anxiety, avoidance);
    return [
      `Instrument: ECR-36 / ECR-R (Experiences in Close Relationships — Revised; anxiety and avoidance dimensions).`,
      `Computed pattern label (informational only): ${style}.`,
      `Anxiety mean (1–7): ${anxiety.toFixed(2)}.`,
      `Avoidance mean (1–7): ${avoidance.toFixed(2)}.`,
      `Raw score keys: ${JSON.stringify(scores)}`,
    ].join("\n");
  }
  if (instrument === "CONFLICT-30") {
    const keys = ["competing", "collaborating", "compromising", "avoiding", "accommodating"] as const;
    const ranked = keys.map((k) => ({ k, p: scores[k] ?? 0 })).sort((a, b) => b.p - a.p);
    const dominant = ranked[0]?.k ?? "collaborating";
    const lines = keys.map((k) => `${k}: ${(scores[k] ?? 0).toFixed(1)}% (share of endorsed items)`);
    return [
      `Instrument: CONFLICT-30 (Thomas-Kilmann–style conflict mode profile from scenario choices; percentages are approximate shares of responses).`,
      `Dominant mode (by share): ${dominant}.`,
      ...lines,
      `Raw score object: ${JSON.stringify(scores)}`,
    ].join("\n");
  }
  if (instrument === "PVQ-21") {
    const axes = ["self_transcendence", "self_enhancement", "openness_to_change", "conservation"] as const;
    const parts = axes.map((k) => `${k}: ${(scores[k] ?? 0).toFixed(2)}`);
    const valueKeys = [
      "self_direction",
      "stimulation",
      "hedonism",
      "achievement",
      "power",
      "security",
      "conformity",
      "tradition",
      "benevolence",
      "universalism",
    ];
    const valueLines = valueKeys.map((k) => `${k}: ${(scores[k] ?? 0).toFixed(2)}`);
    return [
      `Instrument: PVQ-21 / Schwartz Values (20 portrait-value items; legacy id PVQ-21). Domain keys without raw_ prefix are MRAT-centered; raw_* keys are uncentered domain means (1–6).`,
      `Higher-order axes (centered): ${parts.join("; ")}.`,
      `Ten value domains (centered): ${valueLines.join("; ")}.`,
      `Full JSON: ${JSON.stringify(scores)}`,
    ].join("\n");
  }
  return JSON.stringify(scores);
}
