import { describe, expect, it } from '@jest/globals';
import { postProcessScenarioModelScore } from '../postProcessScenarioModelScore';
import {
  finalizeScenarioKeyEvidenceAfterHeuristics,
  fillScenarioKeyEvidenceWhenNumericScoreButMissingQuote,
  prepareScenarioKeyEvidenceFromModelOutput,
} from '../scenarioScoringParse';
import type { MessageWithScenario } from '../interviewScenarioScoringSlice';
import { userTurnTextForInterviewScenario } from '../contemptExpressionScenarioHeuristic';
import { pickMessagesForScenarioScoring } from '../interviewScenarioScoringSlice';

const MATT_S1_USER_TURNS: MessageWithScenario[] = [
  {
    role: 'user',
    content:
      'They have a difference in priorities. Ryan should be able to tell their family that they can call them back if they really liked Emma and wanted to spend time with her.',
    scenarioNumber: 1,
    interviewMoment: 1,
  },
  {
    role: 'user',
    content:
      "Emma's frustrated, I'm assuming she's referring to him always taking time, taking shared time that they were supposed to spend together to spend it with their family, which is family.",
    scenarioNumber: 1,
    interviewMoment: 1,
  },
  {
    role: 'user',
    content:
      "If I'm Ryan and I really liked Emma, I would assure her that this would not happen again and actually follow through.",
    scenarioNumber: 1,
    interviewMoment: 1,
  },
];

const OLD_RUN_S1_SCORES = {
  mentalizing: 6,
  attunement: 5,
  repair: 7,
  accountability: 7,
  appreciation: 5,
  contempt_expression: 8,
  contempt_recognition: 4,
};

function scoreScenario1WithConfidenceOnlyModel(
  scoringMessages: MessageWithScenario[],
  scenarioUserText: string,
) {
  const parsedScenario = {
    scenarioNumber: 1 as const,
    scenarioName: 'Scenario A (Emma/Ryan)',
    pillarScores: { ...OLD_RUN_S1_SCORES },
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
  const raw = JSON.stringify({
    pillarScores: OLD_RUN_S1_SCORES,
    keyEvidence: parsedScenario.keyEvidence,
  });
  return postProcessScenarioModelScore({
    parsedScenario,
    raw,
    scenarioNumber: 1,
    scoringMessages,
    scenarioUserTextPreNormalize: scenarioUserText,
    frustrationSkipNullMarkers: {},
  });
}

describe('postProcessScenarioModelScore Matt/Vaishnava S1 regression', () => {
  it('preserves old-run pillar scores when model returns confidence-only keyEvidence (tagged transcript)', () => {
    const scoringMessages: MessageWithScenario[] = [
      { role: 'assistant', content: "Here's the first situation: Emma and Ryan...", scenarioNumber: 1 },
      ...MATT_S1_USER_TURNS,
    ];
    const scenarioUserText = userTurnTextForInterviewScenario(scoringMessages, 1);
    expect(scenarioUserText.length).toBeGreaterThan(100);

    const result = scoreScenario1WithConfidenceOnlyModel(scoringMessages, scenarioUserText);
    expect(result.pillarScores?.mentalizing).toBe(6);
    expect(result.pillarScores?.repair).toBe(7);
    expect(result.pillarScores?.accountability).toBe(7);
    expect(result.keyEvidence?.mentalizing).toMatch(/^Level 2 —/);
  });

  it('preserves scores when scoring messages lack scenarioNumber tags (inferScenarioMessages fallback)', () => {
    const untaggedMessages = MATT_S1_USER_TURNS.map(({ role, content }) => ({ role, content }));
    const inferred = pickMessagesForScenarioScoring(
      [
        { role: 'assistant', content: "Here's the first situation:\n\nEmma and Ryan have dinner plans." },
        ...untaggedMessages,
      ],
      1,
    );
    const inferredUserText = inferred
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join(' ');
    expect(inferredUserText.length).toBeGreaterThan(100);

    const result = scoreScenario1WithConfidenceOnlyModel(untaggedMessages, inferredUserText);
    expect(result.pillarScores?.mentalizing).toBe(6);
    expect(result.pillarScores?.repair).toBe(7);
  });

  it('does not collapse scores when userTurnTextForInterviewScenario is empty (untagged messages bug)', () => {
    const untaggedMessages = MATT_S1_USER_TURNS.map(({ role, content }) => ({ role, content }));
    const emptySliceText = userTurnTextForInterviewScenario(untaggedMessages, 1);
    expect(emptySliceText.length).toBeGreaterThan(100);

    const result = scoreScenario1WithConfidenceOnlyModel(untaggedMessages, emptySliceText);
    expect(result.pillarScores?.mentalizing).toBe(6);
    expect(result.pillarScores?.repair).toBe(7);
  });

  it('does not cap mentalizing to 4 when model returns homogenized User quotes on all markers', () => {
    const ryanQuote =
      'User: "If I\'m Ryan and I really liked Emma, I would assure her that this would not happen again and actually follow through."';
    const scoringMessages: MessageWithScenario[] = [
      { role: 'assistant', content: "Here's the first situation: Emma and Ryan...", scenarioNumber: 1 },
      ...MATT_S1_USER_TURNS,
    ];
    const scenarioUserText = userTurnTextForInterviewScenario(scoringMessages, 1);
    const parsedScenario = {
      scenarioNumber: 1 as const,
      scenarioName: 'Scenario A (Emma/Ryan)',
      pillarScores: { ...OLD_RUN_S1_SCORES },
      keyEvidence: {
        mentalizing: ryanQuote,
        attunement: ryanQuote,
        repair: ryanQuote,
        accountability: ryanQuote,
        appreciation: ryanQuote,
        contempt_expression: ryanQuote,
        contempt_recognition: ryanQuote,
      },
      pillarConfidence: {},
    };
    const result = postProcessScenarioModelScore({
      parsedScenario,
      raw: JSON.stringify(parsedScenario),
      scenarioNumber: 1,
      scoringMessages,
      scenarioUserTextPreNormalize: scenarioUserText,
      frustrationSkipNullMarkers: {},
    });
    expect(result.pillarScores?.mentalizing).toBe(6);
    expect(result.pillarScores?.repair).toBe(7);
  });

  it('preserves old-run scores with Matt stored homogenized keyEvidence pattern', () => {
    const emmaQuote =
      'Level 2 — User: "Emma\'s frustrated, I\'m assuming she\'s referring to him always taking time, taking shared time that they were supposed to spend together to spend it with their family, which is family."';
    const ryanQuote =
      'User: "If I\'m Ryan and I really liked Emma, I would assure her that this would not happen again and actually follow through."';
    const scoringMessages: MessageWithScenario[] = [
      { role: 'assistant', content: "Here's the first situation: Emma and Ryan...", scenarioNumber: 1 },
      ...MATT_S1_USER_TURNS,
    ];
    const scenarioUserText = userTurnTextForInterviewScenario(scoringMessages, 1);
    const parsedScenario = {
      scenarioNumber: 1 as const,
      scenarioName: 'Scenario A (Emma/Ryan)',
      pillarScores: { ...OLD_RUN_S1_SCORES },
      keyEvidence: {
        mentalizing: emmaQuote,
        attunement: emmaQuote,
        repair: ryanQuote,
        accountability: ryanQuote,
        appreciation: ryanQuote,
        contempt_expression: ryanQuote,
        contempt_recognition: ryanQuote,
      },
      pillarConfidence: {},
    };
    const result = postProcessScenarioModelScore({
      parsedScenario,
      raw: JSON.stringify(parsedScenario),
      scenarioNumber: 1,
      scoringMessages,
      scenarioUserTextPreNormalize: scenarioUserText,
      frustrationSkipNullMarkers: {},
    });
    expect(result.pillarScores?.mentalizing).toBe(6);
    expect(result.pillarScores?.attunement).toBe(5);
    expect(result.pillarScores?.repair).toBe(7);
    expect(result.pillarScores?.accountability).toBe(7);
  });
});