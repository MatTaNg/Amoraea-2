import { describe, expect, it } from '@jest/globals';
import { MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE } from '../moment4ScoringParse';
import { applyElaborationAbsencePenaltiesToScenarioScores } from '../elaborationAbsencePenaltiesHeuristic';
import {
  coerceScenarioScoreParsedModelRecord,
  finalizeScenarioKeyEvidenceAfterHeuristics,
  parseScenarioScoreJsonFromModelText,
  prepareScenarioKeyEvidenceFromModelOutput,
  scenarioScoreRecoveryStats,
  unwrapScenarioScorePayloadRoot,
} from '../scenarioScoringParse';

const VAISHNAVA_S1_USER_TEXT =
  "They have a difference in priorities. Ryan should be able to tell their family. That they will call them back. If they really liked Emma and wanted to spend time with her. Emma's frustrated. I'm assuming she's referring to him always taking time, taking shared time that they were supposed to spend together, to spend it with their family, with his family. If I'm Ryan and if I really liked Emma. I would assure her that this will not happen again and actually follow through.";

describe('parseScenarioScoreJsonFromModelText', () => {
  it('unwraps scorecard wrapper and keeps substantive keyEvidence', () => {
    const raw = `Here is the score:
{
  "scorecard": {
    "scenarioNumber": 1,
    "pillarScores": { "mentalizing": 7, "repair": 6 },
    "keyEvidence": {
      "mentalizing": "Level 2 — User infers Emma's frustration about shared time.",
      "repair": "Level 2 — Promised follow-through if in Ryan's shoes."
    }
  }
}`;
    const parsed = parseScenarioScoreJsonFromModelText(raw);
    expect((parsed.pillarScores as Record<string, number>).mentalizing).toBe(7);
    expect((parsed.keyEvidence as Record<string, string>).mentalizing).toContain('Level 2');
  });

  it('prefers the JSON object with more substantive keyEvidence over a shallow wrapper', () => {
    const raw = `{"note":"scratch"} {"pillarScores":{"mentalizing":8,"repair":7},"keyEvidence":{"mentalizing":"Level 2 — interior read.","repair":"Unprompted ownership before repair prompt."}}`;
    const parsed = parseScenarioScoreJsonFromModelText(raw);
    expect((parsed.pillarScores as Record<string, number>).mentalizing).toBe(8);
    expect((parsed.keyEvidence as Record<string, string>).repair).toContain('Unprompted');
  });
});

describe('unwrapScenarioScorePayloadRoot', () => {
  it('lifts nested scores object', () => {
    const unwrapped = unwrapScenarioScorePayloadRoot({
      scores: {
        pillar_scores: { mentalizing: 6 },
        key_evidence: { mentalizing: 'Named the rupture.' },
      },
    });
    const coerced = coerceScenarioScoreParsedModelRecord(unwrapped);
    expect(coerced.pillarScores.mentalizing).toBe(6);
    expect(coerced.keyEvidence.mentalizing).toContain('rupture');
  });
});

describe('prepareScenarioKeyEvidenceFromModelOutput scoringMetadata migration', () => {
  it('migrates evidence_level_basis into keyEvidence when model omitted top-level entries', () => {
    const result = {
      pillarScores: { mentalizing: 7, attunement: 6 },
      keyEvidence: {},
      scoringMetadata: {
        evidence_level_basis: {
          mentalizing: 'Full answer names Emma frustration about shared time.',
          attunement: 'Names emotional stakes across turns.',
        },
      },
    };
    prepareScenarioKeyEvidenceFromModelOutput(
      ['mentalizing', 'attunement'],
      result,
      VAISHNAVA_S1_USER_TEXT,
    );
    expect(result.keyEvidence.mentalizing).toContain('shared time');
    expect(result.keyEvidence.attunement).toContain('emotional stakes');
  });
});

describe('scenarioScoreRecoveryStats', () => {
  it('flags recovery path when a majority of markers use the placeholder', () => {
    const stats = scenarioScoreRecoveryStats(
      {
        pillarScores: { mentalizing: 7, repair: 6, attunement: 5 },
        keyEvidence: {
          mentalizing: MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE,
          repair: MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE,
          attunement: 'Level 2 — substantive evidence.',
        },
      },
      ['mentalizing', 'repair', 'attunement'],
    );
    expect(stats.usedRecoveryPath).toBe(true);
    expect(stats.recoveredMarkerCount).toBe(2);
  });
});

describe('prepareScenarioKeyEvidenceFromModelOutput', () => {
  it('does not backfill User quotes before heuristics run', () => {
    const result = {
      pillarScores: { mentalizing: 6, attunement: 5, repair: 7 },
      keyEvidence: { mentalizing: 'high', attunement: 'moderate', repair: 'high' },
      pillarConfidence: {},
    };
    prepareScenarioKeyEvidenceFromModelOutput(
      ['mentalizing', 'attunement', 'repair'],
      result,
      VAISHNAVA_S1_USER_TEXT,
    );
    expect(result.keyEvidence.mentalizing).toBeUndefined();
    expect(result.keyEvidence.attunement).toBeUndefined();
    expect(result.keyEvidence.repair).toBeUndefined();
  });

  it('strips quote-only model keyEvidence before heuristics run', () => {
    const result = {
      pillarScores: { mentalizing: 6, repair: 7 },
      keyEvidence: {
        mentalizing: 'User: "Emma felt dismissed."',
        repair:
          'User: "If I were Ryan, I would say, oh you\'re upset, let\'s talk about what we both need."',
      },
      pillarConfidence: {},
    };
    prepareScenarioKeyEvidenceFromModelOutput(
      ['mentalizing', 'repair'],
      result,
      VAISHNAVA_S1_USER_TEXT,
    );
    expect(result.keyEvidence.mentalizing).toBeUndefined();
    expect(result.keyEvidence.repair).toBeUndefined();
  });
});

describe('finalizeScenarioKeyEvidenceAfterHeuristics', () => {
  it('backfills recovered evidence line only after heuristics when still missing', () => {
    const result = {
      pillarScores: { mentalizing: 6, attunement: 5, repair: 7 },
      keyEvidence: {
        mentalizing: 'Level 2 — User infers shared-time pattern.',
        attunement: 'Level 1 — Emma is frustrated.',
        repair: 'high',
      },
      pillarConfidence: {},
    };
    finalizeScenarioKeyEvidenceAfterHeuristics(
      ['mentalizing', 'attunement', 'repair'],
      result,
      VAISHNAVA_S1_USER_TEXT,
    );
    expect(result.keyEvidence.mentalizing).toMatch(/^Level 2 —/);
    expect(result.keyEvidence.attunement).toMatch(/^Level 1 —/);
    expect(result.keyEvidence.repair).toBe(MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE);
  });
});

describe('scenario scoring pipeline ordering', () => {
  it('preserves model mentalizing/repair scores when keyEvidence is confidence-only (Vaishnava S1 pattern)', () => {
    const result = {
      pillarScores: {
        mentalizing: 6,
        attunement: 5,
        repair: 7,
        accountability: 7,
        appreciation: 5,
        contempt_expression: 8,
        contempt_recognition: 4,
      },
      keyEvidence: {
        mentalizing: 'high',
        attunement: 'moderate',
        repair: 'high',
        accountability: 'high',
        appreciation: 'moderate',
        contempt_expression: 'high',
        contempt_recognition: 'moderate',
      },
      pillarConfidence: {},
    };
    prepareScenarioKeyEvidenceFromModelOutput(
      [
        'mentalizing',
        'attunement',
        'repair',
        'accountability',
        'appreciation',
        'contempt_expression',
        'contempt_recognition',
      ],
      result,
      VAISHNAVA_S1_USER_TEXT,
    );
    const elabor = applyElaborationAbsencePenaltiesToScenarioScores(
      1,
      VAISHNAVA_S1_USER_TEXT,
      result.pillarScores ?? {},
      result.keyEvidence,
      35,
      { depthModifierThreshold: 20 },
    );
    result.pillarScores = elabor.pillarScores;
    result.keyEvidence = elabor.keyEvidence;
    finalizeScenarioKeyEvidenceAfterHeuristics(
      [
        'mentalizing',
        'attunement',
        'repair',
        'accountability',
        'appreciation',
        'contempt_expression',
        'contempt_recognition',
      ],
      result,
      VAISHNAVA_S1_USER_TEXT,
    );
    expect(result.pillarScores.mentalizing).toBe(6);
    expect(result.pillarScores.repair).toBe(7);
    expect(result.pillarScores.accountability).toBe(7);
    expect(result.keyEvidence.mentalizing).toMatch(/^Level 2 —/);
    expect(result.keyEvidence.repair).toBe(MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE);
  });
});
