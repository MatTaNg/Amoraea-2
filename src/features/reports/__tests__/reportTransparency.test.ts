import { describe, expect, it } from '@jest/globals';
import type { ReportData } from '@features/psychometrics/personalReportData';
import type { GamingCorrectionResult } from '@features/psychometrics/computeGamingCorrection';
import {
  REPORT_EVIDENCE_MIXED_HEADING,
  REPORT_FOOTER_DISCLAIMER,
  detectEvidenceConflicts,
  finalizeUserFacingReportMarkdown,
  insertTemplatedReportSections,
} from '../reportTransparency';

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
  gaspScore: null,
  dweckScore: null,
  rsesScore: null,
};

function mattLikeData(): ReportData {
  const gaming: GamingCorrectionResult = {
    correctedModifier: 0,
    originalModifier: 0,
    correctionApplied: 0,
    additionalPenalty: 0,
    strippedInstruments: ['aaq2', 'gasp', 'rses'],
    allPositivesStripped: false,
    correctionLevel: 2,
    activeTriggers: [
      {
        type: 'consistency_divergence',
        instrument: 'aaq2',
        detail: 'AAQ-II diverged from regulation',
        level: 2,
      },
    ],
    explanation: 'test',
  };
  return {
    user: {
      name: 'Matt',
      aaq2Score: 35,
      rsesScore: 25,
      scsPublicScore: 18,
      scsPrivateScore: 20,
      psychometricModifier: null,
      psychometrics: { ...emptyPsychometrics, gaspScore: 4.25, dweckScore: 3, rfqScore: 4.25 },
      psychometricStraightLineFlags: [],
    },
    attempt: {
      weightedScore: 6,
      depthSignalModifier: null,
      finalScore: 6,
      passed: false,
      finalGatePass: false,
      gateFailReasons: [],
      gamingCorrection: gaming,
      pillarScores: { regulation: 7.2, attunement: 6.5, mentalizing: 6, accountability: 5 },
      egoDevLevel: 3,
      emotionRecognitionScore: 70,
      disclosureCalibration: 'balanced',
      moment4Concreteness: 'low',
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

describe('reportTransparency', () => {
  it('detects AAQ-II/regulation divergence when gaming correction flagged', () => {
    const conflicts = detectEvidenceConflicts(mattLikeData());
    expect(conflicts.some((c) => c.id === 'aaq2_regulation_divergence')).toBe(true);
    expect(conflicts[0]?.paragraph).toMatch(/questionnaire\/self-report results suggested more/i);
    expect(conflicts[0]?.paragraph).not.toMatch(/gaming correction/i);
  });

  it('emits mixed section even without gaming correction flag if tension exists', () => {
    const data = mattLikeData();
    data.attempt!.gamingCorrection = null;
    const conflicts = detectEvidenceConflicts(data);
    expect(conflicts.length).toBeGreaterThan(0);
    expect(conflicts.some((c) => c.id === 'aaq2_regulation_divergence')).toBe(true);
  });

  it('inserts mixed-evidence before Practical Steps and confidence before Closing', () => {
    const conflicts = detectEvidenceConflicts(mattLikeData());
    const out = insertTemplatedReportSections(
      '## Overview\nYou show patterns.\n\n## What Tends to Get in the Way\nFriction.\n\n## Practical Steps Forward\nTry this.\n\n## Closing\nWarm close.',
      conflicts,
    );
    expect(out).toMatch(new RegExp(`## ${REPORT_EVIDENCE_MIXED_HEADING}`));
    expect(out).toMatch(/About the Confidence of These Findings/);
    expect(out.indexOf(REPORT_EVIDENCE_MIXED_HEADING)).toBeLessThan(
      out.indexOf('## Practical Steps Forward'),
    );
    expect(out.indexOf(REPORT_EVIDENCE_MIXED_HEADING)).toBeGreaterThan(
      out.indexOf('## What Tends to Get in the Way'),
    );
    expect(out.indexOf('About the Confidence of These Findings')).toBeLessThan(out.indexOf('## Closing'));
  });

  it('footer disclaimer no longer claims assembled system is validated', () => {
    expect(REPORT_FOOTER_DISCLAIMER).not.toMatch(/validated scientific instruments/i);
    expect(REPORT_FOOTER_DISCLAIMER).toMatch(/automated scoring and AI-generated writing/i);
  });

  it('finalizeUserFacingReportMarkdown applies templated sections without regex name masking', () => {
    const out = finalizeUserFacingReportMarkdown(
      '## Overview\nConflict with Devanshu.\n\n## What Tends to Get in the Way\nPatterns.\n\n## Practical Steps Forward\nSteps.\n\n## Closing\nDone.',
      mattLikeData(),
    );
    expect(out).toMatch(/Where the Evidence Was Mixed/);
    expect(out).toMatch(/Devanshu/);
    expect(out).not.toMatch(/someone close to you and/i);
  });

  it('detects BRS/regulation divergence at config thresholds', () => {
    const data = mattLikeData();
    data.user.psychometrics.brsScore = 2.4;
    data.attempt!.pillarScores = { ...data.attempt!.pillarScores!, regulation: 7.5 };
    data.attempt!.gamingCorrection = {
      ...data.attempt!.gamingCorrection!,
      activeTriggers: [{ type: 'consistency_divergence', instrument: 'brs', detail: 'test', level: 2 }],
    };
    const conflicts = detectEvidenceConflicts(data);
    expect(conflicts.some((c) => c.id === 'brs_regulation_divergence')).toBe(true);
  });

  it('detects RFQ/mentalizing high-self-report divergence at config thresholds', () => {
    const data = mattLikeData();
    data.user.psychometrics.rfqScore = 5.6;
    data.attempt!.pillarScores = { ...data.attempt!.pillarScores!, mentalizing: 3.5 };
    data.attempt!.gamingCorrection = {
      ...data.attempt!.gamingCorrection!,
      activeTriggers: [{ type: 'consistency_divergence', instrument: 'rfq', detail: 'test', level: 2 }],
    };
    const conflicts = detectEvidenceConflicts(data);
    expect(conflicts.some((c) => c.id === 'rfq_mentalizing_divergence_high_self_report')).toBe(true);
  });

  it('detects AAQ-II 31 vs Regulation 6 divergence requested by user', () => {
    const data = mattLikeData();
    data.user.aaq2Score = 31;
    data.attempt!.pillarScores = { ...data.attempt!.pillarScores!, regulation: 6 };
    data.attempt!.gamingCorrection = {
      ...data.attempt!.gamingCorrection!,
      activeTriggers: [
        {
          type: 'consistency_divergence',
          instrument: 'aaq2',
          detail: 'AAQ-II 31 vs Regulation 6',
          level: 1,
        },
      ],
    };
    const conflicts = detectEvidenceConflicts(data);
    expect(conflicts.some((c) => c.id === 'aaq2_regulation_divergence')).toBe(true);
    expect(conflicts[0]?.paragraph).toMatch(/questionnaire\/self-report results suggested more/i);
  });
});
