import { useQuery } from '@tanstack/react-query';
import { TypologyRepository } from '@data/repositories/TypologyRepository';
import { CompatibilityRepository } from '@data/repositories/CompatibilityRepository';
import { isFullAssessmentComplete } from '@features/assessment/assessmentData';
import type { FullAssessmentData } from '@features/assessment/assessmentData';

const typologyRepository = new TypologyRepository();
const compatibilityRepository = new CompatibilityRepository();

const TOTAL_REQUIREMENTS = 2; // full assessment + compatibility

async function getProfileCompletion(userId: string) {
  const [fullAssessment, compatibility] = await Promise.all([
    typologyRepository.getTypology(userId, 'full_assessment'),
    compatibilityRepository.getCompatibility(userId),
  ]);

  const fullAssessmentData = fullAssessment?.typologyData as FullAssessmentData | undefined;
  const hasFullAssessment = isFullAssessmentComplete(fullAssessmentData ?? null);
  const hasCompatibility = compatibility !== null;

  const completedCount = (hasFullAssessment ? 1 : 0) + (hasCompatibility ? 1 : 0);

  return {
    completedCount,
    totalCount: TOTAL_REQUIREMENTS,
    completedTypologyCount: hasFullAssessment ? 1 : 0,
    totalTypologies: 1,
    hasCompatibility,
    hasFullAssessment,
    isComplete: hasFullAssessment && hasCompatibility,
  };
}

export function useProfileCompletion(userId: string | undefined) {
  return useQuery({
    queryKey: ['profileCompletion', userId],
    queryFn: () => getProfileCompletion(userId!),
    enabled: !!userId,
  });
}
