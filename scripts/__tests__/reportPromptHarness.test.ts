import { describe, expect, it } from '@jest/globals';
import type { GamingCorrectionResult } from '../../src/features/psychometrics/computeGamingCorrection';
import { buildReportPrompt } from '../../src/features/psychometrics/personalReportPrompt';
import type { ReportData } from '../../src/features/psychometrics/personalReportData';
import { extractSelfAssessmentsBlock } from '../lib/reportPromptHarness';

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

function minimalReportData(overrides: Partial<ReportData['user']> = {}): ReportData {
  return {
    user: {
      name: 'Harness',
      aaq2Score: 20,
      rsesScore: 28,
      scsPublicScore: 20,
      scsPrivateScore: 22,
      psychometricModifier: null,
      psychometrics: emptyPsychometrics,
      psychometricStraightLineFlags: [],
      ...overrides,
    },
    attempt: {
      weightedScore: 6,
      depthSignalModifier: null,
      finalScore: 6,
      passed: true,
      finalGatePass: true,
      gateFailReasons: [],
      gamingCorrection: null,
      pillarScores: { repair: 7 },
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
}

describe('extractSelfAssessmentsBlock', () => {
  it('returns the SELF-ASSESSMENTS section from a full personal report prompt', () => {
    const prompt = buildReportPrompt(minimalReportData());
    const block = extractSelfAssessmentsBlock(prompt);

    expect(block).not.toBeNull();
    expect(block).toMatch(/Self-esteem and self-worth:/);
    expect(block).toMatch(/Psychological flexibility/);
  });

  it('omits RSES from the extracted block when straight-line flagged', () => {
    const prompt = buildReportPrompt(
      minimalReportData({ psychometricStraightLineFlags: ['rses_straight_line'] }),
    );
    const block = extractSelfAssessmentsBlock(prompt);

    expect(block).not.toBeNull();
    expect(block).not.toMatch(/Self-esteem and self-worth:/);
    expect(block).toMatch(/Psychological flexibility/);
  });

  it('returns null when the prompt has no SELF-ASSESSMENTS header', () => {
    expect(extractSelfAssessmentsBlock('no psychometrics here')).toBeNull();
  });
});

describe('reportPromptHarness RSES gating parity', () => {
  it('includes RSES when gaming correction strips it from modifier only', () => {
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

    const prompt = buildReportPrompt({
      ...minimalReportData(),
      attempt: { ...minimalReportData().attempt!, gamingCorrection: gaming },
    });
    const block = extractSelfAssessmentsBlock(prompt);
    expect(block).toMatch(/Self-esteem and self-worth:/);
  });
});
