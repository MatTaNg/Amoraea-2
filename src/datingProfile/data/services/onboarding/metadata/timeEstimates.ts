/**
 * Get estimated time for remaining onboarding steps
 */
export function getEstimatedTimeForStep(step: string): number {
  const timeEstimates: Record<string, number> = {
    "basic-info": 3, // 3 minutes
    "birth-info": 2, // 2 minutes for birth information
    "filters": 2, // 2 minutes for filter settings
    "additional-info": 5, // 5 minutes
    availability: 3, // 3 minutes to set availability and contact info
    "attachment-test": 7, // 5-8 minutes
    "big-five-test": 11, // 10-12 minutes
    "spiral-dynamics-test": 20, // 15-25 minutes
    "human-design": 5, // 5 minutes for birth info
    "life-domains": 3, // 3 minutes to rate domains
    "optional-typologies": 15, // 15 minutes for optional assessments
    "life-domain-questions": 10, // 10 minutes for questions
  };

  return timeEstimates[step] || 5;
}

