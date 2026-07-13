import { describe, expect, it } from '@jest/globals';
import { buildScenarioScoringPrompt } from '../scenarioScoringPrompt';
import { applyElaborationAbsencePenaltiesToScenarioScores } from '../elaborationAbsencePenaltiesHeuristic';
import {
  aggregateMarkerScoresFromLabeledSlices,
  type LabeledMarkerSlice,
} from '../aggregateMarkerScoresFromSlices';
import { userTurnTextForInterviewScenario } from '../contemptExpressionScenarioHeuristic';
import type { MessageWithScenario } from '../interviewScenarioScoringSlice';

/** Shared scenario answers — pre-refactor attempt 21367f76 / post-refactor 4a06754a (Matt). */
const MELISSA_S2_USER_TURNS: MessageWithScenario[] = [
  {
    role: 'user',
    content:
      "I think that she wanted a different type of celebration and didn't express that. So James thought that he was celebrating with her by engaging and showing up in the present moment and asking questions, but it sounds like she wanted something different.",
    scenarioNumber: 2,
    interviewMoment: 2,
  },
  {
    role: 'user',
    content:
      'James could have asked Sarah how she wanted to celebrate, and they could have come up with a plan together that worked for both of them that evening.',
    scenarioNumber: 2,
    interviewMoment: 2,
  },
  {
    role: 'user',
    content:
      "Yeah, if I were James, I would say, I'm so sorry. I thought that that was a celebration, but really you might have wanted to go out for a drink or go out for dinner or go dancing for an hour. And instead I just asked you questions and I hear you, you didn't feel appreciated. So can we talk about what you might need and how you could express that in a moment next time?",
    scenarioNumber: 2,
    interviewMoment: 2,
  },
];

const MELISSA_S1_USER_TURNS: MessageWithScenario[] = [
  {
    role: 'user',
    content:
      "Yeah, it sounds like a painful pattern of the, you know, not communication of what's acceptable during time together. I would be hurt too if someone answered a phone call during a date. It's just not okay.",
    scenarioNumber: 1,
    interviewMoment: 1,
  },
  {
    role: 'user',
    content:
      "That feels like a snide comment and a reaction instead of a conversation, but this is what's okay with me and this is not, and kind of working through it as a team, as a couple.",
    scenarioNumber: 1,
    interviewMoment: 1,
  },
  {
    role: 'user',
    content:
      "If I were Ryan, I would say, ooh, I see you're upset. Let's talk about what we both need so that this situation doesn't repeat.",
    scenarioNumber: 1,
    interviewMoment: 1,
  },
];

const MELISSA_S3_USER_TURNS: MessageWithScenario[] = [
  {
    role: 'user',
    content:
      "Yeah, I make of it that he needs some help in knowing some tools and techniques to be guided through conversation or some help with emotional intelligence because it sounds like he's just really avoidant.",
    scenarioNumber: 3,
    interviewMoment: 3,
  },
  {
    role: 'user',
    content:
      'Just really a lot of hurt and rejection and abandonment. It would really suck to have someone keep living in a resolution.',
    scenarioNumber: 3,
    interviewMoment: 3,
  },
];

function labeled(
  moment: LabeledMarkerSlice['moment'],
  pillarScores: Record<string, number | null>,
  keyEvidence: Record<string, string>,
): LabeledMarkerSlice {
  return { moment, pillarScores, keyEvidence };
}

describe('Melissa/Matt scenario scoring regression (pre-refactor calibration)', () => {
  it('embeds S2 calibration preserving celebration mismatch without mandatory tears quote', () => {
    const prompt = buildScenarioScoringPrompt(2, MELISSA_S2_USER_TURNS);
    expect(prompt).toContain('Do not withhold 7 on attunement or mentalizing solely because the participant did not quote the "don\'t cry"');
    expect(prompt).toContain('you didn\'t feel appreciated');
    expect(prompt).toContain('Appreciation 7–8 on prompted repair');
  });

  it('does not cap pre-refactor S2 mentalizing/appreciation scores via post-process heuristics', () => {
    const msgs = [{ role: 'assistant', content: 'scenario', scenarioNumber: 2 }, ...MELISSA_S2_USER_TURNS];
    const text = userTurnTextForInterviewScenario(msgs, 2);
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      2,
      text,
      {
        mentalizing: 7,
        attunement: 7,
        appreciation: 8,
        repair: 8,
        accountability: 8,
        contempt_expression: 9,
      },
      {
        mentalizing:
          'Level 2 — User infers Sarah wanted a different celebration and James thought questions were celebrating.',
        attunement:
          'Level 2 — Names celebration mismatch between what Sarah needed and what James offered.',
        appreciation:
          "Prompted repair names concrete alternatives and acknowledges Sarah didn't feel appreciated.",
        repair: 'Prompted ownership and validation.',
        accountability: 'Prompted ownership.',
        contempt_expression: 'Respectful throughout.',
      },
      50,
    );
    expect(out.pillarScores.mentalizing).toBe(7);
    expect(out.pillarScores.attunement).toBe(7);
    expect(out.pillarScores.appreciation).toBe(8);
  });

  it('floors recovered S1/S3 mentalizing at 6 when Level 2 interior is present', () => {
    const s1Msgs = [{ role: 'assistant', content: 'scenario', scenarioNumber: 1 }, ...MELISSA_S1_USER_TURNS];
    const s1Text = userTurnTextForInterviewScenario(s1Msgs, 1);
    const s1 = applyElaborationAbsencePenaltiesToScenarioScores(
      1,
      s1Text,
      { mentalizing: 5, attunement: 5, appreciation: 5, repair: 6, accountability: 6 },
      {
        mentalizing: 'Score recovered from model output.',
        attunement: 'Score recovered from model output.',
        appreciation: 'Score recovered from model output.',
        repair: 'Score recovered from model output.',
        accountability: 'Score recovered from model output.',
      },
      40,
    );
    expect(s1.pillarScores.mentalizing).toBe(6);
    expect(s1.keyEvidence.mentalizing).toMatch(/^Level 2 —/);

    const s3Msgs = [{ role: 'assistant', content: 'scenario', scenarioNumber: 3 }, ...MELISSA_S3_USER_TURNS];
    const s3Text = userTurnTextForInterviewScenario(s3Msgs, 3);
    const s3 = applyElaborationAbsencePenaltiesToScenarioScores(
      3,
      s3Text,
      { mentalizing: 5, attunement: 6, repair: 6 },
      {
        mentalizing: 'Score recovered from model output.',
        attunement: 'Score recovered from model output.',
        repair: 'Score recovered from model output.',
      },
      30,
    );
    expect(s3.pillarScores.mentalizing).toBe(6);
  });

  it('rollup matches pre-refactor holistic targets when S2 scores are calibrated', () => {
    const { scores } = aggregateMarkerScoresFromLabeledSlices([
      labeled(
        'scenario_1',
        { mentalizing: 6, appreciation: 5 },
        {
          mentalizing: 'Level 2 — painful pattern and hurt at phone call during date.',
          appreciation: 'Score recovered from model output.',
        },
      ),
      labeled(
        'scenario_2',
        { mentalizing: 7, attunement: 7, appreciation: 8 },
        {
          mentalizing: 'Level 2 — celebration mismatch with bilateral read.',
          attunement: 'Level 2 — need mismatch named.',
          appreciation: "Repair validates Sarah didn't feel appreciated.",
        },
      ),
      labeled(
        'scenario_3',
        { mentalizing: 7 },
        {
          mentalizing: 'Level 2 — Daniel avoidant/uncertain; Sophie hurt and abandonment.',
        },
      ),
    ]);
    expect(scores.mentalizing).toBe(7);
    expect(scores.appreciation).toBe(8);
  });
});
