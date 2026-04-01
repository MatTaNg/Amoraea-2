/**
 * Gate 1 (interview) pass/fail. Pure function — no side effects.
 * Pass conditions (ALL must be true):
 * - Average marker score across all scored interview markers ≥ 6.5
 * - Repair score ≥ 6
 * - Accountability score ≥ 6
 * - No high-confidence marker scores below 5
 * - No more than one low-confidence marker
 *
 * failReasons is for internal analytics only — never shown to user.
 */

import {
  INTERVIEW_MARKER_IDS,
  GATE_MIN_ACCOUNTABILITY_MARKER,
  GATE_MIN_REPAIR_MARKER,
} from '@features/aria/interviewMarkers';

export interface Gate1ScoringResult {
  pillarScores: Record<string, number>;
  pillarConfidence?: Record<string, string>;
  averageScore?: number;
  narrativeCoherence?: string;
  behavioralSpecificity?: string;
  noExampleConstructs?: string[];
  avoidanceSignals?: string[];
}

export interface EvaluateGate1Result {
  passed: boolean;
  averageScore: number;
  failReasons: string[];
}

const MARKER_IDS = [...INTERVIEW_MARKER_IDS];
const AVG_THRESHOLD = 6.5;
const REPAIR_MIN = 6;
const ACCOUNTABILITY_MIN = 6;
const HIGH_CONFIDENCE_MIN = 5;
const MAX_LOW_CONFIDENCE_COUNT = 1;

export function evaluateGate1(scoringResult: Gate1ScoringResult): EvaluateGate1Result {
  const failReasons: string[] = [];
  const pillarScores = scoringResult.pillarScores ?? {};
  const pillarConfidence = scoringResult.pillarConfidence ?? {};

  const scores = MARKER_IDS.map((id) => ({ id, score: pillarScores[id] ?? 0 }));
  const sum = scores.reduce((a, s) => a + s.score, 0);
  const averageScore = scores.length ? sum / scores.length : 0;

  if (averageScore < AVG_THRESHOLD) {
    failReasons.push(`averageScore ${averageScore.toFixed(1)} below threshold ${AVG_THRESHOLD}`);
  }

  const repair = pillarScores[GATE_MIN_REPAIR_MARKER] ?? 0;
  const accountability = pillarScores[GATE_MIN_ACCOUNTABILITY_MARKER] ?? 0;
  if (repair < REPAIR_MIN) {
    failReasons.push(`Repair score ${repair} below minimum ${REPAIR_MIN}`);
  }
  if (accountability < ACCOUNTABILITY_MIN) {
    failReasons.push(`Accountability score ${accountability} below minimum ${ACCOUNTABILITY_MIN}`);
  }

  let lowConfidenceCount = 0;
  for (const id of MARKER_IDS) {
    const score = pillarScores[id] ?? 0;
    const conf = (pillarConfidence[id] ?? '').toLowerCase();
    const isHighConfidence = conf === 'high' || conf === 'high_confidence' || conf === 'high confidence';
    if (isHighConfidence && score < HIGH_CONFIDENCE_MIN) {
      failReasons.push(`Marker ${id} high-confidence score ${score} below ${HIGH_CONFIDENCE_MIN}`);
    }
    const isLowConfidence = conf === 'low' || conf === 'low_confidence' || conf === 'low confidence';
    if (isLowConfidence) lowConfidenceCount++;
  }
  if (lowConfidenceCount > MAX_LOW_CONFIDENCE_COUNT) {
    failReasons.push(`more than ${MAX_LOW_CONFIDENCE_COUNT} low-confidence marker(s): ${lowConfidenceCount}`);
  }

  const passed = failReasons.length === 0;
  return { passed, averageScore, failReasons };
}
