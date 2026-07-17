import { describe, expect, it } from '@jest/globals';

import { mergeLocalAndDbScenarioScores } from '@features/aria/fetchResumeScoringIntegritySnapshot';
import {
  clearScenarioScoresFromCorruptRewind,
  earliestCorruptOrInterruptedScenarioScore,
  scenarioScoreBundleIntact,
  scenarioScoringCorruptOrInterrupted,
  sliceMessagesBeforeMoment4Intro,
} from '@utilities/interviewResumeCursor';

describe('corrupt scoring integrity helpers', () => {
  it('scenarioScoreBundleIntact requires numeric pillars', () => {
    expect(
      scenarioScoreBundleIntact(1, {
        1: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
      }),
    ).toBe(true);
    expect(
      scenarioScoreBundleIntact(1, {
        1: { pillarScores: { repair: null }, pillarConfidence: {}, keyEvidence: {} },
      }),
    ).toBe(false);
    expect(scenarioScoreBundleIntact(1, {})).toBe(false);
  });

  it('flags claimed-complete without scores as interrupted', () => {
    expect(scenarioScoringCorruptOrInterrupted(1, [1], {})).toBe(true);
    expect(
      scenarioScoringCorruptOrInterrupted(1, [1], {
        1: { pillarScores: { repair: 5 }, pillarConfidence: {}, keyEvidence: {} },
      }),
    ).toBe(false);
  });

  it('earliestCorruptOrInterruptedScenarioScore returns first bad scenario', () => {
    expect(
      earliestCorruptOrInterruptedScenarioScore([1, 2], {
        1: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
      }),
    ).toBe(2);
  });

  it('clearScenarioScoresFromCorruptRewind drops from corrupt scenario onward', () => {
    const out = clearScenarioScoresFromCorruptRewind(
      {
        1: { pillarScores: { repair: 6 }, pillarConfidence: {}, keyEvidence: {} },
        2: { pillarScores: { repair: null }, pillarConfidence: {}, keyEvidence: {} },
        3: { pillarScores: { repair: 4 }, pillarConfidence: {}, keyEvidence: {} },
      },
      [1, 2, 3],
      2,
    );
    expect(out.scenariosCompleted).toEqual([1]);
    expect(out.scenarioScores[1]).toBeTruthy();
    expect(out.scenarioScores[2]).toBeUndefined();
    expect(out.scenarioScores[3]).toBeUndefined();
  });

  it('sliceMessagesBeforeMoment4Intro drops M4+ turns', () => {
    const msgs = [
      { role: 'assistant', content: "Here's the third situation. Sophie and Daniel." },
      { role: 'user', content: 'They should talk it through.' },
      {
        role: 'assistant',
        content:
          "That's the end of the three described situations. Have you ever held a grudge against someone?",
      },
      { role: 'user', content: 'Yes, with a friend.' },
    ];
    const sliced = sliceMessagesBeforeMoment4Intro(msgs);
    expect(sliced).toHaveLength(2);
    expect(sliced[1]?.content).toContain('talk it through');
  });

  it('mergeLocalAndDbScenarioScores prefers intact DB over missing local', () => {
    const merged = mergeLocalAndDbScenarioScores({
      local: {},
      dbCells: {
        scenario_1_scores: {
          pillarScores: { repair: 7 },
          pillarConfidence: {},
          keyEvidence: {},
        },
        scenario_2_scores: null,
        scenario_3_scores: null,
      },
    });
    expect(scenarioScoreBundleIntact(1, merged)).toBe(true);
  });

  it('mergeLocalAndDbScenarioScores keeps intact local over DB', () => {
    const merged = mergeLocalAndDbScenarioScores({
      local: {
        1: { pillarScores: { repair: 5 }, pillarConfidence: {}, keyEvidence: { repair: 'local' } },
      },
      dbCells: {
        scenario_1_scores: {
          pillarScores: { repair: 9 },
          pillarConfidence: {},
          keyEvidence: { repair: 'db' },
        },
        scenario_2_scores: null,
        scenario_3_scores: null,
      },
    });
    expect(merged[1]?.pillarScores?.repair).toBe(5);
  });
});
