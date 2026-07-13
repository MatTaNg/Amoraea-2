import { describe, expect, it } from '@jest/globals';
import {
  buildPartialReportPrompt,
  buildPartialSystemPrompt,
  parseMoment4ProfileFromStoredPatterns,
} from '../partialReportPrompt';
import type { PartialReportData } from '../partialReportPrompt';

const minimalPartialData: PartialReportData = {
  user: { name: 'Alex' },
  attempt: {
    pillarScores: { repair: 6, attunement: 7, regulation: 6, mentalizing: 8 },
    egoDevLevel: 3,
    emotionRecognitionScore: 70,
    disclosureCalibration: 'balanced',
    moment4Concreteness: 'low',
    moment5Concreteness: 'high',
    vocabDensity: 1.1,
    vocabLow: false,
    projection: false,
    splitting: false,
    rationalization: false,
    denial: false,
    mentalizing_overcertainty_count: 0,
    aiSummary: null,
    aiStrengths: [],
    finalGatePass: false,
    gateFailReasons: ['insufficient_depth'],
    gamingCorrection: null,
    finalScore: 5.8,
    mentalizingProfile: null,
    moment4Profile: null,
    moment5Profile: null,
    scenarioKeyEvidence: null,
    scenarioScoreGrounding: null,
  },
};

describe('buildPartialSystemPrompt', () => {
  it('forbids psychometric instruments and includes evidence-type constraint', () => {
    const system = buildPartialSystemPrompt();
    expect(system).toMatch(/NOT yet completed the self-assessment battery/i);
    expect(system).toMatch(/Do NOT reference psychometric instruments/i);
    expect(system).toMatch(/EVIDENCE-TYPE CONSTRAINT/i);
    expect(system).toMatch(/does not capture real-time behavior under live conflict pressure/i);
  });
});

describe('buildPartialReportPrompt narrative calibration', () => {
  it('includes gate-fail calibration when finalGatePass is false', () => {
    const prompt = buildPartialReportPrompt(minimalPartialData);
    expect(prompt).toMatch(/NARRATIVE CALIBRATION \(follow exactly\):/);
    expect(prompt).toMatch(/OVERALL OUTCOME \(internal\)/);
    expect(prompt).toMatch(/did not clear the bar/i);
  });

  it('names the user and omits self-assessment sections', () => {
    const prompt = buildPartialReportPrompt(minimalPartialData);
    expect(prompt).toMatch(/partial personal development preview for Alex/i);
    expect(prompt).not.toMatch(/SELF-ASSESSMENTS:/);
    expect(prompt).toMatch(/What's Still to Come/i);
  });
});

describe('parseMoment4ProfileFromStoredPatterns', () => {
  it('parses pillar scores and key evidence from moment_4_scores', () => {
    const profile = parseMoment4ProfileFromStoredPatterns({
      moment_4_scores: {
        pillarScores: { mentalizing: 5, accountability: 6 },
        keyEvidence: { mentalizing: 'Thin procedural account' },
      },
    });

    expect(profile?.pillarScores).toEqual({ mentalizing: 5, accountability: 6 });
    expect(profile?.keyEvidence?.mentalizing).toBe('Thin procedural account');
  });

  it('returns null when moment_4_scores is absent', () => {
    expect(parseMoment4ProfileFromStoredPatterns({})).toBeNull();
    expect(parseMoment4ProfileFromStoredPatterns(null)).toBeNull();
  });
});
