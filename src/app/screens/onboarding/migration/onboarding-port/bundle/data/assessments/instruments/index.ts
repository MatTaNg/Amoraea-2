import type { AssessmentId } from "@/data/services/assessmentService";
import { ECR_R_ITEMS } from "./ecrItems";
import { scoreECR36 } from "./ecr36";
import { BFI2_ITEMS, scoreBFI2 } from "./bfi2";
import { DSIR_ITEMS, scoreDSIR } from "./dsir";
import { BRS_ITEMS, scoreBRS } from "./brs";
import { PVQ21_ITEMS, scorePVQ21 } from "./pvq21";
import {
  RELATIONSHIP_TRAITS_ITEMS,
  scoreRelationshipTraits8,
} from "./relationshipTraits8";

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

/** CONFLICT-30 uses {@link ConflictStyleAssessmentScreen}, not this map. */
export const INSTRUMENT_CONFIGS: Partial<Record<AssessmentId, InstrumentConfig>> = {
  "ECR-36": {
    id: "ECR-36",
    title: "Attachment Style",
    description:
      "The attachment style quiz is a psychology-based assessment that helps you understand how you tend to connect, trust, communicate, and behave in close relationships.\n\nIt's based on Attachment Theory, one of the most researched frameworks in relationship psychology. Originally developed by John Bowlby and expanded by Mary Ainsworth, the theory explains how early emotional experiences shape the way we bond with romantic partners later in life.\n\nThe quiz typically identifies one of four primary attachment styles:\n\nSecure\nComfortable with intimacy, trust, communication, and emotional closeness.\n\nAnxious\nCraves closeness and reassurance, but may fear abandonment or inconsistency.\n\nAvoidant\nValues independence strongly and may pull away when relationships feel emotionally intense.\n\nFearful Avoidant / Disorganized\nSimultaneously wants closeness and fears it, often creating push-pull dynamics.\n\nMost people are not \"100% one type.\" The quiz measures patterns and tendencies, not fixed identity labels.",
    items: ECR_R_ITEMS.map((i) => i.text),
    min: 1,
    max: 7,
    minLabel: "Disagree strongly",
    maxLabel: "Agree strongly",
    score: scoreECR36 as unknown as (responses: Record<string, number>) => Record<string, number>,
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
  "RELATIONSHIP_TRAITS_8": {
    id: "RELATIONSHIP_TRAITS_8",
    title: "Relationship Traits",
    description:
      "A few quick questions about how you tend to respond to stress and trust in relationships.\n\nYou'll rate each statement on a scale from 1 (strongly disagree) to 7 (strongly agree). There are no right or wrong answers — choose what feels most true for you.",
    items: RELATIONSHIP_TRAITS_ITEMS,
    min: 1,
    max: 7,
    minLabel: "Strongly disagree",
    maxLabel: "Strongly agree",
    score: scoreRelationshipTraits8,
  },
  "PVQ-21": {
    id: "PVQ-21",
    title: "Schwartz Values",
    description:
      "What Is the Schwartz Values Quiz?\n\nThe Schwartz Values Quiz measures the deeper values that drive your decisions, priorities, and sense of meaning in life and relationships.\n\nIt's based on the work of Shalom H. Schwartz, whose research identified universal human values found across cultures around the world.\n\nIt has been researched across dozens of countries and cultures and is commonly used in:\n\nPsychology research\nRelationship studies\nOrganizational psychology\nSociology\nLeadership and cultural analysis\n\nThe model is supported by decades of empirical research and cross-cultural validation. It is one of the most respected and widely studied models in social psychology.\n\nRather than measuring personality traits, this quiz measures what fundamentally matters to you.\n\nExamples include:\n\nSecurity and stability\nFreedom and independence\nAdventure and novelty\nAchievement and ambition\nCompassion and empathy\nTradition and family values\nPleasure and enjoyment\nPersonal growth and meaning\n\nThe quiz usually identifies which values are strongest for you and how they compare to other values in your life. Studies have found that similar values are one of the most important metrics of a successful, thriving, long-lasting relationship of any kind.",
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
