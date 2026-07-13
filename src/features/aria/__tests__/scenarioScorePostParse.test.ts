import { evaluateInterviewCompletionGate, pillarScoresHaveNumericAssessment } from '../interviewCompletionGate';
import {
  fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote,
  mergeSalvagedScenarioPillarScoresIntoParsed,
  normalizeScoresByEvidence,
} from '../probeAndScoringUtils';
import { postProcessScenarioScoreFromModelText } from '../scenarioScorePostParse';

describe('postProcessScenarioScoreFromModelText', () => {
  it('normalize keeps scores after fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote', () => {
    const parsed = {
      pillarScores: { mentalizing: 7, accountability: 6 },
      keyEvidence: {} as Record<string, string>,
    };
    fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote(
      ['mentalizing', 'accountability'],
      parsed,
      'Emma felt dismissed.',
    );
    const norm = normalizeScoresByEvidence(parsed.pillarScores, parsed.keyEvidence);
    expect(norm.mentalizing).toBe(7);
  });

  it('mergeSalvagedScenarioPillarScoresIntoParsed recovers from truncated JSON', () => {
    const raw =
      '{"pillarScores":{"mentalizing":8,"accountability":7,"contempt_recognition":6,"contempt_expression":5,"repair":7,"attunement":6}';
    const merged = mergeSalvagedScenarioPillarScoresIntoParsed(raw, ['mentalizing', 'accountability'], {});
    expect(merged.mentalizing).toBe(8);
  });

  it('keeps numeric scores when model JSON has pillarScores but no keyEvidence', () => {
    const parsed: Record<string, unknown> = {
      pillarScores: {
        mentalizing: 7,
        accountability: 6,
        contempt_recognition: 6,
        contempt_expression: 5,
        repair: 8,
        attunement: 7,
      },
    };
    const rawModelText = JSON.stringify(parsed);
    postProcessScenarioScoreFromModelText({
      scenarioNumber: 1,
      rawModelText,
      parsed,
      scoringMessages: [
        {
          role: 'user',
          content: 'Emma probably felt dismissed when Ryan interrupted her.',
          scenarioNumber: 1,
        },
      ],
    });
    expect(pillarScoresHaveNumericAssessment(parsed.pillarScores)).toBe(true);
    const gate = evaluateInterviewCompletionGate({
      scenario1: {
        scenarioNumber: 1,
        pillarScores: parsed.pillarScores,
        keyEvidence: parsed.keyEvidence,
      },
      scenario2: { pillarScores: { mentalizing: 7 } },
      scenario3: { pillarScores: { mentalizing: 7 } },
      moment4: { pillarScores: { mentalizing: 7 }, keyEvidence: { mentalizing: 'assessed' } },
    });
    expect(gate.ok).toBe(true);
  });

  it('salvages scores from truncated raw text when parsed JSON omitted numerics', () => {
    const parsed: Record<string, unknown> = { pillarScores: {}, keyEvidence: {} };
    const rawModelText =
      '{"pillarScores":{"mentalizing":8,"accountability":7,"contempt_recognition":6,"contempt_expression":5,"repair":7,"attunement":6}';
    postProcessScenarioScoreFromModelText({
      scenarioNumber: 1,
      rawModelText,
      parsed,
      scoringMessages: [{ role: 'user', content: 'She needed him to listen.', scenarioNumber: 1 }],
    });
    expect(pillarScoresHaveNumericAssessment(parsed.pillarScores)).toBe(true);
  });
});
