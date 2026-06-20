import type { PartialReportData } from './partialReportPrompt';
import type { ReportData } from './personalReportData';

export type StoredInterviewReports = {
  attemptId: string;
  partialReportMarkdown: string | null;
  partialReportSourceHash: string | null;
  personalReportMarkdown: string | null;
  personalReportSourceHash: string | null;
};

function stableStringify(value: unknown): string {
  if (value == null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

function hashSourcePayload(payload: unknown): string {
  const str = stableStringify(payload);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

export function computePartialReportSourceHash(data: PartialReportData): string {
  return hashSourcePayload({
    kind: 'partial',
    pillarScores: data.attempt?.pillarScores ?? null,
    egoDevLevel: data.attempt?.egoDevLevel ?? null,
    emotionRecognitionScore: data.attempt?.emotionRecognitionScore ?? null,
    disclosureCalibration: data.attempt?.disclosureCalibration ?? null,
    moment4Concreteness: data.attempt?.moment4Concreteness ?? null,
    moment5Concreteness: data.attempt?.moment5Concreteness ?? null,
    vocabDensity: data.attempt?.vocabDensity ?? null,
    vocabLow: data.attempt?.vocabLow ?? null,
    projection: data.attempt?.projection ?? false,
    splitting: data.attempt?.splitting ?? false,
    rationalization: data.attempt?.rationalization ?? false,
    denial: data.attempt?.denial ?? false,
    mentalizing_overcertainty_count: data.attempt?.mentalizing_overcertainty_count ?? null,
    finalGatePass: data.attempt?.finalGatePass ?? null,
    gateFailReasons: data.attempt?.gateFailReasons ?? [],
    mentalizingProfile: data.attempt?.mentalizingProfile ?? null,
    moment4Profile: data.attempt?.moment4Profile ?? null,
    moment5Profile: data.attempt?.moment5Profile ?? null,
    scenarioKeyEvidence: data.attempt?.scenarioKeyEvidence ?? null,
  });
}

export function computePersonalReportSourceHash(data: ReportData): string {
  return hashSourcePayload({
    kind: 'full',
    user: {
      aaq2Score: data.user.aaq2Score,
      rsesScore: data.user.rsesScore,
      scsPublicScore: data.user.scsPublicScore,
      scsPrivateScore: data.user.scsPrivateScore,
      psychometricModifier: data.user.psychometricModifier,
      psychometrics: data.user.psychometrics,
      psychometricStraightLineFlags: data.user.psychometricStraightLineFlags,
    },
    attempt: data.attempt
      ? {
          weightedScore: data.attempt.weightedScore,
          depthSignalModifier: data.attempt.depthSignalModifier,
          finalScore: data.attempt.finalScore,
          passed: data.attempt.passed,
          finalGatePass: data.attempt.finalGatePass,
          gateFailReasons: data.attempt.gateFailReasons,
          gamingCorrection: data.attempt.gamingCorrection
            ? {
                correctionLevel: data.attempt.gamingCorrection.correctionLevel,
                strippedInstruments: data.attempt.gamingCorrection.strippedInstruments,
                activeTriggers: data.attempt.gamingCorrection.activeTriggers.map((t) => ({
                  type: t.type,
                  instrument: t.instrument,
                  level: t.level,
                })),
              }
            : null,
          pillarScores: data.attempt.pillarScores,
          egoDevLevel: data.attempt.egoDevLevel,
          emotionRecognitionScore: data.attempt.emotionRecognitionScore,
          disclosureCalibration: data.attempt.disclosureCalibration,
          moment4Concreteness: data.attempt.moment4Concreteness,
          moment5Concreteness: data.attempt.moment5Concreteness,
          vocabDensity: data.attempt.vocabDensity,
          vocabLow: data.attempt.vocabLow,
          projection: data.attempt.projection,
          splitting: data.attempt.splitting,
          rationalization: data.attempt.rationalization,
          denial: data.attempt.denial,
          mentalizingProfile: data.attempt.mentalizingProfile,
          moment5Profile: data.attempt.moment5Profile,
          scenarioKeyEvidence: data.attempt.scenarioKeyEvidence,
        }
      : null,
  });
}

function readCachedMarkdown(
  markdown: string | null,
  sourceHash: string | null,
  expectedHash: string,
): string | null {
  if (!markdown?.trim() || !sourceHash || sourceHash !== expectedHash) {
    return null;
  }
  return markdown.trim();
}

export function readCachedPartialReportMarkdown(
  stored: StoredInterviewReports,
  expectedHash: string,
): string | null {
  return readCachedMarkdown(
    stored.partialReportMarkdown,
    stored.partialReportSourceHash,
    expectedHash,
  );
}

export function readCachedPersonalReportMarkdown(
  stored: StoredInterviewReports,
  expectedHash: string,
): string | null {
  return readCachedMarkdown(
    stored.personalReportMarkdown,
    stored.personalReportSourceHash,
    expectedHash,
  );
}

/** Full report markdown overrides partial when present and hash-valid. */
export function readCachedReportMarkdownForPartialDownload(
  stored: StoredInterviewReports,
  partialExpectedHash: string,
  personalExpectedHash: string,
): { markdown: string; isFullReport: boolean } | null {
  const full = readCachedPersonalReportMarkdown(stored, personalExpectedHash);
  if (full) {
    return { markdown: full, isFullReport: true };
  }
  const partial = readCachedPartialReportMarkdown(stored, partialExpectedHash);
  if (partial) {
    return { markdown: partial, isFullReport: false };
  }
  return null;
}
