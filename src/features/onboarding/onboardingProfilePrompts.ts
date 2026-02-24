/**
 * Fixed set of 15 profile prompts for Stage 4 onboarding.
 * Each answer must be 20–300 characters.
 */

export interface OnboardingPromptItem {
  id: string;
  text: string;
}

export const ONBOARDING_PROFILE_PROMPTS: OnboardingPromptItem[] = [
  { id: 'values_good_day', text: 'What does a good day look like for you?' },
  { id: 'values_better_at', text: 'What are you better at than most people?' },
  { id: 'values_changed_mind', text: "What's the last thing you changed your mind about?" },
  { id: 'lifestyle_ideal_weekend', text: "What does your ideal weekend look like?" },
  { id: 'lifestyle_need_more', text: "What do you need more of in your life right now?" },
  { id: 'humor_hill', text: "What's a hill you'll die on?" },
  { id: 'humor_irrational', text: "What's your most irrational opinion?" },
  { id: 'relational_show_care', text: 'How do you show someone you care about them?' },
  { id: 'relational_loyalty', text: 'What does loyalty mean to you?' },
  { id: 'relational_stressed', text: "When you're stressed, what do you actually need from the people around you?" },
  { id: 'ambition_becoming', text: 'What are you working on becoming?' },
  { id: 'ambition_proud', text: "What's something you're proud of that wouldn't fit on a resume?" },
  { id: 'depth_belief', text: "What's a belief you hold that you can't fully justify?" },
  { id: 'depth_takes_time', text: "What's something about you that takes time to see?" },
  { id: 'depth_working_on', text: "What's a quality you're still working on?" },
];

export const PROMPT_ANSWER_MIN = 20;
export const PROMPT_ANSWER_MAX = 300;
