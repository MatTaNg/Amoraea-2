export const BRS_ITEMS: string[] = [
  "I tend to bounce back quickly after hard times.",
  "I have a hard time making it through stressful events.",
  "It does not take me long to recover from a stressful event.",
  "It is hard for me to snap back when something bad happens.",
  "I usually come through difficult times with little trouble.",
  "I tend to take a long time to get over set-backs in my life.",
];

const REVERSE = new Set([2, 4, 6]);
const rev5 = (raw: number) => 6 - raw;

export function scoreBRS(responses: Record<string, number>): { resilience: number } {
  const sum = [1, 2, 3, 4, 5, 6].reduce((s, k) => {
    const raw = responses[String(k)] ?? 0;
    return s + (REVERSE.has(k) ? rev5(raw) : raw);
  }, 0);
  return { resilience: sum / 6 };
}
