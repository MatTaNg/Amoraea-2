import { looksLikeScenarioARepairQuestion } from '@features/aria/scenarioARepairQuestionHelpers';
import { looksLikeScenarioBRepairAsJamesQuestion } from '@features/aria/scenarioBProbeLogic';
import { isScenarioCRepairAssistantPrompt } from '@features/aria/probeAndScoringUtils';
import { userTurnsHaveMeaningfulSpontaneousRepair } from '@features/aria/spontaneousRepairEvidence';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';

/** Rollup treats this as missing evidence (not a low score). */
export const NO_ASSESSABLE_REPAIR_EVIDENCE_FROM_SCENARIO =
  'No assessable repair evidence from this scenario (no repair probe asked; no spontaneous repair).';

export function scenarioTranscriptAskedRepairProbe(
  scenarioNumber: 1 | 2 | 3,
  messages: ReadonlyArray<{ role?: string; content?: string | null; scenarioNumber?: number }>,
): boolean {
  for (const m of messages) {
    if (m.role !== 'assistant') continue;
    if (m.scenarioNumber != null && m.scenarioNumber !== scenarioNumber) continue;
    const text = String(m.content ?? '');
    if (!text.trim()) continue;
    if (scenarioNumber === 1 && looksLikeScenarioARepairQuestion(text)) return true;
    if (scenarioNumber === 2 && looksLikeScenarioBRepairAsJamesQuestion(text)) return true;
    if (scenarioNumber === 3 && isScenarioCRepairAssistantPrompt(text)) return true;
  }
  return false;
}

/**
 * S1/S2 hypothetical repair probes are retired. Absence of volunteer repair is missing evidence,
 * not a low repair score. Historical transcripts that still contain the probe are scored normally.
 */
export function applyUnpromptedScenarioRepairAbsence(params: {
  parsedScenario: ScenarioScoreResult;
  scenarioNumber: 1 | 2 | 3;
  scoringMessages: ReadonlyArray<{ role?: string; content?: string | null; scenarioNumber?: number }>;
}): ScenarioScoreResult {
  const { parsedScenario, scenarioNumber, scoringMessages } = params;
  if (scenarioNumber !== 1 && scenarioNumber !== 2) return parsedScenario;

  const probeAsked = scenarioTranscriptAskedRepairProbe(scenarioNumber, scoringMessages);
  if (probeAsked) {
    const sm = { ...(parsedScenario.scoringMetadata ?? {}) };
    sm.repair_evidence_source = 'prompted';
    parsedScenario.scoringMetadata = sm;
    return parsedScenario;
  }

  const spontaneous = userTurnsHaveMeaningfulSpontaneousRepair(scoringMessages, scenarioNumber);
  if (spontaneous) {
    const sm = { ...(parsedScenario.scoringMetadata ?? {}) };
    sm.repair_evidence_source = 'spontaneous';
    parsedScenario.scoringMetadata = sm;
    const ke = { ...(parsedScenario.keyEvidence ?? {}) };
    if (ke.repair && !/\bspontaneous\b/i.test(ke.repair)) {
      ke.repair = `spontaneous: ${ke.repair}`;
    } else if (!ke.repair) {
      ke.repair = 'spontaneous: meaningful unprompted repair content in this scenario.';
    }
    parsedScenario.keyEvidence = ke;
    return parsedScenario;
  }

  const ps = { ...(parsedScenario.pillarScores ?? {}) };
  const ke = { ...(parsedScenario.keyEvidence ?? {}) };
  const pc = { ...(parsedScenario.pillarConfidence ?? {}) };
  ps.repair = null;
  ke.repair = NO_ASSESSABLE_REPAIR_EVIDENCE_FROM_SCENARIO;
  pc.repair = 'not_assessed';
  parsedScenario.pillarScores = ps;
  parsedScenario.keyEvidence = ke;
  parsedScenario.pillarConfidence = pc;
  const sm = { ...(parsedScenario.scoringMetadata ?? {}) };
  sm.repair_evidence_source = 'unassessed';
  parsedScenario.scoringMetadata = sm;
  return parsedScenario;
}
