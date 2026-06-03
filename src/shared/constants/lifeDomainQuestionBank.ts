export type LifeDomainQuestionBankItem = {
  key: string;
  question: string;
  multiline?: boolean;
  numberOfLines?: number;
  type?: 'picker';
  pickerOptions?: Array<{ label: string; value: string }>;
  /** Required during onboarding (new users). Edit profile does not enforce. */
  required?: boolean;
  /** Required during onboarding when user wants children (see `wantKids` on profile). */
  requiredWhenWantKids?: boolean;
  /** Sensitive optional question — never blocks onboarding completion. */
  explicitlyOptional?: boolean;
};

/** Intimacy domain — desired frequency (dropdown). */
export const INTIMACY_SEX_FREQUENCY_PICKER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Select an option", value: "" },
  { label: "Rarely / less than once a week", value: "Rarely / less than once a week" },
  { label: "About once a week", value: "About once a week" },
  { label: "2–3 times per week", value: "2–3 times per week" },
  { label: "4–5 times per week", value: "4–5 times per week" },
  { label: "6–7 times per week", value: "6–7 times per week" },
  { label: "Daily or more", value: "Daily or more" },
  { label: "It varies — depends on the relationship", value: "It varies — depends on the relationship" },
  { label: "Prefer not to say", value: "Prefer not to say" },
];

// Relationships / Intimacy / Sex / Family questions
export const INTIMACY_QUESTIONS: LifeDomainQuestionBankItem[] = [
  {
    key: "idealLife",
    question: "Describe your ideal life with your partner 10 years in the future. What exactly are you doing together? What is daily life like? Where are you living?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "livingLocation",
    question: "Where do you see yourself living in the future?",
    required: true,
    type: "picker",
    pickerOptions: [
      { label: "City", value: "City" },
      { label: "Suburban", value: "Suburban" },
      { label: "Rural", value: "Rural" },
      { label: "Nomadic", value: "Nomadic" },
      { label: "Off Grid", value: "Off Grid" },
      { label: "Unsure", value: "Unsure" },
    ],
  },
  {
    key: "sexFrequency",
    question: "How many times a week do you desire to have sex?",
    required: true,
    type: "picker",
    pickerOptions: INTIMACY_SEX_FREQUENCY_PICKER_OPTIONS,
  },
  {
    key: "communication",
    question: 'What does "good communication" look like for you? How do you know when you\'re communicating poorly?',
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "relationshipSuccess",
    question: "What do you think makes a relationship succeed? Why do they fail?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "boundaries",
    question: "How do you respect and communicate boundaries effectively?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "couplesTherapy",
    question: "Do you think couples therapy is important? Why or why not?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "relationshipAgreements",
    question: "What kind of agreements would you like to have in a relationship?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "politics",
    question: "How do politics play a role in your life? Any views you'd like a partner to share with you?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "physicalAffectionOutsideSex",
    question: "What does physical affection mean to you outside of sex?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "emotionalIntimacy",
    question: "How do you define emotional intimacy? What creates it for you?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "masculinityMeaning",
    question: "What does Masculinity mean to you?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "femininityMeaning",
    question: "What does Femininity mean to you?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "mismatchedDesire",
    question: "How do you handle mismatched desire in a relationship?",
    multiline: true,
    numberOfLines: 4,
  },
];

/** Gross yearly income brackets (pre-tax); user picks a range. */
export const FINANCE_YEARLY_INCOME_PICKER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Select an option", value: "" },
  { label: "Under $25,000", value: "Under $25,000" },
  { label: "$25,000 – $49,999", value: "$25,000 – $49,999" },
  { label: "$50,000 – $74,999", value: "$50,000 – $74,999" },
  { label: "$75,000 – $99,999", value: "$75,000 – $99,999" },
  { label: "$100,000 – $149,999", value: "$100,000 – $149,999" },
  { label: "$150,000 – $249,999", value: "$150,000 – $249,999" },
  { label: "$250,000 – $499,999", value: "$250,000 – $499,999" },
  { label: "$500,000 or more", value: "$500,000 or more" },
];

export const RELATIONSHIP_FINANCES_PICKER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Select an option", value: "" },
  { label: "Pooled", value: "Pooled" },
  { label: "Separate", value: "Separate" },
  { label: "Hybrid", value: "Hybrid" },
];

export const DEBT_AMOUNT_PICKER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Select an option", value: "" },
  { label: "None", value: "None" },
  { label: "Under $10,000", value: "Under $10,000" },
  { label: "$10,000 – $49,999", value: "$10,000 – $49,999" },
  { label: "$50,000 – $99,999", value: "$50,000 – $99,999" },
  { label: "$100,000 – $249,999", value: "$100,000 – $249,999" },
  { label: "$250,000 or more", value: "$250,000 or more" },
];

export const DEBT_PAYOFF_PLAN_PICKER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Select an option", value: "" },
  {
    label: "Yes, I'm actively paying it down",
    value: "Yes, I'm actively paying it down",
  },
  {
    label: "Somewhat — I'm making payments but without a clear timeline",
    value: "Somewhat — I'm making payments but without a clear timeline",
  },
  { label: "Not currently", value: "Not currently" },
  { label: "Not applicable", value: "Not applicable" },
];

// Finance / Career / Business questions
export const FINANCE_QUESTIONS: LifeDomainQuestionBankItem[] = [
  {
    key: "yearlyIncome",
    question: "What is your yearly income?",
    required: true,
    type: "picker",
    pickerOptions: FINANCE_YEARLY_INCOME_PICKER_OPTIONS,
  },
  {
    key: "financesPooled",
    question: "Should finances in a relationship be pooled, separate, or a hybrid?",
    required: true,
    type: "picker",
    pickerOptions: RELATIONSHIP_FINANCES_PICKER_OPTIONS,
  },
  {
    key: "financialGoal",
    question: "What are your financial goals?",
  },
  {
    key: "debtAmount",
    question: "How much debt do you currently carry?",
    required: true,
    type: "picker",
    pickerOptions: DEBT_AMOUNT_PICKER_OPTIONS,
  },
  {
    key: "debtPayoffPlan",
    question: "Do you have an active plan to pay off your debt?",
    required: true,
    type: "picker",
    pickerOptions: DEBT_PAYOFF_PLAN_PICKER_OPTIONS,
  },
  {
    key: "spendingSaving",
    question: "What are your thoughts between spending vs saving or investing? How do you balance these?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "vocation",
    question: "What do you enjoy about your vocation currently? If you do not enjoy it, what would you like to do instead, if anything?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "moneyMeaning",
    question: "What does money mean to you?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "workLifeBalance",
    question: "What does work-life balance look like to you?",
    multiline: true,
    numberOfLines: 4,
  },
];

/** Spirituality — importance of raising children in one's faith (when user wants kids). */
export const SPIRITUALITY_RAISING_CHILDREN_IN_FAITH_PICKER_OPTIONS: Array<{
  label: string;
  value: string;
}> = [
  { label: "Select an option", value: "" },
  { label: "Not important", value: "Not important" },
  { label: "Somewhat important", value: "Somewhat important" },
  { label: "Important", value: "Important" },
  { label: "Very important", value: "Very important" },
  {
    label: "Essential — must raise children in my faith or tradition",
    value: "Essential — must raise children in my faith or tradition",
  },
];

export const SPIRITUALITY_WEEKLY_HOURS_PICKER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Select an option", value: "" },
  { label: "None / not currently", value: "None / not currently" },
  { label: "Less than 1 hour", value: "Less than 1 hour" },
  { label: "1–3 hours", value: "1–3 hours" },
  { label: "4–7 hours", value: "4–7 hours" },
  { label: "8–15 hours", value: "8–15 hours" },
  { label: "More than 15 hours", value: "More than 15 hours" },
  { label: "It varies a lot week to week", value: "It varies a lot week to week" },
  { label: "Prefer not to say", value: "Prefer not to say" },
];

// Spirituality / Religion questions
export const SPIRITUALITY_QUESTIONS: LifeDomainQuestionBankItem[] = [
  {
    key: "religion",
    question: "What is your relationship to spirituality or your religion?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "spiritualPractices",
    question: "What are your spiritual practices?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "godMeaning",
    question: "What does God mean to you?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "raisingChildrenInFaith",
    question: "How important is it to raise children in your faith or spiritual tradition?",
    requiredWhenWantKids: true,
    type: "picker",
    pickerOptions: SPIRITUALITY_RAISING_CHILDREN_IN_FAITH_PICKER_OPTIONS,
  },
  {
    key: "spiritualPracticeWeeklyHours",
    question: "How many hours a week do you spend doing spiritual or religious practice?",
    required: true,
    type: "picker",
    pickerOptions: SPIRITUALITY_WEEKLY_HOURS_PICKER_OPTIONS,
  },
];

/** Health domain — sleep schedule (dropdown). Legacy free-text answers remain under `sleepScheduleDescription`. */
export const HEALTH_SLEEP_SCHEDULE_PICKER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Select an option", value: "" },
  { label: "Early riser — I'm naturally up before 7am", value: "Early riser — I'm naturally up before 7am" },
  { label: "Morning person — typically up between 7–9am", value: "Morning person — typically up between 7–9am" },
  { label: "Flexible — my schedule varies a lot", value: "Flexible — my schedule varies a lot" },
  { label: "Night owl — I come alive in the evenings", value: "Night owl — I come alive in the evenings" },
  { label: "Late sleeper — I naturally stay up past midnight", value: "Late sleeper — I naturally stay up past midnight" },
  { label: "It depends on the week", value: "It depends on the week" },
];

export const HEALTH_CHRONIC_ILLNESS_PICKER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Select an option", value: "" },
  { label: "No", value: "No" },
  {
    label: "Yes — and I'm happy to share details in conversation",
    value: "Yes — and I'm happy to share details in conversation",
  },
  {
    label: "Yes — but I prefer to keep this private initially",
    value: "Yes — but I prefer to keep this private initially",
  },
  { label: "Prefer not to say", value: "Prefer not to say" },
];

/** Family domain — pets in the household (dropdown). */
export const FAMILY_PET_STATUS_PICKER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Select an option", value: "" },
  { label: "I have pets and they're a big part of my life", value: "I have pets and they're a big part of my life" },
  { label: "I have pets but I'm flexible about their role", value: "I have pets but I'm flexible about their role" },
  {
    label: "I don't have pets but I love them and would want them",
    value: "I don't have pets but I love them and would want them",
  },
  {
    label: "I don't have pets and prefer to keep it that way",
    value: "I don't have pets and prefer to keep it that way",
  },
  { label: "I'm allergic to common pets (cats, dogs)", value: "I'm allergic to common pets (cats, dogs)" },
  {
    label: "I have allergies but can manage with some pets",
    value: "I have allergies but can manage with some pets",
  },
  { label: "No strong preference either way", value: "No strong preference either way" },
];

/** Health / Fitness / Growth — diet type (dropdown). */
export const HEALTH_DIET_PICKER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Select an option", value: "" },
  {
    label: "No restrictions — I eat everything",
    value: "No restrictions — I eat everything",
  },
  {
    label: "Flexitarian (mostly plant-based but flexible)",
    value: "Flexitarian (mostly plant-based but flexible)",
  },
  { label: "Pescatarian", value: "Pescatarian" },
  { label: "Vegetarian", value: "Vegetarian" },
  { label: "Vegan", value: "Vegan" },
  { label: "Carnivore", value: "Carnivore" },
  { label: "Kosher", value: "Kosher" },
  { label: "Halal", value: "Halal" },
  { label: "Gluten-free", value: "Gluten-free" },
  { label: "Dairy-free", value: "Dairy-free" },
  { label: "Keto / low-carb", value: "Keto / low-carb" },
  { label: "Other", value: "Other" },
];

// Health / Fitness / Growth domain questions (PERSONAL_GROWTH_QUESTIONS; see PhysicalHealthModal)
export const PERSONAL_GROWTH_QUESTIONS: LifeDomainQuestionBankItem[] = [
  {
    key: "diet",
    question: "What is your diet?",
    type: "picker",
    pickerOptions: HEALTH_DIET_PICKER_OPTIONS,
  },
  {
    key: "activeHealthy",
    question: "How active and healthy are you?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "emotions",
    question: "How do you deal with your emotions?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "family",
    question: "What are some of your personal growth practices?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "alternativeMedicine",
    question: "What are your thoughts on alternative medicine? Vaccines?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "sleepSchedule",
    question: "How would you describe your sleep schedule?",
    required: true,
    type: "picker",
    pickerOptions: HEALTH_SLEEP_SCHEDULE_PICKER_OPTIONS,
  },
  {
    key: "relationshipWithAlcohol",
    question: "What is your relationship with drugs and alcohol?",
  },
  {
    key: "mentalHealthApproach",
    question: "How do you approach mental health?",
  },
  {
    key: "chronicIllnessStatus",
    question:
      "Do you have any chronic health conditions or disabilities that significantly affect your daily life or relationships?",
    explicitlyOptional: true,
    type: "picker",
    pickerOptions: HEALTH_CHRONIC_ILLNESS_PICKER_OPTIONS,
  },
];

/** Family domain — number of children (dropdown). */
export const FAMILY_KIDS_COUNT_PICKER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Select an option", value: "" },
  { label: "0 — I don't want children", value: "0 — I don't want children" },
  { label: "1", value: "1" },
  { label: "2", value: "2" },
  { label: "3", value: "3" },
  { label: "4 or more", value: "4 or more" },
  { label: "Not sure / open to discussion", value: "Not sure / open to discussion" },
];

/** Family domain — timing of children (dropdown). */
export const FAMILY_KIDS_TIMING_PICKER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Select an option", value: "" },
  { label: "As soon as possible / within 1 year", value: "As soon as possible / within 1 year" },
  { label: "In 1–3 years", value: "In 1–3 years" },
  { label: "In 3–5 years", value: "In 3–5 years" },
  { label: "In 5+ years", value: "In 5+ years" },
  { label: "No specific timeline", value: "No specific timeline" },
  { label: "Unsure", value: "Unsure" },
];

/** Family domain — adoption (dropdown). */
export const FAMILY_ADOPTION_PICKER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Select an option", value: "" },
  { label: "I do not want to adopt", value: "I do not want to adopt" },
  { label: "I am open to adopting", value: "I am open to adopting" },
  { label: "I only want to adopt", value: "I only want to adopt" },
];

export const FAMILY_CHILD_EDUCATION_PICKER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "Select an option", value: "" },
  {
    label: "Traditional schooling — public or private",
    value: "Traditional schooling — public or private",
  },
  {
    label: "Religious or faith-based schooling",
    value: "Religious or faith-based schooling",
  },
  { label: "Homeschooling", value: "Homeschooling" },
  {
    label: "Alternative schooling — Montessori, Waldorf, etc.",
    value: "Alternative schooling — Montessori, Waldorf, etc.",
  },
  {
    label: "No strong preference / open to discussion",
    value: "No strong preference / open to discussion",
  },
];

// Family domain questions (profile Family bar + Edit Profile → Family)
export const PHYSICAL_HEALTH_QUESTIONS: LifeDomainQuestionBankItem[] = [
  {
    key: "kidsNumber",
    question: "How many kids do you want?",
    type: "picker",
    pickerOptions: FAMILY_KIDS_COUNT_PICKER_OPTIONS,
  },
  {
    key: "kidsWhen",
    question: "When do you want kids?",
    type: "picker",
    pickerOptions: FAMILY_KIDS_TIMING_PICKER_OPTIONS,
  },
  {
    key: "adoptionPreferences",
    question: "Adoption preferences",
    type: "picker",
    pickerOptions: FAMILY_ADOPTION_PICKER_OPTIONS,
  },
  {
    key: "parentingRoles",
    question: "How do you see parenting roles and responsibilities?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "childrenEducation",
    question: "What are your thoughts on how children should be educated?",
    type: "picker",
    pickerOptions: FAMILY_CHILD_EDUCATION_PICKER_OPTIONS,
  },
  {
    key: "petStatus",
    question: "What's your relationship with pets?",
    required: true,
    type: "picker",
    pickerOptions: FAMILY_PET_STATUS_PICKER_OPTIONS,
  },
  {
    key: "cleanliness",
    question: "How important are cleanliness, organization and household roles to you?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "familyApproval",
    question: "How would you describe your relationship with your family of origin?",
    multiline: true,
    numberOfLines: 4,
  },
  {
    key: "partnerFamily",
    question: "How important is it that your partner have a close relationship with your family",
    multiline: true,
    numberOfLines: 4,
  },
];

