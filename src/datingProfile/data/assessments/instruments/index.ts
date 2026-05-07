import type { AssessmentId } from "@/data/services/assessmentService";
import { ECR_R_ITEMS } from "./ecrItems";
import { scoreECR36 } from "./ecr36";
import { BFI2_ITEMS, scoreBFI2 } from "./bfi2";
import { DSIR_ITEMS, scoreDSIR } from "./dsir";
import { BRS_ITEMS, scoreBRS } from "./brs";
import { PVQ21_ITEMS, scorePVQ21 } from "./pvq21";

export interface InstrumentConfig {
  id: AssessmentId;
  title: string;
  description: string;
  items: string[];
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
  score: (responses: Record<string, number>) => Record<string, number>;
}

export const INSTRUMENT_CONFIGS: Record<AssessmentId, InstrumentConfig> = {
  "ECR-36": {
    id: "ECR-36",
    title: "Attachment Style",
    description:
      "36 questions · ~8 minutes (ECR-R)\n\nThese questions explore how you typically feel in close relationships — with romantic partners or people you're deeply connected to.\n\nThere are no right or wrong answers.",
    items: ECR_R_ITEMS.map((i) => i.text),
    min: 1,
    max: 7,
    minLabel: "Disagree strongly",
    maxLabel: "Agree strongly",
    score: scoreECR36,
  },
  "BFI-2": {
    id: "BFI-2",
    title: "Personality",
    description:
      "60 questions · ~12 minutes\n\nThese questions describe different ways people think, feel, and behave. Rate how well each statement describes you.",
    items: BFI2_ITEMS,
    min: 1,
    max: 5,
    minLabel: "Disagree strongly",
    maxLabel: "Agree strongly",
    score: scoreBFI2,
  },
  "DSI-R": {
    id: "DSI-R",
    title: "How You Show Up in Relationships",
    description:
      "46 questions · ~9 minutes\n\nThese questions explore how you manage your own emotions and sense of self within close relationships. Think about your most important relationships as you answer.",
    items: DSIR_ITEMS,
    min: 1,
    max: 6,
    minLabel: "Not at all true of me",
    maxLabel: "Very true of me",
    score: scoreDSIR,
  },
  BRS: {
    id: "BRS",
    title: "Resilience",
    description:
      "6 questions · ~2 minutes\n\nThese questions explore how you bounce back from stress and difficult experiences.",
    items: BRS_ITEMS,
    min: 1,
    max: 5,
    minLabel: "Strongly disagree",
    maxLabel: "Strongly agree",
    score: scoreBRS,
  },
  "PVQ-21": {
    id: "PVQ-21",
    title: "Schwartz Values",
    description:
      "20 questions · ~4 minutes\n\nEach question describes a person. Read the description and indicate how much that person is like you.",
    items: PVQ21_ITEMS,
    min: 1,
    max: 6,
    minLabel: "Not like me at all",
    maxLabel: "Very much like me",
    score: scorePVQ21,
  },
};

export function getInstrumentConfig(id: string): InstrumentConfig | null {
  return INSTRUMENT_CONFIGS[id as AssessmentId] ?? null;
}
