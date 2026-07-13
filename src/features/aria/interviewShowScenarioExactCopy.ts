/**
 * Authoritative Show Scenario + TTS copy for Situations 1–3.
 * Do not paraphrase, summarize, or reword — must match product script exactly.
 */

/** Situation 1 vignette (Show Scenario modal body + spoken TTS). */
export const SHOW_SCENARIO_1_VIGNETTE_EXACT =
  `Emma and Ryan have dinner plans. Ryan takes a call from his mother halfway through. It runs 25 minutes. Emma pays the bill but seems flustered. Later Ryan asks what's wrong. Emma says "I just think you always put your family first before us." Ryan says "I can't just ignore my mother." Emma says "I know, you've made that very clear."` as const;

/** Situation 1 opening question (Show Scenario footer / spoken after vignette). */
export const SHOW_SCENARIO_1_OPENING_EXACT = "What's going on between these two?" as const;

export const SHOW_SCENARIO_1_FULL_EXACT =
  `${SHOW_SCENARIO_1_VIGNETTE_EXACT}\n\n${SHOW_SCENARIO_1_OPENING_EXACT}` as const;

/** Situation 2 vignette (Show Scenario modal body). */
export const SHOW_SCENARIO_2_VIGNETTE_EXACT =
  `Sarah has been job hunting for four months. She gets an offer and calls James from the street, too excited to wait. James is on a deadline, says 'that's amazing, let's celebrate tonight.' That evening James leads with questions about the salary, the start date, and the commute. At one point Sarah tears up. James says 'hey don't cry, this is a good thing'. The next day Sarah tells James she never feels appreciated. James is blindsided, he showed up, he celebrated, he asked questions. A fight starts.` as const;

/** Situation 2 opening question (Show Scenario footer / spoken after vignette). */
export const SHOW_SCENARIO_2_OPENING_EXACT = 'What do you think is going on here?' as const;

/** Situation 3 vignette (Show Scenario modal body). */
export const SHOW_SCENARIO_3_VIGNETTE_EXACT =
  `Sophie and Daniel have had the same argument for the third time. Sophie feels unheard because Daniel goes silent or leaves, so the issue is never resolved. This time Sophie says "we need to finish this." Daniel tries to avoid the conversation again. Sophie says "you can't just keep avoiding this." Daniel's voice goes flat. He says "I need ten minutes" and leaves. Sophie calls after him: "that's exactly what I mean."
Thirty minutes later Daniel comes back and says "okay, I'm ready. I should have come back sooner the other times. I didn't know what to say." Sophie is still upset.` as const;

/** Situation 3 opening question (Show Scenario footer / spoken after vignette). */
export const SHOW_SCENARIO_3_OPENING_EXACT =
  "When Daniel comes back and says 'I didn't know what to say' — what do you make of that?" as const;

export const SHOW_SCENARIO_2_FULL_EXACT = `${SHOW_SCENARIO_2_VIGNETTE_EXACT}\n\n${SHOW_SCENARIO_2_OPENING_EXACT}` as const;

/** True when the assistant text includes the authoritative Situation 2 job-offer vignette. */
export function isCanonicalScenario2VignettePresent(text: string): boolean {
  const t = (text ?? '').trim();
  if (!t) return false;
  return (
    t.includes(SHOW_SCENARIO_2_VIGNETTE_EXACT) ||
    /sarah has been job hunting for four months/i.test(t)
  );
}

export const SHOW_SCENARIO_3_FULL_EXACT = `${SHOW_SCENARIO_3_VIGNETTE_EXACT}\n\n${SHOW_SCENARIO_3_OPENING_EXACT}` as const;
