import { describe, expect, it } from '@jest/globals';
import { buildPartialReportPrompt } from '../generatePartialReport';
import type { PartialReportData } from '../generatePartialReport';

const mattLikePartialData: PartialReportData = {
  user: { name: 'Matt' },
  attempt: {
    pillarScores: {
      repair: 6,
      mentalizing: 8,
      accountability: 6,
      attunement: 7,
      regulation: 6,
      appreciation: 6,
      commitment_threshold: 6,
      contempt: 7,
    },
    egoDevLevel: 3,
    emotionRecognitionScore: 7,
    disclosureCalibration: 'balanced',
    moment4Concreteness: 'low',
    moment5Concreteness: 'high',
    vocabDensity: 1.2,
    vocabLow: false,
    projection: false,
    splitting: false,
    rationalization: false,
    denial: false,
    mentalizing_overcertainty_count: 1,
    aiSummary: null,
    aiStrengths: [],
    finalGatePass: true,
    gateFailReasons: [],
    gamingCorrection: null,
    finalScore: 6.8,
    mentalizingProfile: {
      scenario1: 8,
      scenario2: 8,
      scenario3: 9,
      moment4: 5,
      holisticPillar: 8,
      scenarioAverage: 8.3,
      moment4GapFromScenarioAverage: 3.3,
      keyEvidence: {
        scenario1: null,
        scenario2: null,
        scenario3: 'Sharp read of Daniel feeling unsafe around Sophie and freezing under confrontation',
        moment4: 'Thin procedural grudge account with little stated internal experience',
      },
    },
    moment4Profile: {
      pillarScores: { mentalizing: 5, accountability: 5 },
      keyEvidence: {
        mentalizing: 'Described the grudge procedurally without much inner emotional detail',
      },
    },
    moment5Profile: {
      pillarScores: { accountability: 5, mentalizing: 5, repair: 6 },
      keyEvidence: {
        accountability: 'Got facilitated at a retreat and ended up cool — little ownership of own contribution',
        mentalizing: 'Thin account of own feelings during the Devanshu conflict',
      },
    },
    scenarioKeyEvidence: {
      scenario1: null,
      scenario2: null,
      scenario3: {
        mentalizing: 'He feels unsafe around Sophie and goes into freeze mode under confrontation',
        repair: 'Repair language stayed structural rather than naming what Sophie specifically needed',
      },
    },
    scenarioScoreGrounding: null,
  },
};

describe('buildPartialReportPrompt', () => {
  it('includes evidence-type constraint forbidding real-time conflict claims', () => {
    const prompt = buildPartialReportPrompt(mattLikePartialData);
    expect(prompt).toMatch(/EVIDENCE-TYPE CONSTRAINT/i);
    expect(prompt).toMatch(/does not capture real-time behavior under live conflict pressure/i);
    expect(prompt).toMatch(/in the heat of the moment/i);
    expect(prompt).toMatch(/confident prediction about live behavior/i);
    expect(prompt).toMatch(/when you reason through conflict/i);
  });

  it('requires strengths to use reflective framing, not live-behavior predictions', () => {
    const prompt = buildPartialReportPrompt(mattLikePartialData);
    expect(prompt).toMatch(/Frame strengths in terms of what reflective answers demonstrated/i);
    expect(prompt).toMatch(/do not imply confident predictions about live, real-time behavior/i);
  });

  it('includes M4/M5 scorer notes and mentalizing asymmetry instructions', () => {
    const prompt = buildPartialReportPrompt(mattLikePartialData);
    expect(prompt).toMatch(/Personal grudge\/reflection moment \(M4/i);
    expect(prompt).toMatch(/Personal conflict moment \(M5/i);
    expect(prompt).toMatch(/MENTALIZING ASYMMETRY \(MANDATORY\)/i);
    expect(prompt).toMatch(/unsafe around Sophie/i);
    expect(prompt).toMatch(/Devanshu conflict/i);
    expect(prompt).toMatch(/EVIDENCE GROUNDING RULE/i);
  });

  it('requires growth areas to ground repair in observable answer patterns, not live conflict', () => {
    const prompt = buildPartialReportPrompt(mattLikePartialData);
    expect(prompt).toMatch(/Do not claim patterns appear under live, real-time conflict pressure/i);
    expect(prompt).toMatch(/structural\/procedural repair language/i);
    expect(prompt).toMatch(/sharp other-directed reads and thinner personal accounts/i);
  });
});
