/** Normalize assistant punctuation for scenario anchor regex (matches AriaScreen). */
export function normalizeContentForScenarioDetection(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035\u0060]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"');
}

const SCENARIO_1_PATTERN =
  /emma and ryan|ryan takes a call|first situation|here's the first|\bsituation\s*1\b|the first situation/;

const SCENARIO_3_PATTERN =
  /sophie and daniel|daniel.*didn't know what to say|daniel.*didn't know how|here's the third situation|third situation|last one.*situation three|situation three|\bsituation\s*3\b|the third situation|shift to something more personal|something more personal/;

const SCENARIO_2_PATTERN =
  /sarah has been job hunting|second situation|on to the second|here's the next situation|\bsituation\s*2\b|the second situation|next situation/;

function matchesScenario3SophieDaniel(c: string): boolean {
  return (
    /\bsophie\b/.test(c) &&
    /\bdaniel\b/.test(c) &&
    /ten minutes|avoiding|didn'?t know what to say|silent/.test(c)
  );
}

function matchesScenario2SarahJames(c: string): boolean {
  return (
    /\bsarah\b/.test(c) &&
    /\bjames\b/.test(c) &&
    /job|hunting|offer|\bcelebrate\b|appreciated|blindsided|deadline/.test(c)
  );
}

/** Detect which scenario an AI response introduces from content. */
export function detectScenarioFromResponse(responseText: string): 1 | 2 | 3 | null {
  if (!responseText?.trim()) return null;
  const c = normalizeContentForScenarioDetection(responseText).toLowerCase();
  if (SCENARIO_1_PATTERN.test(c)) return 1;
  // Scenario 3 before scenario 2 — S2→S3 wrap-ups often recap Sarah/James from scenario B.
  if (SCENARIO_3_PATTERN.test(c) || matchesScenario3SophieDaniel(c)) return 3;
  if (SCENARIO_2_PATTERN.test(c) || matchesScenario2SarahJames(c)) return 2;
  return null;
}

type ScenarioTaggedMessage = { role: string; scenarioNumber?: number };

export function getScenarioNumberForNewMessage(
  prevMessages: ScenarioTaggedMessage[],
  role: 'user' | 'assistant',
  newContent?: string
): number {
  const last = [...prevMessages].reverse().find((m) => m.role === 'user' || m.role === 'assistant');
  const lastTagged = [...prevMessages]
    .reverse()
    .find(
      (m) =>
        (m.role === 'user' || m.role === 'assistant') &&
        typeof m.scenarioNumber === 'number' &&
        m.scenarioNumber >= 1 &&
        m.scenarioNumber <= 3,
    );
  const lastNum = last?.scenarioNumber ?? lastTagged?.scenarioNumber;
  if (role === 'user') return lastNum ?? 1;
  if (!newContent) return lastNum ?? 1;
  const detected = detectScenarioFromResponse(newContent);
  if (detected != null) return detected;
  return lastNum ?? 1;
}
