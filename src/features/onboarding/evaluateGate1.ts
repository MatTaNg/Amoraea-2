/**
 * Gate 1 (interview) pass/fail. Pure function — no side effects.
 * Pass conditions (ALL must be true):
 * - Average pillar score across all 6 pillars ≥ 6.5
 * - Pillar 1 (Conflict & Repair) score ≥ 6
 * - Pillar 3 (Accountability) score ≥ 6
 * - No high-confidence pillar scores below 5
 * - No more than one low-confidence pillar
 *
 * failReasons is for internal analytics only — never shown to user.
 */

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

const PILLAR_IDS = ['1', '3', '4', '5', '6', '9'];
const AVG_THRESHOLD = 6.5;
const PILLAR_1_MIN = 6;
const PILLAR_3_MIN = 6;
const HIGH_CONFIDENCE_MIN = 5;
const MAX_LOW_CONFIDENCE_COUNT = 1;

export function evaluateGate1(scoringResult: Gate1ScoringResult): EvaluateGate1Result {
  const failReasons: string[] = [];
  const pillarScores = scoringResult.pillarScores ?? {};
  const pillarConfidence = scoringResult.pillarConfidence ?? {};

  const scores = PILLAR_IDS.map((id) => ({ id, score: pillarScores[id] ?? 0 }));
  const sum = scores.reduce((a, s) => a + s.score, 0);
  const averageScore = scores.length ? sum / scores.length : 0;

  if (averageScore < AVG_THRESHOLD) {
    failReasons.push(`averageScore ${averageScore.toFixed(1)} below threshold ${AVG_THRESHOLD}`);
  }

  const p1 = pillarScores['1'] ?? 0;
  const p3 = pillarScores['3'] ?? 0;
  if (p1 < PILLAR_1_MIN) {
    failReasons.push(`Pillar 1 (Conflict & Repair) score ${p1} below minimum ${PILLAR_1_MIN}`);
  }
  if (p3 < PILLAR_3_MIN) {
    failReasons.push(`Pillar 3 (Accountability) score ${p3} below minimum ${PILLAR_3_MIN}`);
  }

  let lowConfidenceCount = 0;
  for (const id of PILLAR_IDS) {
    const score = pillarScores[id] ?? 0;
    const conf = (pillarConfidence[id] ?? '').toLowerCase();
    const isHighConfidence = conf === 'high' || conf === 'high_confidence' || conf === 'high confidence';
    if (isHighConfidence && score < HIGH_CONFIDENCE_MIN) {
      failReasons.push(`Pillar ${id} high-confidence score ${score} below ${HIGH_CONFIDENCE_MIN}`);
    }
    const isLowConfidence = conf === 'low' || conf === 'low_confidence' || conf === 'low confidence';
    if (isLowConfidence) lowConfidenceCount++;
  }
  if (lowConfidenceCount > MAX_LOW_CONFIDENCE_COUNT) {
    failReasons.push(`more than ${MAX_LOW_CONFIDENCE_COUNT} low-confidence pillar(s): ${lowConfidenceCount}`);
  }

  const passed = failReasons.length === 0;
  return { passed, averageScore, failReasons };
}
