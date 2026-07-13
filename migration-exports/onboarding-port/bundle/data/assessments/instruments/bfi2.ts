const PREFIX = "I am someone who ";
export const BFI2_ITEMS: string[] = [
  PREFIX + "is talkative",
  PREFIX + "tends to find fault with others",
  PREFIX + "does a thorough job",
  PREFIX + "is depressed, blue",
  PREFIX + "is original, comes up with new ideas",
  PREFIX + "is reserved",
  PREFIX + "is helpful and unselfish with others",
  PREFIX + "can be somewhat careless",
  PREFIX + "is relaxed, handles stress well",
  PREFIX + "is curious about many different things",
  PREFIX + "is full of energy",
  PREFIX + "starts quarrels with others",
  PREFIX + "is a reliable worker",
  PREFIX + "can be tense",
  PREFIX + "is ingenious, a deep thinker",
  PREFIX + "generates a lot of enthusiasm",
  PREFIX + "has a forgiving nature",
  PREFIX + "tends to be disorganised",
  PREFIX + "worries a lot",
  PREFIX + "has an active imagination",
  PREFIX + "tends to be quiet",
  PREFIX + "is generally trusting",
  PREFIX + "tends to be lazy",
  PREFIX + "is emotionally stable, not easily upset",
  PREFIX + "is inventive",
  PREFIX + "has an assertive personality",
  PREFIX + "can be cold and aloof",
  PREFIX + "perseveres until the task is finished",
  PREFIX + "can be moody",
  PREFIX + "values artistic, aesthetic experiences",
  PREFIX + "is sometimes shy, inhibited",
  PREFIX + "is considerate and kind to almost everyone",
  PREFIX + "does things efficiently",
  PREFIX + "remains calm in tense situations",
  PREFIX + "prefers work that is routine",
  PREFIX + "is outgoing, sociable",
  PREFIX + "is sometimes rude to others",
  PREFIX + "makes plans and follows through with them",
  PREFIX + "gets nervous easily",
  PREFIX + "likes to reflect, play with ideas",
  PREFIX + "has few artistic interests",
  PREFIX + "likes to cooperate with others",
  PREFIX + "is easily distracted",
  PREFIX + "is sophisticated in art, music, or literature",
  PREFIX + "prefers not to draw attention to themselves",
  PREFIX + "assumes the best about people",
  PREFIX + "manages time well",
  PREFIX + "is emotionally resilient",
  PREFIX + "is complex, a deep thinker",
  PREFIX + "is enthusiastic and optimistic",
  PREFIX + "is sometimes irritable",
  PREFIX + "can be somewhat careless with details",
  PREFIX + "gets easily frustrated",
  PREFIX + "thinks deeply about things",
  PREFIX + "has a lot of physical energy",
  PREFIX + "makes friends easily",
  PREFIX + "tends to be disorganised",
  PREFIX + "remains calm when things go wrong",
  PREFIX + "rarely gets annoyed",
  PREFIX + "takes time to listen to others",
];

const rev5 = (raw: number) => 6 - raw;
const E = [1, 6, 11, 16, 21, 26, 31, 36, 45, 50, 55, 56];
const E_rev = new Set([6, 21, 31, 45]);
const A = [2, 7, 12, 17, 22, 27, 32, 37, 42, 46, 60];
const A_rev = new Set([2, 12, 27, 37]);
const C = [3, 8, 13, 18, 23, 28, 33, 38, 43, 47, 52, 57];
const C_rev = new Set([8, 18, 23, 43, 52, 57]);
const N = [4, 9, 14, 19, 24, 29, 34, 39, 48, 51, 53, 58, 59];
const N_rev = new Set([9, 24, 34, 48, 58, 59]);
const O = [5, 10, 15, 20, 25, 30, 35, 40, 41, 44, 49, 54];
const O_rev = new Set([35, 41]);

function mean(items: number[], revSet: Set<number>, responses: Record<string, number>) {
  if (!items.length) return 0;
  const sum = items.reduce((s, k) => {
    const raw = responses[String(k)] ?? 0;
    return s + (revSet.has(k) ? rev5(raw) : raw);
  }, 0);
  return sum / items.length;
}

export function scoreBFI2(responses: Record<string, number>) {
  return {
    extraversion: mean(E, E_rev, responses),
    agreeableness: mean(A, A_rev, responses),
    conscientiousness: mean(C, C_rev, responses),
    neuroticism: mean(N, N_rev, responses),
    openness: mean(O, O_rev, responses),
  };
}
