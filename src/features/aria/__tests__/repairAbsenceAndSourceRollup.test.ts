import { describe, expect, it } from '@jest/globals';
import { GATE_MARKER_BASE_WEIGHTS } from '@config/scoring/interviewGateThresholds';
import { INTERVIEW_CANONICAL_PROBES } from '@features/aria/interviewCanonicalProbeRegistry';
import {
  aggregateMarkerScoresFromLabeledSlices,
  extractRegulationSourceSignals,
  extractRepairSourceSignals,
  type PillarMomentLabel,
} from '@features/aria/aggregateMarkerScoresFromSlices';
import { computeGateResultCore } from '@features/aria/computeGateResultCore';
import { INTERVIEW_MARKER_IDS } from '@features/aria/interviewMarkers';
import { postProcessScenarioModelScore } from '@features/aria/postProcessScenarioModelScore';
import { NO_ASSESSABLE_REPAIR_EVIDENCE_FROM_SCENARIO } from '@features/aria/sanitizeUnpromptedScenarioRepairAbsence';
import { looksLikeMeaningfulSpontaneousRepairContent } from '@features/aria/spontaneousRepairEvidence';
import { SKIPPED_BY_USER_FRUSTRATION_EVIDENCE } from '@features/aria/probeEvidenceUtils';
import type { ScenarioScoreResult } from '@features/aria/scoreInterviewScoringHelpers';

function labeled(
  moment: PillarMomentLabel,
  pillarScores: Record<string, number | null>,
  keyEvidence: Record<string, string>,
) {
  return { moment, pillarScores, keyEvidence };
}

function scoreScenario(
  scenarioNumber: 1 | 2 | 3,
  messages: { role: string; content: string; scenarioNumber?: number }[],
  repairScore: number | null,
): ScenarioScoreResult {
  const userText = messages.filter((m) => m.role === 'user').map((m) => m.content).join(' ');
  return postProcessScenarioModelScore({
    parsedScenario: {
      scenarioNumber,
      scenarioName: 'test',
      pillarScores: {
        mentalizing: 6,
        accountability: 6,
        repair: repairScore,
      },
      keyEvidence: {
        mentalizing: 'Level 2 — inference present.',
        accountability: 'Level 2 — some ownership.',
        repair: typeof repairScore === 'number' ? 'Model assigned a repair score.' : 'none',
      },
      pillarConfidence: {},
    },
    raw: '{}',
    scenarioNumber,
    scoringMessages: messages,
    scenarioUserTextPreNormalize: userText,
    frustrationSkipNullMarkers: {},
  });
}

describe('S1 repair after probe removal', () => {
  it('nulls repair when no probe and no spontaneous process', () => {
    const result = scoreScenario(
      1,
      [
        { role: 'assistant', content: 'What do you think is going on here?', scenarioNumber: 1 },
        { role: 'user', content: 'Emma felt dismissed because Ryan took the call.', scenarioNumber: 1 },
      ],
      3,
    );
    expect(result.pillarScores?.repair).toBeNull();
    expect(result.keyEvidence?.repair).toBe(NO_ASSESSABLE_REPAIR_EVIDENCE_FROM_SCENARIO);
  });

  it('scores spontaneous repair when no probe was asked', () => {
    const result = scoreScenario(
      1,
      [
        { role: 'assistant', content: 'What do you think is going on here?', scenarioNumber: 1 },
        {
          role: 'user',
          content: 'If I were Ryan I would apologize and follow through so this will not happen again.',
          scenarioNumber: 1,
        },
      ],
      7,
    );
    expect(result.pillarScores?.repair).toBe(7);
    expect(result.scoringMetadata?.repair_evidence_source).toBe('spontaneous');
  });

  it('scores normally when a historical repair-as-Ryan probe is in the transcript', () => {
    const result = scoreScenario(
      1,
      [
        { role: 'assistant', content: 'If you were Ryan, how would you repair this?', scenarioNumber: 1 },
        { role: 'user', content: 'I would say sorry and listen.', scenarioNumber: 1 },
      ],
      4,
    );
    expect(result.pillarScores?.repair).toBe(4);
    expect(result.scoringMetadata?.repair_evidence_source).toBe('prompted');
  });
});

describe('S2 repair after probe removal', () => {
  it('keeps the dedicated James repair probe retired', () => {
    expect(INTERVIEW_CANONICAL_PROBES.s2_james_repair.retired).toBe(true);
  });

  it('nulls repair when no probe and no spontaneous process', () => {
    const result = scoreScenario(
      2,
      [
        { role: 'assistant', content: 'What do you think is going on here?', scenarioNumber: 2 },
        { role: 'user', content: 'James jumped to logistics instead of celebrating Sarah.', scenarioNumber: 2 },
      ],
      2,
    );
    expect(result.pillarScores?.repair).toBeNull();
  });

  it('does not treat appreciation-only content as spontaneous repair', () => {
    expect(
      looksLikeMeaningfulSpontaneousRepairContent(
        'James should have told Sarah she was doing a great job and appreciated her more.',
      ),
    ).toBe(false);
    const result = scoreScenario(
      2,
      [
        { role: 'assistant', content: 'What could James have done differently?', scenarioNumber: 2 },
        {
          role: 'user',
          content: 'James should have told Sarah she was doing a great job and appreciated her more.',
          scenarioNumber: 2,
        },
      ],
      3,
    );
    expect(result.pillarScores?.repair).toBeNull();
  });
});

describe('S1 hypothetical repair', () => {
  it('keeps the canonical S1 repair probe active and retires S3 repair', () => {
    expect(INTERVIEW_CANONICAL_PROBES.s1_repair.retired).toBeUndefined();
    expect(INTERVIEW_CANONICAL_PROBES.s1_repair.verbatimText).toBe(
      'If you were Ryan, how would you repair this?',
    );
    expect(INTERVIEW_CANONICAL_PROBES.s3_repair.retired).toBe(true);
  });

  it('feeds hypothetical_repair from Scenario 1, not Scenario 3', () => {
    const sources = extractRepairSourceSignals([
      labeled('scenario_1', { repair: 8 }, { repair: 'prompted: I would own the call and ask Emma to sit back down.' }),
      labeled('scenario_3', { repair: 5 }, { repair: 'volunteered a pattern comment' }),
    ]);
    expect(sources.version).toBe('repair_sources_v3_s1_hypothetical_2026_09');
    expect(sources.hypothetical_repair).toBe(8);
    expect(sources.contributor_moments.hypothetical_repair).toEqual(['scenario_1']);
    expect(sources.spontaneous_repair).toBe(5);
    expect(sources.autobiographical_repair).toBeNull();
  });

  it('keeps a stored v2 mapping on Scenario 3 and does not backfill Scenario 1', () => {
    const historical = extractRepairSourceSignals(
      [
        labeled('scenario_3', { repair: 8 }, { repair: 'old prompted sophie repair' }),
        labeled('scenario_1', { repair: null }, { repair: 'no assessable repair evidence' }),
      ],
      'repair_sources_v2_2026_08',
    );
    expect(historical.version).toBe('repair_sources_v2_2026_08');
    expect(historical.hypothetical_repair).toBe(8);
    expect(historical.contributor_moments.hypothetical_repair).toEqual(['scenario_3']);
    expect(historical.spontaneous_scenario_1).toBeNull();
  });
});

describe('M5 autobiographical repair', () => {
  it('feeds autobiographical_repair from concrete Moment 5 resolution', () => {
    const sources = extractRepairSourceSignals([
      labeled(
        'moment_5',
        { repair: 7 },
        { repair: 'We sat down after the fight, I apologized, and we talked it through.' },
      ),
    ]);
    expect(sources.autobiographical_repair).toBe(7);
    expect(sources.hypothetical_repair).toBeNull();
  });

  it('does not treat skip/non-answer as an observed poor repair score', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_3', { repair: 8 }, { repair: 's3' }),
      labeled('moment_5', { repair: 3 }, { repair: SKIPPED_BY_USER_FRUSTRATION_EVIDENCE }),
    ]);
    expect(scores.repair).toBe(8);
    const sources = extractRepairSourceSignals([
      labeled('moment_5', { repair: 3 }, { repair: SKIPPED_BY_USER_FRUSTRATION_EVIDENCE }),
    ]);
    expect(sources.autobiographical_repair).toBeNull();
  });
});

describe('Repair rollup', () => {
  it('ignores missing sources, uses assessable ones, and does not penalize disagreement', () => {
    const rows = [
      labeled('scenario_1', { repair: null }, { repair: NO_ASSESSABLE_REPAIR_EVIDENCE_FROM_SCENARIO }),
      labeled('scenario_2', { repair: null }, { repair: NO_ASSESSABLE_REPAIR_EVIDENCE_FROM_SCENARIO }),
      labeled('scenario_3', { repair: 8 }, { repair: 'hypothetical' }),
      labeled('moment_5', { repair: 4 }, { repair: 'autobiographical' }),
    ];
    const { scores } = aggregateMarkerScoresFromLabeledSlices(rows);
    expect(scores.repair).toBe(6);
    const sources = extractRepairSourceSignals(rows);
    expect(sources.hypothetical_repair).toBeNull();
    expect(sources.autobiographical_repair).toBe(4);
    expect(sources.spontaneous_repair).toBe(8);
    expect(sources.hypothetical_minus_autobiographical).toBeNull();
    expect(sources.no_divergence_penalty).toBe(true);
  });

  it('does not let absent S1/S2 spontaneous repair pull the pillar down', () => {
    const onlyS3 = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_3', { repair: 8 }, { repair: 's3' }),
    ]);
    const withNullS1S2 = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_1', { repair: 3 }, { repair: NO_ASSESSABLE_REPAIR_EVIDENCE_FROM_SCENARIO }),
      labeled('scenario_2', { repair: 3 }, { repair: NO_ASSESSABLE_REPAIR_EVIDENCE_FROM_SCENARIO }),
      labeled('scenario_3', { repair: 8 }, { repair: 's3' }),
    ]);
    expect(onlyS3.scores.repair).toBe(8);
    expect(withNullS1S2.scores.repair).toBe(8);
  });
});

describe('Regulation multi-source', () => {
  it('lets M5 regulation change the pillar while S3 stays fixed', () => {
    const s3Only = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_3', { regulation: 5 }, { regulation: 's3 unchanged' }),
    ]);
    const withM5 = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_3', { regulation: 5 }, { regulation: 's3 unchanged' }),
      labeled('moment_5', { regulation: 9 }, { regulation: 'm5 autobiographical regulation' }),
    ]);
    expect(s3Only.scores.regulation).toBe(5);
    expect(withM5.scores.regulation).toBe(7);
    const sources = extractRegulationSourceSignals([
      labeled('scenario_3', { regulation: 5 }, { regulation: 's3 unchanged' }),
      labeled('moment_5', { regulation: 9 }, { regulation: 'm5 autobiographical regulation' }),
    ]);
    expect(sources.scenario_3).toBe(5);
    expect(sources.moment_5).toBe(9);
    expect(sources.scenario_1).toBeNull();
  });

  it('lets support-moment regulation change the pillar while S3 stays fixed', () => {
    const withSupport = aggregateMarkerScoresFromLabeledSlices([
      labeled('scenario_3', { regulation: 5 }, { regulation: 's3 unchanged' }),
      labeled('moment_support', { regulation: 8 }, { regulation: 'stayed calm while supporting' }),
    ]);
    expect(withSupport.scores.regulation).toBe(7);
  });
});

describe('Null repair does not become a gate zero', () => {
  it('omits missing repair from the weighted score instead of treating it as 0', () => {
    const all = Object.fromEntries(INTERVIEW_MARKER_IDS.map((id) => [id, 7])) as Record<string, number>;
    const withRepair = computeGateResultCore(all);
    const { repair: _omit, ...withoutRepair } = all;
    const missingRepair = computeGateResultCore(withoutRepair);
    expect(missingRepair.weightedScore).not.toBeNull();
    expect(missingRepair.weightedScoreBreakdown?.pillars.repair.score).toBeNull();
    expect(missingRepair.weightedScoreBreakdown?.pillars.repair.contribution).toBe(0);
    expect(missingRepair.excludedMarkers).toContain('repair');
    const repairWeight = GATE_MARKER_BASE_WEIGHTS.repair;
    expect(withRepair.weightedScoreBreakdown?.pillars.repair.weight).toBe(repairWeight);
  });
});
