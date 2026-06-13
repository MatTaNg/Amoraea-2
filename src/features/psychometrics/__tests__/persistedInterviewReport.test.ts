import { describe, expect, it } from 'vitest';
import {
  computePartialReportSourceHash,
  computePersonalReportSourceHash,
  readCachedReportMarkdownForPartialDownload,
  type StoredInterviewReports,
} from '../persistedInterviewReportLogic';
import type { ReportData } from '../generateReport';
import type { PartialReportData } from '../generatePartialReport';

const partialData: PartialReportData = {
  user: { name: 'Alex' },
  attempt: {
    pillarScores: { repair: 7.2, attunement: 6.5 },
    egoDevLevel: 3,
    emotionRecognitionScore: 80,
    disclosureCalibration: 'balanced',
    moment4Concreteness: 'concrete',
    moment5Concreteness: 'abstract',
    vocabDensity: 1.2,
    vocabLow: false,
    projection: false,
    splitting: false,
    rationalization: false,
    denial: false,
    mentalizing_overcertainty_count: 1,
    aiSummary: null,
    aiStrengths: [],
  },
};

const fullData: ReportData = {
  user: {
    name: 'Alex',
    aaq2Score: 20,
    rsesScore: 28,
    scsPublicScore: 18,
    scsPrivateScore: 22,
    psychometricModifier: 0.1,
  },
  attempt: {
    weightedScore: 7.1,
    depthSignalModifier: 0,
    finalScore: 7.2,
    passed: true,
    finalGatePass: true,
    pillarScores: { repair: 7.2 },
    egoDevLevel: 3,
    emotionRecognitionScore: 80,
    disclosureCalibration: 'balanced',
    moment4Concreteness: 'concrete',
    moment5Concreteness: 'abstract',
    vocabDensity: 1.2,
    vocabLow: false,
    defensePatterns: null,
    mentalizing_overcertainty_count: 1,
    projection: false,
    splitting: false,
    rationalization: false,
    denial: false,
  },
};

describe('persistedInterviewReport', () => {
  it('produces stable partial and personal source hashes', () => {
    const a = computePartialReportSourceHash(partialData);
    const b = computePartialReportSourceHash(partialData);
    expect(a).toBe(b);
    expect(computePersonalReportSourceHash(fullData)).not.toBe(a);
  });

  it('invalidates cache when underlying scores change', () => {
    const hash = computePartialReportSourceHash(partialData);
    const changed: PartialReportData = {
      ...partialData,
      attempt: partialData.attempt
        ? { ...partialData.attempt, pillarScores: { repair: 5.1 } }
        : null,
    };
    expect(computePartialReportSourceHash(changed)).not.toBe(hash);
  });

  it('prefers full markdown over partial on partial download path', () => {
    const partialHash = computePartialReportSourceHash(partialData);
    const personalHash = computePersonalReportSourceHash(fullData);
    const stored: StoredInterviewReports = {
      attemptId: 'attempt-1',
      partialReportMarkdown: '## Partial body',
      partialReportSourceHash: partialHash,
      personalReportMarkdown: '## Full body',
      personalReportSourceHash: personalHash,
    };

    const result = readCachedReportMarkdownForPartialDownload(stored, partialHash, personalHash);
    expect(result).toEqual({ markdown: '## Full body', isFullReport: true });
  });

  it('falls back to partial markdown when full is absent', () => {
    const partialHash = computePartialReportSourceHash(partialData);
    const personalHash = computePersonalReportSourceHash(fullData);
    const stored: StoredInterviewReports = {
      attemptId: 'attempt-1',
      partialReportMarkdown: '## Partial body',
      partialReportSourceHash: partialHash,
      personalReportMarkdown: null,
      personalReportSourceHash: null,
    };

    const result = readCachedReportMarkdownForPartialDownload(stored, partialHash, personalHash);
    expect(result).toEqual({ markdown: '## Partial body', isFullReport: false });
  });
});
