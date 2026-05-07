export interface ECRItem {
  /** 1-based, canonical ECR-R ordering */
  id: number;
  text: string;
  subscale: "anxiety" | "avoidance";
  /** true = apply 8 − raw before averaging */
  reversed: boolean;
}

export const ECR_R_ITEMS: ECRItem[] = [
  // --- Anxiety subscale (items 1–18) ---
  { id: 1, subscale: "anxiety", reversed: false, text: "I'm afraid that I will lose my partner's love." },
  {
    id: 2,
    subscale: "anxiety",
    reversed: false,
    text: "I often worry that my partner will not want to stay with me.",
  },
  { id: 3, subscale: "anxiety", reversed: false, text: "I often worry that my partner doesn't really love me." },
  {
    id: 4,
    subscale: "anxiety",
    reversed: false,
    text: "I worry that romantic partners won't care about me as much as I care about them.",
  },
  {
    id: 5,
    subscale: "anxiety",
    reversed: false,
    text: "I often wish that my partner's feelings for me were as strong as my feelings for him or her.",
  },
  { id: 6, subscale: "anxiety", reversed: false, text: "I worry a lot about my relationships." },
  {
    id: 7,
    subscale: "anxiety",
    reversed: false,
    text: "When my partner is out of sight, I worry that he or she might become interested in someone else.",
  },
  {
    id: 8,
    subscale: "anxiety",
    reversed: false,
    text: "When I show my feelings for romantic partners, I'm afraid they will not feel the same about me.",
  },
  { id: 9, subscale: "anxiety", reversed: true, text: "I rarely worry about my partner leaving me." },
  { id: 10, subscale: "anxiety", reversed: false, text: "My romantic partner makes me doubt myself." },
  { id: 11, subscale: "anxiety", reversed: true, text: "I do not often worry about being abandoned." },
  {
    id: 12,
    subscale: "anxiety",
    reversed: false,
    text: "I find that my partner(s) don't want to get as close as I would like.",
  },
  {
    id: 13,
    subscale: "anxiety",
    reversed: false,
    text: "Sometimes romantic partners change their feelings about me for no apparent reason.",
  },
  {
    id: 14,
    subscale: "anxiety",
    reversed: false,
    text: "My desire to be very close sometimes scares people away.",
  },
  {
    id: 15,
    subscale: "anxiety",
    reversed: false,
    text: "I'm afraid that once a romantic partner gets to know me, he or she won't like who I really am.",
  },
  {
    id: 16,
    subscale: "anxiety",
    reversed: false,
    text: "It makes me mad that I don't get the affection and support I need from my partner.",
  },
  { id: 17, subscale: "anxiety", reversed: false, text: "I worry that I won't measure up to other people." },
  { id: 18, subscale: "anxiety", reversed: false, text: "My partner only seems to notice me when I'm angry." },

  // --- Avoidance subscale (items 19–36) ---
  { id: 19, subscale: "avoidance", reversed: false, text: "I prefer not to show a partner how I feel deep down." },
  {
    id: 20,
    subscale: "avoidance",
    reversed: true,
    text: "I feel comfortable sharing my private thoughts and feelings with my partner.",
  },
  {
    id: 21,
    subscale: "avoidance",
    reversed: false,
    text: "I find it difficult to allow myself to depend on romantic partners.",
  },
  {
    id: 22,
    subscale: "avoidance",
    reversed: true,
    text: "I am very comfortable being close to romantic partners.",
  },
  {
    id: 23,
    subscale: "avoidance",
    reversed: false,
    text: "I don't feel comfortable opening up to romantic partners.",
  },
  {
    id: 24,
    subscale: "avoidance",
    reversed: false,
    text: "I prefer not to be too close to romantic partners.",
  },
  {
    id: 25,
    subscale: "avoidance",
    reversed: false,
    text: "I get uncomfortable when a romantic partner wants to be very close.",
  },
  {
    id: 26,
    subscale: "avoidance",
    reversed: true,
    text: "I find it relatively easy to get close to my partner.",
  },
  {
    id: 27,
    subscale: "avoidance",
    reversed: true,
    text: "It's not difficult for me to get close to my partner.",
  },
  {
    id: 28,
    subscale: "avoidance",
    reversed: true,
    text: "I usually discuss my problems and concerns with my partner.",
  },
  {
    id: 29,
    subscale: "avoidance",
    reversed: true,
    text: "It helps to turn to my romantic partner in times of need.",
  },
  { id: 30, subscale: "avoidance", reversed: true, text: "I tell my partner just about everything." },
  { id: 31, subscale: "avoidance", reversed: true, text: "I talk things over with my partner." },
  {
    id: 32,
    subscale: "avoidance",
    reversed: false,
    text: "I am nervous when partners get too close to me.",
  },
  {
    id: 33,
    subscale: "avoidance",
    reversed: true,
    text: "I feel comfortable depending on romantic partners.",
  },
  {
    id: 34,
    subscale: "avoidance",
    reversed: true,
    text: "I find it easy to depend on romantic partners.",
  },
  {
    id: 35,
    subscale: "avoidance",
    reversed: true,
    text: "It's easy for me to be affectionate with my partner.",
  },
  {
    id: 36,
    subscale: "avoidance",
    reversed: true,
    text: "My partner really understands me and my needs.",
  },
];

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Randomised presentation order (Fraley recommends varying order to reduce order effects).
 * Seeded from `sessionSeed` so the same user/session gets the same order after refresh/resume.
 */
export function getShuffledItems(sessionSeed: number): ECRItem[] {
  const arr = [...ECR_R_ITEMS];
  const rnd = mulberry32(sessionSeed + 424242);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const t = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = t;
  }
  return arr;
}
