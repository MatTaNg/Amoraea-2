/**
 * Profile prompts by category (Hinge-style). UX only — not used by matching algorithm.
 * Users can pick at most 3 prompts and give free-form answers.
 */

export interface PromptOption {
  id: string;
  text: string;
}

export interface PromptCategory {
  id: string;
  title: string;
  prompts: PromptOption[];
}

export const PROMPT_CATEGORIES: PromptCategory[] = [
  {
    id: 'values',
    title: 'Reveals values and priorities',
    prompts: [
      { id: 'values_good_day', text: 'What does a good day look like for you?' },
      { id: 'values_better_at', text: 'What are you better at than most people?' },
      { id: 'values_dont_understand', text: "What's something most people do that you don't understand?" },
      { id: 'values_money_no_factor', text: "What would you do with your time if money wasn't a factor?" },
      { id: 'values_changed_mind', text: "What's the last thing you changed your mind about?" },
    ],
  },
  {
    id: 'lifestyle',
    title: 'Reveals lifestyle and energy',
    prompts: [
      { id: 'lifestyle_ideal_weekend', text: "What does your ideal weekend look like?" },
      { id: 'lifestyle_phone', text: "What's your relationship with your phone like?" },
      { id: 'lifestyle_problems', text: 'Are you someone people come to with their problems?' },
      { id: 'lifestyle_after_social', text: 'How do you feel after a big social event?' },
      { id: 'lifestyle_need_more', text: "What do you need more of in your life right now?" },
    ],
  },
  {
    id: 'humor',
    title: 'Reveals humor and personality',
    prompts: [
      { id: 'humor_hill', text: "What's a hill you'll die on?" },
      { id: 'humor_irrational', text: "What's your most irrational opinion?" },
      { id: 'humor_snob', text: 'What are you a snob about?' },
      { id: 'humor_embarrassed', text: "What do you do that you'd be embarrassed to explain to a stranger?" },
      { id: 'humor_differently', text: "What's something you do differently from everyone you know?" },
    ],
  },
  {
    id: 'relational',
    title: 'Reveals relational style',
    prompts: [
      { id: 'relational_show_care', text: 'How do you show someone you care about them?' },
      { id: 'relational_loyalty', text: 'What does loyalty mean to you?' },
      { id: 'relational_learned', text: "What's the most important thing you learned from your last relationship?" },
      { id: 'relational_hard_to_ask', text: "What do you need from a partner that you'd find hard to ask for?" },
      { id: 'relational_stressed', text: "When you're stressed, what do you actually need from the people around you?" },
    ],
  },
  {
    id: 'ambition',
    title: 'Reveals ambition and growth',
    prompts: [
      { id: 'ambition_becoming', text: 'What are you working on becoming?' },
      { id: 'ambition_proud', text: "What's something you're proud of that wouldn't fit on a resume?" },
      { id: 'ambition_skill', text: "What's a skill you've put real time into?" },
      { id: 'ambition_ten_years', text: "What do you want your life to look like in ten years — specifically?" },
    ],
  },
  {
    id: 'depth',
    title: 'Reveals depth and self-awareness',
    prompts: [
      { id: 'depth_belief', text: "What's a belief you hold that you can't fully justify?" },
      { id: 'depth_takes_time', text: "What's something about you that takes time to see?" },
      { id: 'depth_working_on', text: "What's a quality you're still working on?" },
      { id: 'depth_formative', text: "What's the most formative thing that's happened to you?" },
    ],
  },
];

const ALL_PROMPTS_MAP = new Map<string, PromptOption>(
  PROMPT_CATEGORIES.flatMap((cat) => cat.prompts.map((p) => [p.id, p] as const))
);

export function getPromptById(id: string): PromptOption | undefined {
  return ALL_PROMPTS_MAP.get(id);
}

export const MAX_PROMPTS = 3;
