import { useQuery } from '@tanstack/react-query';
import { TypologyRepository } from '@data/repositories/TypologyRepository';
import { CompatibilityRepository } from '@data/repositories/CompatibilityRepository';
import { TypologyType } from '@domain/models/Typology';

const typologyRepository = new TypologyRepository();
const compatibilityRepository = new CompatibilityRepository();

const TYPOLOGY_TYPES: TypologyType[] = ['big_five', 'attachment_style', 'schwartz_values'];
const TOTAL_TYPOLOGIES = 3;
const TOTAL_REQUIREMENTS = 4; // 3 typologies + compatibility (contacts are optional)

async function getProfileCompletion(userId: string) {
  const [typologyResults, compatibility] = await Promise.all([
    Promise.all(TYPOLOGY_TYPES.map((type) => typologyRepository.getTypology(userId, type))),
    compatibilityRepository.getCompatibility(userId),
  ]);

  const completedTypologyCount = typologyResults.filter((t) => t !== null).length;
  const hasCompatibility = compatibility !== null;

  const typologyComplete = completedTypologyCount >= TOTAL_TYPOLOGIES;

  const completedCount = completedTypologyCount + (hasCompatibility ? 1 : 0);

  return {
    completedCount,
    totalCount: TOTAL_REQUIREMENTS,
    completedTypologyCount,
    totalTypologies: TOTAL_TYPOLOGIES,
    hasCompatibility,
    isComplete: typologyComplete && hasCompatibility,
  };
}

export function useProfileCompletion(userId: string | undefined) {
  return useQuery({
    queryKey: ['profileCompletion', userId],
    queryFn: () => getProfileCompletion(userId!),
    enabled: !!userId,
  });
}
