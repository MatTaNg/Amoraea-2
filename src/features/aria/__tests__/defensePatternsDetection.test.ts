import { describe, expect, it } from '@jest/globals';
import { detectDefensePatterns } from '../defensePatternsDetection';

const scenarioSlice = (pillarScores: Record<string, number>, keyEvidence: Record<string, string> = {}) => ({
  pillarScores,
  keyEvidence,
});

describe('detectDefensePatterns projection', () => {
  it('does not flag projection when M5 immature judgment is mis-tagged scenarioNumber 3', () => {
    const transcript = [
      {
        role: 'user',
        scenarioNumber: 3,
        interviewMoment: 1,
        content: 'They need to figure out why Daniel keeps running away.',
      },
      {
        role: 'user',
        scenarioNumber: 3,
        interviewMoment: 5,
        content: "I still think he's a bit ignorant and immature, but I understand.",
      },
    ];
    const patterns = detectDefensePatterns(
      [
        scenarioSlice({ repair: 7, accountability: 7, mentalizing: 7, attunement: 7 }),
        scenarioSlice({ repair: 7, accountability: 7, mentalizing: 7, attunement: 7 }),
        scenarioSlice({ repair: 7, accountability: 7, mentalizing: 7, attunement: 7 }),
      ],
      scenarioSlice({ accountability: 6, mentalizing: 6 }),
      scenarioSlice({ accountability: 3, mentalizing: 4 }),
      transcript,
    );
    expect(patterns.projection_detected).toBe(false);
  });

  it('does not flag projection for third-person immature judgment without first-person parallel', () => {
    const transcript = [
      { role: 'user', scenarioNumber: 1, content: "I still think he's a bit ignorant and immature." },
      { role: 'user', scenarioNumber: 4, content: 'I walked away and did not process it for a long time.' },
      { role: 'user', scenarioNumber: 5, content: 'I avoid bringing it up when it feels heavy.' },
    ];
    const patterns = detectDefensePatterns(
      [
        scenarioSlice({ repair: 7, accountability: 7, mentalizing: 7, attunement: 7 }),
        scenarioSlice({ repair: 7, accountability: 7, mentalizing: 7, attunement: 7 }),
        scenarioSlice({ repair: 7, accountability: 7, mentalizing: 7, attunement: 7 }),
      ],
      scenarioSlice({ accountability: 6, mentalizing: 6 }),
      scenarioSlice({ accountability: 6, mentalizing: 6 }),
      transcript,
    );
    expect(patterns.projection_detected).toBe(false);
  });

  it('flags projection when scenario immature read pairs with first-person immature admission', () => {
    const transcript = [
      { role: 'user', scenarioNumber: 2, content: 'He is emotionally immature and does not know how to handle conflict.' },
      { role: 'user', scenarioNumber: 4, content: 'I was immature back then and I struggled with how to show up.' },
    ];
    const patterns = detectDefensePatterns(
      [
        scenarioSlice({ repair: 5, accountability: 5, mentalizing: 5, attunement: 5 }),
        scenarioSlice({ repair: 5, accountability: 5, mentalizing: 5, attunement: 5 }),
        scenarioSlice({ repair: 5, accountability: 5, mentalizing: 5, attunement: 5 }),
      ],
      scenarioSlice({ accountability: 5, mentalizing: 5 }),
      scenarioSlice({ accountability: 5, mentalizing: 5 }),
      transcript,
    );
    expect(patterns.projection_detected).toBe(true);
  });
});
