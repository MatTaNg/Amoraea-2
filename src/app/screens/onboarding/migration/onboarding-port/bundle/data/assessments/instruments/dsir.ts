export const DSIR_ITEMS: string[] = [
  "People have remarked that I'm too emotional.",
  "I have a clear sense of my own beliefs and values.",
  "I feel calm and centered most of the time.",
  "I often feel a strong need to please others.",
  "I find it difficult to say what I think when others disagree.",
  "I tend to feel responsible for other people's happiness.",
  "I can be myself and still feel close to others.",
  "Strong emotions make it difficult for me to think clearly.",
  "I feel confident about who I am and what I want.",
  "I need a lot of reassurance from others.",
  "I feel overwhelmed by other people's problems.",
  "I can express my feelings without losing control.",
  "I often act without thinking when I'm upset.",
  "I feel good about myself even if others don't approve of me.",
  "I tend to isolate myself when things get difficult.",
  "I have trouble knowing what I really feel.",
  "I find it difficult to stay in contact with family members.",
  "I can be close to others without losing my identity.",
  "I rely on others to make me feel okay about myself.",
  "My moods are not strongly influenced by what others say or do.",
  "I have a strong need for the approval of others.",
  "I can think clearly when I'm upset or anxious.",
  "I tend to go along with what others want.",
  "I feel responsible for keeping relationships working smoothly.",
  "I can disagree with others without losing my sense of self.",
  "I avoid conflict at all costs.",
  "I have trouble making decisions without input from others.",
  "I lose track of my feelings when talking with others.",
  "I find it difficult to stay emotionally connected to family.",
  "I know what I feel even when others try to tell me differently.",
  "I get overwhelmed when others are upset with me.",
  "I am able to take a stand even when others disagree.",
  "I feel lost without someone to guide me.",
  "I can handle it when people are upset with me.",
  "My emotions take over when I'm in an argument.",
  "I can hold onto my values under pressure.",
  "I feel guilty when I put my needs first.",
  "I shut down emotionally when things get too intense.",
  "I can tolerate disagreement without needing to resolve it immediately.",
  "I often feel trapped by obligations to others.",
  "I can be honest about my opinions even if others object.",
  "I find it difficult to maintain contact with people I've been close to.",
  "I feel at ease with myself most of the time.",
  "I tend to react emotionally before thinking things through.",
  "I can acknowledge my mistakes without excessive guilt.",
  "I need harmony in my relationships to feel okay.",
];

const rev6 = (raw: number) => 7 - raw;
const REVERSE = new Set([2, 3, 7, 9, 12, 14, 18, 20, 22, 25, 30, 32, 34, 36, 39, 41, 43, 45]);
const ER = [1, 8, 13, 16, 22, 28, 31, 35, 44];
const IP = [2, 5, 9, 14, 23, 25, 27, 30, 32, 36, 41];
const EC = [15, 17, 26, 29, 38, 42];
const FO = [4, 6, 10, 11, 19, 21, 24, 33, 37, 40, 46];

function mean(items: number[], responses: Record<string, number>) {
  if (!items.length) return 0;
  const sum = items.reduce((s, k) => {
    const raw = responses[String(k)] ?? 0;
    return s + (REVERSE.has(k) ? rev6(raw) : raw);
  }, 0);
  return sum / items.length;
}

export function scoreDSIR(responses: Record<string, number>) {
  const all = Array.from({ length: 46 }, (_, i) => i + 1);
  const overall = mean(all, responses);
  return {
    overall,
    emotional_reactivity: mean(ER, responses),
    i_position: mean(IP, responses),
    emotional_cutoff: mean(EC, responses),
    fusion_with_others: mean(FO, responses),
  };
}
