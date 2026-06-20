import { composeNarrativeCalibration } from '@features/reports/narrativeCalibration';
import {
  buildValidationReportUserPrompt,
  buildValidationSectionGateClause,
  computeValidationReportSourceHash,
  VALIDATION_REPORT_PROMPT_CALIBRATION_VERSION,
  type ValidationReportData,
} from '../generateValidationReport';

function minimalFullReportData(
  overrides: Partial<ValidationReportData> = {},
): ValidationReportData {
  return {
    userName: 'Test User',
    reportTier: 'full',
    aaq2Score: null,
    gaspProfile: null,
    preAssessment: null,
    selfProfile: {
      attachmentLabel: 'Secure',
      attachmentDescription: 'Comfortable with closeness',
      topValues: ['Benevolence'],
      conflictStyleLabel: 'Collaborating',
    },
    assessments: { ecr: {}, pvq: {}, conflict: {} },
    compatibility: {
      partnerComplete: false,
      score: null,
      breakdown: null,
      partnerProfile: null,
      partnerGaspProfile: null,
    },
    interview: {
      attemptId: 'attempt-1',
      transcriptText: 'Participant: hello',
      performanceTier: 'needs_development',
      finalGatePass: false,
      gateFailReasons: ['weighted_score'],
      gamingCorrection: null,
      modifiedWeightedScore: 5.45,
      pillarScores: { repair: 6, accountability: 6 },
      scenarioKeyEvidence: {
        scenario1: null,
        scenario2: null,
        scenario3: null,
        moment4: null,
      },
      scenarioMentalizingScores: {
        scenario1: 5,
        scenario2: 6,
        scenario3: 6,
        moment4: null,
      },
    },
    ...overrides,
  };
}

describe('buildValidationSectionGateClause', () => {
  it('returns fail clauses only for needs_development', () => {
    expect(buildValidationSectionGateClause('needs_development', 'overview')).toMatch(
      /Do NOT characterize overall interview performance as strong/i,
    );
    expect(buildValidationSectionGateClause('strong_demonstration', 'overview')).toBe('');
    expect(buildValidationSectionGateClause('balanced_demonstration', 'strengths')).toBe('');
  });

  it('allows normal psychometric tone on fail for attachment section', () => {
    expect(buildValidationSectionGateClause('needs_development', 'attachment')).toMatch(
      /psychometric- or survey-derived/i,
    );
  });
});

describe('buildValidationReportUserPrompt', () => {
  it('injects INTERVIEW TONE CALIBRATION near interview evidence for fail tier', () => {
    const prompt = buildValidationReportUserPrompt(minimalFullReportData());
    expect(prompt).toMatch(/INTERVIEW TONE CALIBRATION/i);
    expect(prompt).toMatch(/Performance tier: needs_development/i);
    expect(prompt).toMatch(/do NOT use unqualified strength language/i);
    const evidenceIdx = prompt.indexOf('INTERVIEW SCORING EVIDENCE');
    const toneIdx = prompt.indexOf('INTERVIEW TONE CALIBRATION');
    const transcriptIdx = prompt.indexOf('TRANSCRIPT:');
    expect(evidenceIdx).toBeGreaterThan(-1);
    expect(toneIdx).toBeGreaterThan(evidenceIdx);
    expect(transcriptIdx).toBeGreaterThan(toneIdx);
  });

  it('adds section gate clauses for Overview, Strengths, and Closing on fail tier', () => {
    const prompt = buildValidationReportUserPrompt(minimalFullReportData());
    expect(prompt).toMatch(/## Overview[\s\S]*GATE TONE \(needs_development\): Do NOT characterize overall interview/i);
    expect(prompt).toMatch(/## Your Relational Strengths[\s\S]*Draw strengths primarily from psychometric/i);
    expect(prompt).toMatch(/## Closing[\s\S]*Do not close with unqualified celebration/i);
  });

  it('preserves warm Overview framing for passing tier', () => {
    const prompt = buildValidationReportUserPrompt(
      minimalFullReportData({
        interview: {
          ...minimalFullReportData().interview!,
          performanceTier: 'strong_demonstration',
          finalGatePass: true,
          gateFailReasons: [],
          modifiedWeightedScore: 7.2,
        },
      }),
    );
    expect(prompt).toMatch(/This should feel like being truly seen/i);
    expect(prompt).not.toMatch(/GATE TONE \(needs_development\)/);
    expect(prompt).toMatch(/Warm, honest closing acknowledging what they bring/i);
  });

  it('includes priority principle clarifier for interview_fail in narrative calibration block', () => {
    const prompt = buildValidationReportUserPrompt(minimalFullReportData());
    expect(prompt).toMatch(/does not override INTERVIEW FAIL TONE/i);
    expect(prompt).toMatch(/A failing weighted_score IS the interview signal/i);
  });
});

describe('computeValidationReportSourceHash', () => {
  it('changes when prompt calibration version bumps', () => {
    const data = minimalFullReportData();
    const hash = computeValidationReportSourceHash(data);
    expect(hash).toBeTruthy();
    void VALIDATION_REPORT_PROMPT_CALIBRATION_VERSION;
    expect(hash.length).toBeGreaterThan(0);
  });
});

describe('composeNarrativeCalibration interview_fail clarifier', () => {
  it('appends priority principle override note for weighted_score fail', () => {
    const block = composeNarrativeCalibration({
      finalGatePass: false,
      gateFailReasons: ['weighted_score'],
      gamingCorrection: null,
      pillarScores: { repair: 7 },
    });
    expect(block).toMatch(/does not override INTERVIEW FAIL TONE/i);
    expect(block).not.toMatch(/PSYCHOMETRIC-ONLY CONCERN TONE/i);
  });

  it('does not append clarifier for psychometric_floor_only tier', () => {
    const block = composeNarrativeCalibration({
      finalGatePass: false,
      gateFailReasons: ['rses_low_self_esteem_floor'],
      gamingCorrection: null,
      pillarScores: { repair: 8 },
    });
    expect(block).not.toMatch(/does not override INTERVIEW FAIL TONE/i);
    expect(block).toMatch(/PSYCHOMETRIC-ONLY CONCERN TONE/i);
  });
});
