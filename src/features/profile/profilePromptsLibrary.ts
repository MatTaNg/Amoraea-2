/**
 * Profile prompt library (~120 prompts, 9 categories).
 * UX only — not used by the matching algorithm.
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

export const MAX_PROFILE_PROMPTS = 3;
export const PROFILE_PROMPT_ANSWER_MAX_LENGTH = 150;

/** At least one answered prompt must come from one of these categories. */
export const REQUIRED_PROFILE_PROMPT_CATEGORY_IDS = [
  'what_matters_to_me',
  'how_i_show_up',
] as const;

export type RequiredProfilePromptCategoryId =
  (typeof REQUIRED_PROFILE_PROMPT_CATEGORY_IDS)[number];

function cat(id: string, title: string, prompts: PromptOption[]): PromptCategory {
  return { id, title, prompts };
}

export const PROFILE_PROMPT_CATEGORIES: PromptCategory[] = [
  cat('what_matters_to_me', 'What Matters To Me', [
    { id: 'wmtm_partnership', text: 'What matters most to you in a partnership?' },
    { id: 'wmtm_non_negotiable', text: 'What is non-negotiable for you in love?' },
    { id: 'wmtm_supported', text: 'What does feeling supported by a partner look like for you?' },
    { id: 'wmtm_security', text: 'What helps you feel emotionally secure with someone?' },
    { id: 'wmtm_conflict', text: 'When conflict happens, what do you need to stay connected?' },
    { id: 'wmtm_trust', text: 'What builds trust for you over time?' },
    { id: 'wmtm_growth', text: 'How important is personal growth in a relationship to you?' },
    { id: 'wmtm_values_daily', text: 'Which values do you want to live out daily with a partner?' },
    { id: 'wmtm_commitment', text: 'What does commitment mean to you, practically?' },
    { id: 'wmtm_reciprocity', text: 'What does reciprocity look like when you feel truly seen?' },
    { id: 'wmtm_boundaries', text: 'What boundary matters most to you in dating?' },
    { id: 'wmtm_love_language', text: 'How do you most feel loved — and how do you show it?' },
    { id: 'wmtm_future', text: 'What do you want your relationship to make room for in your life?' },
  ]),
  cat('how_i_show_up', 'How I Show Up', [
    { id: 'his_stress', text: "When you're stressed, what do you actually need from the people around you?" },
    { id: 'his_apology', text: 'What does a good apology look like to you?' },
    { id: 'his_repair', text: 'After a disagreement, what helps you reconnect?' },
    { id: 'his_feedback', text: 'How do you prefer to receive honest feedback?' },
    { id: 'his_vulnerability', text: 'What makes it hard for you to be vulnerable?' },
    { id: 'his_accountability', text: 'How do you take accountability when you get something wrong?' },
    { id: 'his_space', text: 'How much alone time do you need to show up well in a relationship?' },
    { id: 'his_communication', text: 'How direct are you when something is bothering you?' },
    { id: 'his_affection', text: 'How do you express affection when words are hard?' },
    { id: 'his_triggers', text: 'What tends to shut you down in a conversation?' },
    { id: 'his_needs', text: "What's something you need from a partner that's easy to miss?" },
    { id: 'his_patterns', text: 'What pattern are you actively trying to change in relationships?' },
    { id: 'his_best_self', text: 'What brings out the best version of you in a relationship?' },
  ]),
  cat('values_priorities', 'Values & priorities', [
    { id: 'values_good_day', text: 'What does a good day look like for you?' },
    { id: 'values_better_at', text: 'What are you better at than most people?' },
    { id: 'values_dont_understand', text: "What's something most people do that you don't understand?" },
    { id: 'values_money_no_factor', text: "What would you do with your time if money wasn't a factor?" },
    { id: 'values_changed_mind', text: "What's the last thing you changed your mind about?" },
    { id: 'values_tradeoff', text: 'What tradeoff have you made that you are proud of?' },
    { id: 'values_stand_for', text: 'What do you stand for even when it is inconvenient?' },
    { id: 'values_time', text: 'Where does most of your time actually go?' },
    { id: 'values_legacy', text: 'What kind of impact do you want your life to have?' },
    { id: 'values_simplicity', text: 'What would you simplify if you could?' },
    { id: 'values_risk', text: 'What is worth taking a risk for?' },
    { id: 'values_peace', text: 'What does a peaceful life mean to you?' },
    { id: 'values_learning', text: 'What are you learning about yourself right now?' },
  ]),
  cat('lifestyle_energy', 'Lifestyle & energy', [
    { id: 'lifestyle_ideal_weekend', text: "What does your ideal weekend look like?" },
    { id: 'lifestyle_phone', text: "What's your relationship with your phone like?" },
    { id: 'lifestyle_problems', text: 'Are you someone people come to with their problems?' },
    { id: 'lifestyle_after_social', text: 'How do you feel after a big social event?' },
    { id: 'lifestyle_need_more', text: "What do you need more of in your life right now?" },
    { id: 'lifestyle_morning', text: 'Are you a morning person or a night owl — honestly?' },
    { id: 'lifestyle_home', text: 'What does your home need to feel like a refuge?' },
    { id: 'lifestyle_routine', text: 'What routine keeps you grounded?' },
    { id: 'lifestyle_travel', text: 'How often do you want travel to be part of your life?' },
    { id: 'lifestyle_social_battery', text: 'How do you recharge your social battery?' },
    { id: 'lifestyle_work_life', text: 'What does work-life balance look like for you today?' },
    { id: 'lifestyle_health', text: 'What habit most affects your energy?' },
    { id: 'lifestyle_slow_down', text: 'What helps you slow down when life gets loud?' },
  ]),
  cat('humor_personality', 'Humor & personality', [
    { id: 'humor_hill', text: "What's a hill you'll die on?" },
    { id: 'humor_irrational', text: "What's your most irrational opinion?" },
    { id: 'humor_snob', text: 'What are you a snob about?' },
    { id: 'humor_embarrassed', text: "What do you do that you'd be embarrassed to explain to a stranger?" },
    { id: 'humor_differently', text: "What's something you do differently from everyone you know?" },
    { id: 'humor_laugh', text: 'What always makes you laugh?' },
    { id: 'humor_weird', text: 'What is a harmless weird thing about you?' },
    { id: 'humor_debate', text: 'What topic could you talk about for hours?' },
    { id: 'humor_nerd', text: 'What are you low-key nerdy about?' },
    { id: 'humor_chaos', text: 'What kind of chaos do you bring to a friend group?' },
    { id: 'humor_compliment', text: 'What is the best compliment you have received?' },
    { id: 'humor_spontaneous', text: 'What is the most spontaneous thing you have done lately?' },
    { id: 'humor_quirk', text: 'What small quirk should a partner know upfront?' },
  ]),
  cat('relational_style', 'Relational style', [
    { id: 'relational_show_care', text: 'How do you show someone you care about them?' },
    { id: 'relational_loyalty', text: 'What does loyalty mean to you?' },
    { id: 'relational_learned', text: "What's the most important thing you learned from your last relationship?" },
    { id: 'relational_hard_to_ask', text: "What do you need from a partner that you'd find hard to ask for?" },
    { id: 'relational_stressed', text: "When you're stressed, what do you actually need from the people around you?" },
    { id: 'relational_pace', text: 'What pace of dating feels natural to you?' },
    { id: 'relational_quality_time', text: 'What counts as quality time for you?' },
    { id: 'relational_independence', text: 'How much independence do you need in a relationship?' },
    { id: 'relational_jealousy', text: 'How do you handle jealousy or insecurity?' },
    { id: 'relational_friendships', text: 'What role should friendships play when you are partnered?' },
    { id: 'relational_family', text: 'What role does family play in your relationship life?' },
    { id: 'relational_future_talk', text: 'When do you like to talk about the future with someone new?' },
    { id: 'relational_green_flag', text: 'What is a green flag you wish more people noticed?' },
  ]),
  cat('ambition_growth', 'Ambition & growth', [
    { id: 'ambition_becoming', text: 'What are you working on becoming?' },
    { id: 'ambition_proud', text: "What's something you're proud of that wouldn't fit on a resume?" },
    { id: 'ambition_skill', text: "What's a skill you've put real time into?" },
    { id: 'ambition_ten_years', text: "What do you want your life to look like in ten years — specifically?" },
    { id: 'ambition_current_focus', text: 'What are you building or improving right now?' },
    { id: 'ambition_mentor', text: 'Who has influenced how you think about success?' },
    { id: 'ambition_failure', text: 'What failure taught you the most?' },
    { id: 'ambition_risk', text: 'What calculated risk are you glad you took?' },
    { id: 'ambition_discipline', text: 'Where does discipline show up in your life?' },
    { id: 'ambition_creativity', text: 'Where does creativity show up in your life?' },
    { id: 'ambition_balance', text: 'How do you balance ambition with rest?' },
    { id: 'ambition_support', text: 'What kind of support helps you pursue your goals?' },
    { id: 'ambition_next', text: 'What is the next chapter you are trying to open?' },
  ]),
  cat('depth_awareness', 'Depth & self-awareness', [
    { id: 'depth_belief', text: "What's a belief you hold that you can't fully justify?" },
    { id: 'depth_takes_time', text: "What's something about you that takes time to see?" },
    { id: 'depth_working_on', text: "What's a quality you're still working on?" },
    { id: 'depth_formative', text: "What's the most formative thing that's happened to you?" },
    { id: 'depth_shadow', text: 'What part of yourself are you still learning to accept?' },
    { id: 'depth_fear', text: 'What fear shows up most in dating for you?' },
    { id: 'depth_pattern', text: 'What pattern do you notice across your relationships?' },
    { id: 'depth_healing', text: 'What are you healing from or growing through?' },
    { id: 'depth_gratitude', text: 'What are you grateful for that shaped who you are?' },
    { id: 'depth_therapy', text: 'What has therapy, coaching, or self-work taught you?' },
    { id: 'depth_contradiction', text: 'What contradiction do you live with comfortably?' },
    { id: 'depth_surprise', text: 'What do people often get wrong about you at first?' },
    { id: 'depth_meaning', text: 'What gives your life meaning on ordinary days?' },
  ]),
  cat('fun_chemistry', 'Fun & chemistry', [
    { id: 'fun_date', text: 'What is your idea of a great first date?' },
    { id: 'fun_flirt', text: 'How do you flirt when you are into someone?' },
    { id: 'fun_spontaneity', text: 'What is a spontaneous plan you would say yes to?' },
    { id: 'fun_music', text: 'What song would you put on a road trip playlist?' },
    { id: 'fun_food', text: 'What meal could you eat every week and not get tired of?' },
    { id: 'fun_adventure', text: 'What is an adventure still on your list?' },
    { id: 'fun_comfort', text: 'What is your comfort-show or comfort-movie?' },
    { id: 'fun_party', text: 'Are you the host, the guest, or the person who leaves early?' },
    { id: 'fun_icebreaker', text: 'What is a fun fact that surprises people?' },
    { id: 'fun_holiday', text: 'What holiday or ritual do you actually love?' },
    { id: 'fun_gift', text: 'What is the best gift you have given or received?' },
    { id: 'fun_competitive', text: 'What are you quietly competitive about?' },
    { id: 'fun_chemistry', text: 'What makes you feel instant chemistry with someone?' },
  ]),
];

const PROMPT_BY_ID = new Map<string, PromptOption>();
const CATEGORY_ID_BY_PROMPT_ID = new Map<string, string>();

for (const category of PROFILE_PROMPT_CATEGORIES) {
  for (const prompt of category.prompts) {
    PROMPT_BY_ID.set(prompt.id, prompt);
    CATEGORY_ID_BY_PROMPT_ID.set(prompt.id, category.id);
  }
}

export function getPromptById(id: string): PromptOption | undefined {
  return PROMPT_BY_ID.get(id);
}

export function getPromptCategoryId(promptId: string): string | undefined {
  return CATEGORY_ID_BY_PROMPT_ID.get(promptId);
}

export function getPromptCategoryById(id: string): PromptCategory | undefined {
  return PROFILE_PROMPT_CATEGORIES.find((c) => c.id === id);
}

export function isRequiredEligibleCategory(categoryId: string): boolean {
  return (REQUIRED_PROFILE_PROMPT_CATEGORY_IDS as readonly string[]).includes(categoryId);
}

/** @deprecated Use PROFILE_PROMPT_CATEGORIES */
export const PROMPT_CATEGORIES = PROFILE_PROMPT_CATEGORIES;

/** @deprecated Use MAX_PROFILE_PROMPTS */
export const MAX_PROMPTS = MAX_PROFILE_PROMPTS;
