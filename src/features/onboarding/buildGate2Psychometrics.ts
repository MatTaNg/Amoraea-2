/**
 * Build Gate2Psychometrics from FullAssessmentData (raw ECR/TIPI/DSI/BRS/PVQ answers).
 * Used by Stage 3 onboarding psychometrics flow.
 */

import type { Gate2Psychometrics } from '@domain/models/OnboardingGates';
import type { FullAssessmentData } from '@features/assessment/assessmentData';
import {
  scoreECR,
  scoreTIPI,
  scoreDSI,
  scoreBRS,
  scorePVQ,
  isFullAssessmentComplete,
  ECR12,
  TIPI,
  DSI,
  BRS,
  PVQ21,
} from '@features/assessment/assessmentData';

function ecrClassification(anxiety: number, avoidance: number): string {
  if (anxiety < 3 && avoidance < 3) return 'Secure';
  if (anxiety >= 4 && avoidance < 3) return 'Anxious-Preoccupied';
  if (anxiety < 3 && avoidance >= 4) return 'Dismissive-Avoidant';
  return 'Fearful-Avoidant';
}

export type SectionId = 'ecr' | 'tipi' | 'dsi' | 'brs' | 'pvq';

/** Human-readable summary for one section (for interstitial "your results" screen). */
export interface SectionSummary {
  sectionId: SectionId;
  title: string;
  lines: string[];
}

function isSectionComplete(sectionId: SectionId, data: FullAssessmentData): boolean {
  switch (sectionId) {
    case 'ecr': return Object.keys(data.ecr).length >= ECR12.length;
    case 'tipi': return Object.keys(data.tipi).length >= TIPI.length;
    case 'dsi': return Object.keys(data.dsi).length >= DSI.length;
    case 'brs': return Object.keys(data.brs).length >= BRS.length;
    case 'pvq': return Object.keys(data.pvq).length >= PVQ21.length;
    default: return false;
  }
}

export function getSectionSummary(sectionId: SectionId, data: FullAssessmentData): SectionSummary | null {
  if (!isSectionComplete(sectionId, data)) return null;
  const round = (n: number) => Math.round(n * 100) / 100;
  switch (sectionId) {
    case 'ecr': {
      const ecr = scoreECR(data.ecr);
      const classification = ecrClassification(ecr.anxiety, ecr.avoidance);
      return {
        sectionId: 'ecr',
        title: 'Attachment (ECR-12)',
        lines: [
          `Anxiety: ${round(ecr.anxiety)}`,
          `Avoidance: ${round(ecr.avoidance)}`,
          `Style: ${classification}`,
        ],
      };
    }
    case 'tipi': {
      const tipi = scoreTIPI(data.tipi);
      return {
        sectionId: 'tipi',
        title: 'Personality (TIPI)',
        lines: [
          `Extraversion: ${round(tipi.E)}`,
          `Agreeableness: ${round(tipi.A)}`,
          `Conscientiousness: ${round(tipi.C)}`,
          `Neuroticism: ${round(tipi.N)}`,
          `Openness: ${round(tipi.O)}`,
        ],
      };
    }
    case 'dsi': {
      const score = scoreDSI(data.dsi);
      return {
        sectionId: 'dsi',
        title: 'Self & Others (DSI-SF)',
        lines: [`Differentiation score: ${round(score)}`],
      };
    }
    case 'brs': {
      const score = scoreBRS(data.brs);
      return {
        sectionId: 'brs',
        title: 'Resilience (BRS)',
        lines: [`Resilience score: ${round(score)}`],
      };
    }
    case 'pvq': {
      const pvq = scorePVQ(data.pvq);
      const top = [
        ['Self-direction', pvq.self_direction],
        ['Stimulation', pvq.stimulation],
        ['Achievement', pvq.achievement],
        ['Power', pvq.power],
        ['Security', pvq.security],
        ['Conformity', pvq.conformity],
        ['Tradition', pvq.tradition],
        ['Benevolence', pvq.benevolence],
        ['Universalism', pvq.universalism],
      ].sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0)).slice(0, 4);
      return {
        sectionId: 'pvq',
        title: 'Values (PVQ-21)',
        lines: top.map(([label, val]) => `${label}: ${round(val ?? 0)}`),
      };
    }
    default:
      return null;
  }
}

export function buildGate2Psychometrics(data: FullAssessmentData): Gate2Psychometrics | null {
  if (!isFullAssessmentComplete(data)) return null;

  const ecr = scoreECR(data.ecr);
  const tipi = scoreTIPI(data.tipi);
  const dsiScore = scoreDSI(data.dsi);
  const brsScore = scoreBRS(data.brs);
  const pvq = scorePVQ(data.pvq);

  return {
    ecr12: {
      anxious: Math.round(ecr.anxiety * 100) / 100,
      avoidant: Math.round(ecr.avoidance * 100) / 100,
      classification: ecrClassification(ecr.anxiety, ecr.avoidance),
    },
    tipi: {
      extraversion: Math.round(tipi.E * 100) / 100,
      agreeableness: Math.round(tipi.A * 100) / 100,
      conscientiousness: Math.round(tipi.C * 100) / 100,
      neuroticism: Math.round(tipi.N * 100) / 100,
      openness: Math.round(tipi.O * 100) / 100,
    },
    dsisf: {
      satisfactionScore: Math.round(dsiScore * 100) / 100,
    },
    brs: {
      resilienceScore: Math.round(brsScore * 100) / 100,
    },
    pvq21: {
      selfDirection: Math.round((pvq.self_direction ?? 0) * 100) / 100,
      stimulation: Math.round((pvq.stimulation ?? 0) * 100) / 100,
      hedonism: 0,
      achievement: Math.round((pvq.achievement ?? 0) * 100) / 100,
      power: Math.round((pvq.power ?? 0) * 100) / 100,
      security: Math.round((pvq.security ?? 0) * 100) / 100,
      conformity: Math.round((pvq.conformity ?? 0) * 100) / 100,
      tradition: Math.round((pvq.tradition ?? 0) * 100) / 100,
      benevolence: Math.round((pvq.benevolence ?? 0) * 100) / 100,
      universalism: Math.round((pvq.universalism ?? 0) * 100) / 100,
    },
    completedAt: new Date().toISOString(),
  };
}
