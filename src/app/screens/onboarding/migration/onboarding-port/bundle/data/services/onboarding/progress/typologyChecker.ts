import { TraitScores } from "@/src/types";

/**
 * Check if attachment test is completed
 */
export function checkAttachmentTestCompleted(traits: TraitScores | null): boolean {
  return !!(
    traits?.attachmentAnxious !== undefined &&
    traits?.attachmentAvoidant !== undefined
  );
}

/**
 * Check if Big Five test is completed
 */
export function checkBigFiveTestCompleted(traits: TraitScores | null): boolean {
  return !!(
    traits?.openness !== undefined &&
    traits?.conscientiousness !== undefined &&
    traits?.extraversion !== undefined &&
    traits?.agreeableness !== undefined &&
    traits?.neuroticism !== undefined
  );
}

/**
 * Check if Spiral Dynamics test is completed
 */
export function checkSpiralDynamicsTestCompleted(traits: TraitScores | null): boolean {
  return traits?.spiralLevel !== undefined;
}

/**
 * Check if Human Design is completed
 */
export function checkHumanDesignCompleted(traits: TraitScores | null): boolean {
  return !!(
    traits?.humanDesignType ||
    traits?.humanDesignProfile ||
    traits?.humanDesignCenters
  );
}

