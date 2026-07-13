import { describe, expect, it } from '@jest/globals';

import { SCENARIO_3_OPENING } from '@features/aria/interviewScenarioOpeningStreamGate';
import { SCENARIO_3_TEXT } from '@features/aria/interviewScenarioVignetteCopy';
import { SCENARIO_B_JAMES_REPAIR_CANONICAL } from '@features/aria/scenarioBProbeLogic';
import {
  SCENARIO_C_REPAIR_QUESTION_CANONICAL,
} from '@features/aria/scenarioCPromptDetection';
import {
  resolveSituation3ExactModalPrompt,
} from '@features/aria/situation3ExactModalPrompt';
import { resolveScenarioModalPromptInScope } from '@features/aria/interviewScenarioModalPrompt';
import { detectActiveScenarioFromMessage } from '@features/aria/interviewScenarioOpeningStreamGate';

describe('situation3ExactModalPrompt', () => {
  it('uses Scenario 3 opening when entering Sophie/Daniel after Scenario 2 repair', () => {
    const transcript = [
      { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL },
      { role: 'user', content: "I'd let her define what support looks like." },
      {
        role: 'assistant',
        content: SCENARIO_3_TEXT,
      },
    ];
    expect(
      resolveSituation3ExactModalPrompt(transcript, SCENARIO_3_TEXT, {
        sophiePerspectiveAsked: false,
        danielRepairAsked: false,
      }),
    ).toBe(SCENARIO_3_OPENING);
  });

  it('resolveScenarioModalPromptInScope ignores prior James repair when Situation 3 is active', () => {
    const transcript = [
      { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL },
      { role: 'user', content: "I'd let her define what support looks like." },
      { role: 'assistant', content: SCENARIO_3_TEXT },
    ];
    expect(
      resolveScenarioModalPromptInScope(transcript, {
        scenarioLabel: 'Situation 3',
        detectScenarioFromContent: detectActiveScenarioFromMessage,
        openingQuestionForLabel: (label) =>
          label === 'Situation 3' ? SCENARIO_3_OPENING : null,
      }),
    ).toBe(SCENARIO_3_OPENING);
  });

  it('shows canonical Scenario C Q2 repair when that is what was spoken', () => {
    const repairQ2 = 'Got it. How do you think this situation can be repaired?';
    expect(resolveSituation3ExactModalPrompt([], repairQ2)).toBe(
      SCENARIO_C_REPAIR_QUESTION_CANONICAL,
    );
    const transcript = [
      { role: 'assistant', content: SCENARIO_3_TEXT },
      { role: 'user', content: 'Daniel was overwhelmed.' },
      { role: 'assistant', content: repairQ2 },
    ];
    expect(resolveSituation3ExactModalPrompt(transcript)).toBe(SCENARIO_C_REPAIR_QUESTION_CANONICAL);
  });

  it('ignores Scenario 2 James repair bleed in currentSpoken and resolves from Situation 3 transcript', () => {
    const repairQ2 = 'Got it. How do you think this situation can be repaired?';
    const transcript = [
      { role: 'assistant', content: SCENARIO_B_JAMES_REPAIR_CANONICAL },
      { role: 'assistant', content: SCENARIO_3_TEXT },
      { role: 'user', content: 'Daniel shut down.' },
      { role: 'assistant', content: repairQ2 },
    ];
    expect(resolveSituation3ExactModalPrompt(transcript, SCENARIO_B_JAMES_REPAIR_CANONICAL)).toBe(
      SCENARIO_C_REPAIR_QUESTION_CANONICAL,
    );
  });

  it('shows canonical repair Q2 for repair-as-Daniel paraphrases', () => {
    const danielRepair = 'How would you repair if you were Daniel?';
    expect(resolveSituation3ExactModalPrompt([], danielRepair)).toBe(
      SCENARIO_C_REPAIR_QUESTION_CANONICAL,
    );
  });
});

describe('detectActiveScenarioFromMessage S2→S3 transition', () => {
  it('prefers Situation 3 when Sophie/Daniel present even if Sarah/James recap appears', () => {
    const transition =
      "That scenario is complete. What I got was that James should have celebrated Sarah first. Here's the third situation.\n\nSophie and Daniel have had the same argument for the third time.";
    expect(detectActiveScenarioFromMessage(transition)?.label).toBe('Situation 3');
  });
});
