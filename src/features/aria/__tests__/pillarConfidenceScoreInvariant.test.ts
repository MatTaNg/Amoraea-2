import { describe, expect, it } from '@jest/globals';

import { applyElaborationAbsencePenaltiesToScenarioScores } from '../elaborationAbsencePenaltiesHeuristic';
import { MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE } from '../moment4ScoringParse';
import { fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote, prepareScenarioKeyEvidenceFromModelOutput } from '../scenarioScoringParse';

describe('pillarConfidence must not modify stored pillar scores', () => {
  const transcript =
    "Okay, I'm on Sophie's side at first, but Daniel was honest that he didn't know what to say, this is an incredibly uncomfortable situation for him, and avoiding those real conversations just creates more friction and distance.";

  it('applyElaborationAbsencePenalties preserves scores when keyEvidence is confidence-only', () => {
    const pillarScores = {
      mentalizing: 7,
      attunement: 7,
      repair: 6,
      accountability: 6,
      regulation: 6,
      contempt_expression: 8,
    };
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      3,
      transcript,
      { ...pillarScores },
      {
        mentalizing: 'moderate',
        attunement: 'moderate',
        repair: 'high',
        accountability: 'moderate',
        regulation: 'moderate',
        contempt_expression: 'high',
      },
      40,
    );
    expect(out.pillarScores.mentalizing).toBe(7);
    expect(out.pillarScores.attunement).toBe(7);
    expect(out.pillarScores.repair).toBe(6);
    expect(out.pillarScores.contempt_expression).toBe(8);
  });

  it('fillScenarioKeyEvidence replaces confidence-only keyEvidence with recovered line', () => {
    const transcript =
      "Emma felt dismissed. I would apologize and tell her she matters to me.";
    const parsed: {
      pillarScores: Record<string, number | null>;
      keyEvidence: Record<string, string>;
    } = {
      pillarScores: { mentalizing: 7, attunement: 6, repair: 8 },
      keyEvidence: { mentalizing: 'moderate', attunement: 'high', repair: 'moderate' },
    };
    fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote(
      ['mentalizing', 'attunement', 'repair'],
      parsed,
      transcript,
    );
    expect(parsed.keyEvidence.repair).toBe(MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE);
    expect(parsed.keyEvidence.mentalizing).toBe(MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE);
    expect(parsed.keyEvidence.attunement).toBe(MOMENT4_SCORE_RECOVERED_EVIDENCE_LINE);
  });

  it('prepareScenarioKeyEvidenceFromModelOutput prefers per-marker quotes from raw JSON', () => {
    const rawModelText = JSON.stringify({
      pillarScores: { mentalizing: 7, attunement: 6, repair: 8 },
      keyEvidence: {
        mentalizing: 'moderate',
        attunement: 'high',
        repair: 'User named the rupture and apologized for the impact.',
      },
    });
    const parsed: {
      pillarScores: Record<string, number | null>;
      keyEvidence: Record<string, string>;
      pillarConfidence: Record<string, string>;
    } = {
      pillarScores: { mentalizing: 7, attunement: 6, repair: 8 },
      keyEvidence: { mentalizing: 'moderate', attunement: 'high', repair: 'moderate' },
      pillarConfidence: {},
    };
    prepareScenarioKeyEvidenceFromModelOutput(
      ['mentalizing', 'attunement', 'repair'],
      parsed,
      "Emma felt dismissed. I would apologize and tell her she matters to me.",
      rawModelText,
    );
    expect(parsed.keyEvidence.repair).toBe('User named the rupture and apologized for the impact.');
    expect(parsed.pillarConfidence).toEqual({
      mentalizing: 'moderate',
      attunement: 'high',
      repair: 'moderate',
    });
    expect(parsed.keyEvidence.mentalizing).toBeUndefined();
    expect(parsed.keyEvidence.attunement).toBeUndefined();
  });

  it('prepareScenarioKeyEvidenceFromModelOutput migrates confidence leaks into pillarConfidence', () => {
    const parsed: {
      pillarScores: Record<string, number | null>;
      keyEvidence: Record<string, string>;
      pillarConfidence: Record<string, string>;
    } = {
      pillarScores: { mentalizing: 7, attunement: 6, repair: 8 },
      keyEvidence: { mentalizing: 'moderate', attunement: 'high', repair: 'moderate' },
      pillarConfidence: {},
    };
    prepareScenarioKeyEvidenceFromModelOutput(
      ['mentalizing', 'attunement', 'repair'],
      parsed,
      "Emma felt dismissed. I would apologize and tell her she matters to me.",
    );
    expect(parsed.pillarConfidence).toEqual({
      mentalizing: 'moderate',
      attunement: 'high',
      repair: 'moderate',
    });
    expect(parsed.keyEvidence.mentalizing).toBeUndefined();
    expect(parsed.keyEvidence.repair).toBeUndefined();
  });
});
