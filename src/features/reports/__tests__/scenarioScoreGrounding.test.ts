import { describe, expect, it } from '@jest/globals';
import {
  allowedScenarioLanguageForScore,
  buildScenarioScoreGroundingContextBlock,
  buildScenarioScoreGroundingFromAttemptRows,
  crossrefCitesScoreGrounding,
  detectScenarioScoreInflation,
  narrativeBandForScore,
} from '../scenarioScoreGrounding';

describe('scenarioScoreGrounding', () => {
  it('maps score bands to allowed narrative language', () => {
    expect(narrativeBandForScore(5)).toContain('moderate');
    expect(narrativeBandForScore(7)).toContain('good');
    expect(allowedScenarioLanguageForScore(5)).toMatch(/NOT .strong/i);
    expect(allowedScenarioLanguageForScore(7)).toMatch(/strong/i);
  });

  it('builds grounding from attempt scenario slices', () => {
    const grounding = buildScenarioScoreGroundingFromAttemptRows({
      scenario_1_scores: {
        pillarScores: { mentalizing: 5, attunement: 5 },
        keyEvidence: { mentalizing: 'Level 1 — surface read of withdrawal' },
      },
      scenario_2_scores: {
        pillarScores: { mentalizing: 6, attunement: 6 },
        keyEvidence: { mentalizing: 'Level 1 — partial attribution' },
      },
      scenario_3_scores: {
        pillarScores: { mentalizing: 7, attunement: 7 },
        keyEvidence: { mentalizing: 'Level 2 — named emotional driver' },
      },
      scenario_specific_patterns: {
        moment_4_scores: {
          pillarScores: { mentalizing: 4 },
          keyEvidence: { mentalizing: 'Thin self-reflection' },
        },
      },
    });
    expect(grounding?.maxScenarioMentalizing).toEqual({
      scenarioLabel: 'Scenario 3 (Sophie/Daniel)',
      score: 7,
    });
    const block = buildScenarioScoreGroundingContextBlock(grounding!);
    expect(block).toContain('LANGUAGE RULE');
    expect(block).toContain('Scenario 1');
    expect(block).toContain('Level 1');
  });

  it('flags superlative inflation when scenario scores are below 7', () => {
    const grounding = buildScenarioScoreGroundingFromAttemptRows({
      scenario_1_scores: { pillarScores: { mentalizing: 5 } },
      scenario_2_scores: { pillarScores: { mentalizing: 6 } },
      scenario_3_scores: { pillarScores: { mentalizing: 7 } },
    });
    const issues = detectScenarioScoreInflation(
      'In every scenario you engaged with, you demonstrated strong, accurate empathy.',
      grounding,
    );
    expect(issues.length).toBeGreaterThan(0);
    expect(issues[0]).toMatch(/inflation/i);
  });

  it('requires crossref to cite scenario and evidence when grounding exists', () => {
    const grounding = buildScenarioScoreGroundingFromAttemptRows({
      scenario_3_scores: {
        pillarScores: { mentalizing: 7 },
        keyEvidence: { mentalizing: 'Named Sophie shutting down' },
      },
    });
    expect(
      crossrefCitesScoreGrounding(
        'Scenario C mirrors M4 withdrawal without scores or evidence.',
        grounding,
      ),
    ).toBe(false);
    expect(
      crossrefCitesScoreGrounding(
        'Scenario 3 at 7 — "Named Sophie shutting down" — mirrors M4 where you pulled back.',
        grounding,
      ),
    ).toBe(true);
  });
});
