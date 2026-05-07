import type { AssessmentId } from "@/data/services/assessmentService";
import type { AssessmentInsightSnapshot } from "@/src/types";
import type { ConflictStyleKey } from "@/data/assessments/instruments/conflictStyleTypes";
import { CONFLICT_STYLE_KEYS } from "@/data/assessments/instruments/conflictStyleTypes";
import { styleDisplayName } from "@/data/assessments/conflictStyleResultsNarrative";

export interface InsightContent {
  headline: string;
  body: string;
  growthEdge: string;
  nextTitle: string | null;
  nextMeta: string | null;
  isFinal: boolean;
  details?: Array<{ label: string; value: string; description: string }>;
}

type InsightRow = { label: string; value: string; description: string };

function toTitleCase(input: string): string {
  return input
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

/** ECR-R anxiety/avoidance means (1–7) → quadrant label (midpoint split at 4.0). */
export function attachmentStyleFromScores(anxiety: number, avoidance: number): string {
  const threshold = 4.0;
  const highAnx = anxiety >= threshold;
  const highAvo = avoidance >= threshold;
  if (!highAnx && !highAvo) return "Secure";
  if (highAnx && !highAvo) return "Anxious-Preoccupied";
  if (!highAnx && highAvo) return "Dismissive-Avoidant";
  return "Fearful-Avoidant";
}

/** One-line explanation of the attachment style label (ECR-36 quadrants). */
export function attachmentStyleSummary(style: string): string {
  const s = String(style ?? "").trim();
  const map: Record<string, string> = {
    Secure:
      "Comfortable with closeness when it is mutual; generally trusts that a partner will be there.",
    "Anxious-Preoccupied":
      "Sensitive to distance or ambiguity; often benefits from clear reassurance and steady follow-through.",
    "Dismissive-Avoidant":
      "Values self-reliance; under stress may lean on space and emotional independence.",
    "Fearful-Avoidant":
      "Wants closeness but fears being hurt; may alternate between seeking and withdrawing.",
    Mixed: "Your pattern blends tendencies; how you show up can shift with stress and context.",
  };
  return map[s] ?? map.Mixed;
}

/** What the anxiety dimension measures (ECR-36, 1–7). */
export const ATTACHMENT_ANXIETY_DESCRIPTION =
  "Anxiety here reflects fear of abandonment and need for reassurance. Higher scores often mean more sensitivity to silence, distance, or mixed signals.";

/** What the avoidance dimension measures (ECR-36, 1–7). */
export const ATTACHMENT_AVOIDANCE_DESCRIPTION =
  "Avoidance reflects discomfort with emotional dependence. Higher scores often mean a stronger preference for space, self-reliance, and privacy during conflict.";

function attachmentBand(v: number): "Low" | "Moderate" | "High" {
  if (v < 3.25) return "Low";
  if (v < 4.75) return "Moderate";
  return "High";
}

function valueBand(v: number): "Low" | "Moderate" | "High" {
  if (v <= -0.35) return "Low";
  if (v >= 0.35) return "High";
  return "Moderate";
}

function formatSigned(v: number): string {
  const rounded = Math.round(v * 100) / 100;
  return `${rounded > 0 ? "+" : ""}${rounded.toFixed(2)}`;
}

function attachmentDetails(scores: Record<string, number>): InsightRow[] {
  const anxiety = scores.anxiety ?? 0;
  const avoidance = scores.avoidance ?? 0;
  const style = attachmentStyleFromScores(anxiety, avoidance);

  const anxietyBand = attachmentBand(anxiety);
  const avoidanceBand = attachmentBand(avoidance);

  return [
    {
      label: "Attachment Style",
      value: style,
      description:
        style === "Secure"
          ? "You generally feel safe with closeness and trust. You can ask for support without feeling overwhelmed by intimacy."
          : "This style reflects your default pattern under relational stress. Awareness helps you communicate needs clearly and choose responses that protect connection.",
    },
    {
      label: "Anxiety",
      value: `${anxietyBand} (${anxiety.toFixed(2)} / 7)`,
      description:
        "Anxiety reflects fear of abandonment and need for reassurance. Higher scores often mean stronger sensitivity to distance, delayed replies, or mixed signals.",
    },
    {
      label: "Avoidance",
      value: `${avoidanceBand} (${avoidance.toFixed(2)} / 7)`,
      description:
        "Avoidance reflects discomfort with emotional dependence. Higher scores often mean stronger preference for space, self-reliance, and emotional privacy during conflict.",
    },
  ];
}

/** Short blurbs for each Schwartz / PVQ dimension (match profile card, insights, etc.). */
export const SCHWARTZ_VALUE_DESCRIPTIONS: Record<string, string> = {
  self_direction:
    "Valuing independent thought, creativity, and freedom to choose your own path.",
  stimulation:
    "Valuing novelty, challenge, variety, and emotionally energizing experiences.",
  hedonism:
    "Valuing pleasure, enjoyment, and making room for delight in daily life.",
  achievement:
    "Valuing personal success, competence, and being recognized for what you do well.",
  power:
    "Valuing influence, status, and the ability to shape outcomes and resources.",
  security:
    "Valuing safety, predictability, stability, and protection from threat or chaos.",
  conformity:
    "Valuing self-discipline, reliability, and following norms that keep social order.",
  tradition:
    "Valuing customs, heritage, and practices that connect you to identity and belonging.",
  benevolence:
    "Valuing loyalty, care, and actively supporting the people close to you.",
  universalism:
    "Valuing fairness, inclusion, and concern for all people and the wider world.",
};

/** Map UI label like "Self Direction" to `self_direction` for {@link SCHWARTZ_VALUE_DESCRIPTIONS}. */
export function schwartzRowLabelToKey(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, "_");
}

export function descriptionForSchwartzRowLabel(label: string): string {
  const key = schwartzRowLabelToKey(label);
  return SCHWARTZ_VALUE_DESCRIPTIONS[key] ?? "";
}

const PVQ_DESCRIPTIONS = SCHWARTZ_VALUE_DESCRIPTIONS;

function pvqDetails(scores: Record<string, number>): InsightRow[] {
  const keys = [
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

  return keys.map((k) => {
    const raw = scores[k] ?? 0;
    const band = valueBand(raw);
    return {
      label: toTitleCase(k),
      value: `${band} (${formatSigned(raw)})`,
      description: PVQ_DESCRIPTIONS[k] || "",
    };
  });
}

const CONFLICT_STYLE_DETAIL: Record<
  ConflictStyleKey,
  { description: string }
> = {
  competing: {
    description:
      "Direct and assertive under disagreement; comfortable pushing for outcomes you believe in.",
  },
  collaborating: {
    description:
      "Seeks integrative solutions and mutual understanding; invests in working through tension.",
  },
  compromising: {
    description:
      "Looks for workable middle ground; trades concessions to restore momentum and fairness.",
  },
  avoiding: {
    description:
      "Tends to defer or step back until timing feels safer; may need explicit invitations to engage.",
  },
  accommodating: {
    description:
      "Prioritizes harmony and the other person’s needs; watch for one-sided concessions over time.",
  },
};

function conflict30Details(scores: Record<string, number>): InsightRow[] {
  return CONFLICT_STYLE_KEYS.map((k) => {
    const pct = scores[k] ?? 0;
    return {
      label: styleDisplayName(k),
      value: `${Math.round(pct)}% of responses`,
      description: CONFLICT_STYLE_DETAIL[k].description,
    };
  });
}

export function buildDetailedInsightRows(
  instrument: AssessmentId,
  scores: Record<string, number>
): InsightRow[] {
  switch (instrument) {
    case "ECR-36":
      return attachmentDetails(scores);
    case "PVQ-21":
      return pvqDetails(scores);
    case "CONFLICT-30":
      return conflict30Details(scores);
    default:
      return Object.entries(scores).map(([k, v]) => ({
        label: toTitleCase(k),
        value: typeof v === "number" ? v.toFixed(2) : String(v),
        description: "",
      }));
  }
}

function ecr36Insight(scores: Record<string, number>): InsightContent {
  const anxiety = scores.anxiety ?? 0;
  const avoidance = scores.avoidance ?? 0;
  const style = attachmentStyleFromScores(anxiety, avoidance);

  const headline =
    style === "Secure"
      ? "You show a secure attachment pattern."
      : `Your pattern suggests ${style} attachment.`;

  const body =
    style === "Secure"
      ? "You're comfortable with closeness and tend not to worry excessively about being abandoned or overwhelmed by intimacy. Under stress, you generally reach toward the people you care about rather than away from them."
      : "Your scores reflect how you typically feel in close relationships. There are no right or wrong patterns — awareness helps you and your matches connect more honestly.";

  const growthEdge =
    style === "Secure"
      ? "The growth edge for securely attached people is often complacency — intimacy still needs active tending."
      : "Understanding your pattern can help you communicate your needs and respond to partners with more clarity.";

  return {
    headline,
    body,
    growthEdge,
    nextTitle: "Conflict style",
    nextMeta: "30 scenarios · ~8 minutes",
    isFinal: false,
    details: attachmentDetails(scores),
  };
}

function bfi2Insight(scores: Record<string, number>): InsightContent {
  const traits = [
    { key: "extraversion", label: "Extraversion" },
    { key: "agreeableness", label: "Agreeableness" },
    { key: "conscientiousness", label: "Conscientiousness" },
    { key: "neuroticism", label: "Neuroticism" },
    { key: "openness", label: "Openness" },
  ];
  const withVal = traits.map((t) => ({
    ...t,
    value: scores[t.key] ?? 0,
  }));
  withVal.sort((a, b) => b.value - a.value);
  const high = withVal[0];
  const low = withVal[withVal.length - 1];
  const headline = `You tend to be relatively high on ${high?.label} and lower on ${low?.label}.`;
  const body =
    "In relationships, Agreeableness and Neuroticism are especially predictive of compatibility. Your profile helps us match you with people who fit how you interact and handle stress.";
  const growthEdge =
    "Noting where you're high or low can help you spot both strengths and blind spots in partnership.";
  return {
    headline,
    body,
    growthEdge,
    nextTitle: "Differentiation of Self",
    nextMeta: "46 questions · ~9 minutes",
    isFinal: false,
  };
}

function dsirInsight(scores: Record<string, number>): InsightContent {
  const overall = scores.overall ?? 0;
  const level =
    overall >= 4.2 ? "high" : overall <= 2.8 ? "low" : "moderate";
  const subscales = [
    { key: "emotional_reactivity", label: "Emotional Reactivity" },
    { key: "i_position", label: "I-Position" },
    { key: "emotional_cutoff", label: "Emotional Cutoff" },
    { key: "fusion_with_others", label: "Fusion with Others" },
  ];
  const withVal = subscales.map((s) => ({
    ...s,
    value: scores[s.key] ?? 0,
  }));
  withVal.sort((a, b) => a.value - b.value);
  const lowest = withVal[0];
  const headline = `You show ${level} differentiation of self.`;
  const body =
    "Differentiation reflects how well you can stay calm, hold your own values, and stay connected without losing yourself. Your scores suggest where you're strongest and where there's room to grow.";
  const growthEdge = lowest
    ? `Your lowest area is ${lowest.label} — that's often the most fruitful growth edge in close relationships.`
    : "Focusing on one subscale at a time can make growth feel more manageable.";
  return {
    headline,
    body,
    growthEdge,
    nextTitle: "Resilience",
    nextMeta: "6 questions · ~2 minutes",
    isFinal: false,
  };
}

function brsInsight(scores: Record<string, number>): InsightContent {
  const resilience = scores.resilience ?? 0;
  const level = resilience >= 3.5 ? "High" : resilience <= 2.5 ? "Low" : "Moderate";
  const headline = `${level} resilience.`;
  const body =
    "Resilience is how quickly you bounce back from stress. It doesn't mean you don't feel difficulty — it means you recover and adapt. This matters in relationships when conflicts or setbacks occur.";
  const growthEdge =
    "If your score is lower than you'd like, small practices (sleep, support, reframing) can build resilience over time.";
  return {
    headline,
    body,
    growthEdge,
    nextTitle: "Core Values",
    nextMeta: "20 questions · ~4 minutes",
    isFinal: false,
  };
}

function conflict30Insight(scores: Record<string, number>): InsightContent {
  const ranked = [...CONFLICT_STYLE_KEYS]
    .map((k) => ({ k, p: scores[k] ?? 0 }))
    .sort((a, b) => b.p - a.p);
  const dom = ranked[0]?.k ?? "collaborating";
  const second = ranked[1];
  const domLabel = styleDisplayName(dom);
  const headline = `Your leading conflict approach is ${domLabel}.`;
  const body =
    second && second.p > 0 && second.k !== dom
      ? `${domLabel} is strongest in your profile, with ${styleDisplayName(second.k)} close behind. That blend shapes how you pace disagreements, how direct you are, and what helps you feel respected when things get tense.`
      : `Your profile centers on ${domLabel}. How you show up in conflict is a strength to know — it helps you and matches communicate with less guesswork.`;
  const growthEdge =
    "No single style is “best.” The growth edge is often flexibility: naming pace, limits, and what you need when your default style isn’t getting you connection or clarity.";
  return {
    headline,
    body,
    growthEdge,
    nextTitle: "Schwartz Values",
    nextMeta: "20 questions · ~4 minutes",
    isFinal: false,
    details: conflict30Details(scores),
  };
}

function pvq21Insight(scores: Record<string, number>): InsightContent {
  const axes = [
    { key: "self_transcendence", label: "Self-Transcendence" },
    { key: "self_enhancement", label: "Self-Enhancement" },
    { key: "openness_to_change", label: "Openness to Change" },
    { key: "conservation", label: "Conservation" },
  ];
  const withVal = axes.map((a) => ({
    ...a,
    value: scores[a.key] ?? 0,
  }));
  withVal.sort((a, b) => b.value - a.value);
  const dominant = withVal[0];
  const lowest = withVal[3];
  const gap = (dominant?.value ?? 0) - (lowest?.value ?? 0);
  const headline = dominant
    ? `Your dominant values axis is ${dominant.label}.`
    : "Your core values profile is complete.";
  const body =
    gap > 1.0 && lowest
      ? `There's a noticeable tension between ${dominant?.label} and ${lowest?.label}. That contrast often shapes what you look for in a partner.`
      : "Your values help us match you with people who share what matters most.";
  const growthEdge =
    "Values aren't right or wrong — they're what give your life meaning. Partners who get that tend to connect more deeply.";
  return {
    headline,
    body,
    growthEdge,
    nextTitle: null,
    nextMeta: null,
    isFinal: true,
    details: pvqDetails(scores),
  };
}

export function getInsightContent(
  instrument: AssessmentId,
  scores: Record<string, number>
): InsightContent {
  switch (instrument) {
    case "ECR-36":
      return ecr36Insight(scores);
    case "BFI-2":
      return bfi2Insight(scores);
    case "DSI-R":
      return dsirInsight(scores);
    case "BRS":
      return brsInsight(scores);
    case "PVQ-21":
      return pvq21Insight(scores);
    case "CONFLICT-30":
      return conflict30Insight(scores);
    default:
      return {
        headline: "Assessment complete.",
        body: "Your responses have been saved.",
        growthEdge: "",
        nextTitle: null,
        nextMeta: null,
        isFinal: false,
      };
  }
}

export const INSTRUMENT_TITLES: Record<AssessmentId, string> = {
  "ECR-36": "Attachment Style",
  "BFI-2": "Personality",
  "DSI-R": "Differentiation of Self",
  BRS: "Resilience",
  "PVQ-21": "Schwartz Values",
  "CONFLICT-30": "Conflict Style",
};

/**
 * Build the same snapshot the onboarding insight screen uses, from stored test_results.result_data.
 * Backfills headline/body/details from scores when older rows lack insightSnapshot.
 */
export function parseStoredAssessmentInsight(
  resultData: unknown,
  instrument: AssessmentId
): AssessmentInsightSnapshot | null {
  if (!resultData || typeof resultData !== "object" || Array.isArray(resultData)) {
    return null;
  }
  const rd = resultData as Record<string, unknown>;
  const scores = rd.scores;
  if (!scores || typeof scores !== "object" || Array.isArray(scores)) {
    return null;
  }
  const numScores = scores as Record<string, number>;
  if (Object.keys(numScores).length === 0) {
    return null;
  }

  const snap =
    rd.insightSnapshot && typeof rd.insightSnapshot === "object" && !Array.isArray(rd.insightSnapshot)
      ? (rd.insightSnapshot as Record<string, unknown>)
      : null;

  let headline = snap ? String(snap.headline ?? "") : "";
  let body = snap ? String(snap.body ?? "") : "";
  let growthEdge = snap ? String(snap.growthEdge ?? "") : "";

  if (!headline) {
    const c = getInsightContent(instrument, numScores);
    headline = c.headline;
    body = c.body;
    growthEdge = c.growthEdge;
  }

  let details = rd.details;
  if (!Array.isArray(details) || details.length === 0) {
    details = buildDetailedInsightRows(instrument, numScores);
  }

  const normDetails = (Array.isArray(details) ? details : []).map((d) => {
    if (!d || typeof d !== "object") {
      return { label: "", value: "", description: "" };
    }
    const o = d as Record<string, unknown>;
    return {
      label: String(o.label ?? ""),
      value: String(o.value ?? ""),
      description: String(o.description ?? ""),
    };
  });

  const aiRaw = rd.aiReflectionParagraphs;
  const aiParagraphs = Array.isArray(aiRaw)
    ? aiRaw.map((x) => String(x)).filter((s) => s.length > 0)
    : undefined;

  return {
    instrumentLabel: INSTRUMENT_TITLES[instrument] ?? instrument,
    headline,
    body,
    growthEdge,
    details: normDetails,
    aiParagraphs: aiParagraphs?.length ? aiParagraphs : undefined,
  };
}
