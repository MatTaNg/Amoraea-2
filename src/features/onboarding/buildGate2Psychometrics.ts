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
} from '@features/assessment/assessmentData';

function ecrClassification(anxiety: number, avoidance: number): string {
  if (anxiety < 3 && avoidance < 3) return 'Secure';
  if (anxiety >= 4 && avoidance < 3) return 'Anxious-Preoccupied';
  if (anxiety < 3 && avoidance >= 4) return 'Dismissive-Avoidant';
  return 'Fearful-Avoidant';
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
