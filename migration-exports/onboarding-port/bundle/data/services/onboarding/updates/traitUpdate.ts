import { traitsRepo } from "@/data/repos/traitsRepo";
import { Result, TraitScores } from "@/src/types";

/**
 * Update trait scores from completed assessments
 */
export async function updateTraitScores(
  userId: string,
  traitUpdates: Partial<Omit<TraitScores, "userId" | "updatedAt">>
): Promise<Result<TraitScores>> {
  try {
    const result = await traitsRepo.updateTraitScores(userId, traitUpdates);
    return result;
  } catch (error) {
    return { success: false, error: error as Error };
  }
}

