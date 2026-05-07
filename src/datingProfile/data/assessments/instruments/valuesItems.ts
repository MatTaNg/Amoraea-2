// Schwartz Values (TwIVI — Twenty Item Values Inventory)
// Sandy, Gosling, Schwartz & Koelkebeck (2016), J. Pers. Assess.
// Freely usable for any purpose per the authors (gosling.psy.utexas.edu)
// No reverse scoring. Score = mean of the two items per value.
// Use MRAT-centered scores for all between-person matching.

export type ValueDimension =
  | "conformity"
  | "tradition"
  | "benevolence"
  | "universalism"
  | "selfDirection"
  | "stimulation"
  | "hedonism"
  | "achievement"
  | "power"
  | "security";

export interface ValuesItem {
  /** 1-based, canonical Schwartz Values (TwIVI) ordering */
  id: number;
  text: string;
  value: ValueDimension;
}

export const TWIVI_ITEMS: ValuesItem[] = [
  {
    id: 1,
    value: "conformity",
    text: "It is important to always show respect to parents and older people. Being obedient matters.",
  },
  {
    id: 2,
    value: "tradition",
    text: "Religious belief is important. It is important to do what religion requires.",
  },
  {
    id: 3,
    value: "benevolence",
    text: "It is very important to help people nearby and care for their well-being.",
  },
  {
    id: 4,
    value: "universalism",
    text: "It is important that every person in the world be treated equally. Everyone should have equal opportunities in life.",
  },
  {
    id: 5,
    value: "selfDirection",
    text: "It is important to stay interested in things, be curious, and try to understand all sorts of things.",
  },
  {
    id: 6,
    value: "stimulation",
    text: "Taking risks and looking for adventures is important.",
  },
  {
    id: 7,
    value: "hedonism",
    text: "It is important to find chances to have fun and do things that bring pleasure.",
  },
  {
    id: 8,
    value: "achievement",
    text: "Getting ahead in life is important. Doing better than others matters.",
  },
  {
    id: 9,
    value: "power",
    text: "It is important to make decisions and be the leader.",
  },
  {
    id: 10,
    value: "security",
    text: "It is important for things to be organized and clean. Messy situations are uncomfortable.",
  },
  {
    id: 11,
    value: "conformity",
    text: "It is important to always behave properly and avoid doing things people would say are wrong.",
  },
  {
    id: 12,
    value: "tradition",
    text: "It is best to do things in traditional ways. Keeping up learned customs is important.",
  },
  {
    id: 13,
    value: "benevolence",
    text: "It is important to respond to the needs of others and support people who are known personally.",
  },
  {
    id: 14,
    value: "universalism",
    text: "All the world's people should live in harmony. Promoting peace among all groups is important.",
  },
  {
    id: 15,
    value: "selfDirection",
    text: "Thinking up new ideas and being creative is important. Doing things in an original way matters.",
  },
  {
    id: 16,
    value: "stimulation",
    text: "It is important to do many different things in life and keep looking for new things to try.",
  },
  {
    id: 17,
    value: "hedonism",
    text: "Enjoying life and having a good time is very important.",
  },
  {
    id: 18,
    value: "achievement",
    text: "Being very successful is important. Impressing other people matters.",
  },
  {
    id: 19,
    value: "power",
    text: "It is important to be in charge and direct others. People following instructions matters.",
  },
  {
    id: 20,
    value: "security",
    text: "Having a stable government is important. Protecting social order matters.",
  },
];

/** Same stem as legacy PVQ onboarding ("How much like you is this person? "). */
export const VALUES_QUESTION_PREFIX = "How much like you is this person? ";

/** Display strings shown in InstrumentScreen (prefix + Schwartz Values item text). */
export const TWIVI_DISPLAY_STRINGS = TWIVI_ITEMS.map((i) => VALUES_QUESTION_PREFIX + i.text);
