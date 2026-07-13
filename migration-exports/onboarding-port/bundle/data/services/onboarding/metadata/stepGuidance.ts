/**
 * Get guidance text for onboarding steps
 */
export function getStepGuidance(step: string): string {
  const guidance: Record<string, string> = {
    "basic-info":
      "Tell us about yourself so we can find your perfect matches.",
    "additional-info":
      "Share some additional lifestyle information to help us find better matches. All fields are optional.",
    availability:
      "Set your availability for video calls and provide your contact information. This will only be shared with matches you agree to meet up with.",
    "attachment-test":
      "Understanding your attachment style helps us find compatible partners. This takes about 5-8 minutes and focuses on how you connect in relationships.",
    "big-five-test":
      "This personality assessment takes 10-12 minutes and helps us understand your core traits for better matching.",
    "spiral-dynamics-test":
      "This values assessment takes 15-25 minutes and helps us match you with people who share your worldview and life approach.",
    "human-design":
      "Optional but recommended: Your birth details help us understand your energetic compatibility. Check your birth certificate for accuracy.",
    "life-domains":
      "Rate your satisfaction level (0-100) for each life domain. This helps us understand your current life balance and find compatible matches.",
    "optional-typologies":
      "Complete additional personality assessments to enhance your matching. All of these are optional and can be skipped.",
    "life-domain-questions":
      "Answer questions about your life domains to help potential matches understand you better. Only answer questions that resonate with you.",
  };

  return (
    guidance[step] || "Complete this step to continue building your profile."
  );
}

