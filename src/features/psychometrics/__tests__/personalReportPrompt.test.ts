import type { GamingCorrectionResult } from '../computeGamingCorrection';
import { buildReportPrompt } from '../personalReportPrompt';
import type { ReportData } from '../personalReportData';

const emptyPsychometrics = {
  brsScore: null,
  scsSfScore: null,
  scsSfSelfKindnessScore: null,
  scsSfCommonHumanityScore: null,
  scsSfMindfulnessScore: null,
  mspssScore: null,
  mspssFamilyScore: null,
  mspssFriendsScore: null,
  rfqScore: null,
};

function minimalReportData(overrides: {
  user?: Partial<ReportData['user']>;
  attempt?: Partial<NonNullable<ReportData['attempt']>>;
} = {}): ReportData {
  const base = {
    user: {
      name: 'Test',
      aaq2Score: 20,
      rsesScore: 28,
      scsPublicScore: 20,
      scsPrivateScore: 22,
      psychometricModifier: null,
      psychometrics: emptyPsychometrics,
      psychometricStraightLineFlags: [],
    },
    attempt: {
      weightedScore: 6,
      depthSignalModifier: null,
      finalScore: 6,
      passed: false,
      finalGatePass: false,
      gateFailReasons: [],
      gamingCorrection: null,
      pillarScores: { repair: 7, attunement: 7, regulation: 7, mentalizing: 7 },
      egoDevLevel: 3,
      emotionRecognitionScore: 70,
      disclosureCalibration: 'balanced',
      moment4Concreteness: 'high',
      moment5Concreteness: 'high',
      vocabDensity: 1.2,
      vocabLow: false,
      defensePatterns: null,
      mentalizing_overcertainty_count: 0,
      projection: false,
      splitting: false,
      rationalization: false,
      denial: false,
      mentalizingProfile: null,
      moment5Profile: null,
      scenarioKeyEvidence: null,
      scenarioScoreGrounding: null,
    },
  };
  return {
    user: { ...base.user, ...overrides.user },
    attempt: { ...base.attempt, ...overrides.attempt },
  };
}

describe('buildReportPrompt RSES gating', () => {
  it('includes self-esteem line when RSES is narratable', () => {
    const prompt = buildReportPrompt(minimalReportData());
    expect(prompt).toMatch(/Self-esteem and self-worth:/);
  });

  it('omits self-esteem line when rses_straight_line is flagged', () => {
    const prompt = buildReportPrompt(
      minimalReportData({
        user: {
          psychometricStraightLineFlags: ['rses_straight_line'],
        },
      }),
    );
    expect(prompt).not.toMatch(/Self-esteem and self-worth:/);
    expect(prompt).toMatch(/Psychological flexibility \/ relationship with emotions:/);
    expect(prompt).toMatch(/Self-awareness orientation:/);
  });

  it('includes self-esteem line when RSES is stripped by gaming correction', () => {
    const gaming: GamingCorrectionResult = {
      correctedModifier: 0,
      originalModifier: 0,
      correctionApplied: 0,
      additionalPenalty: 0,
      strippedInstruments: ['rses'],
      allPositivesStripped: false,
      correctionLevel: 1,
      activeTriggers: [
        {
          type: 'straight_line',
          level: 1,
          instrument: 'rses',
          detail: 'Straight-line on rses',
        },
      ],
      explanation: 'test',
    };
    const prompt = buildReportPrompt(
      minimalReportData({
        attempt: { gamingCorrection: gaming },
      }),
    );
    expect(prompt).toMatch(/Self-esteem and self-worth:/);
    expect(prompt).toMatch(/POPULATED PSYCHOMETRIC LENSES/);
  });
});
