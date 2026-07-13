import { describe, expect, it } from '@jest/globals';
import {
  applyElaborationAbsencePenaltiesMoment4,
  applyElaborationAbsencePenaltiesMoment5,
  applyElaborationAbsencePenaltiesToScenarioScores,
  computeAvgUserWordsPerTurnForInterviewMoment,
  computeAvgUserWordsPerTurnScenario,
  computeAvgUserWordsPerTurnPersonalSlice,
  countUserTurnsForScenario,
  scenarioDepthModifierThreshold,
} from '../elaborationAbsencePenaltiesHeuristic';

describe('computeAvgUserWordsPerTurnScenario', () => {
  it('averages user words for the given scenario number', () => {
    const messages = [
      { role: 'user', content: 'one two', scenarioNumber: 1 },
      { role: 'user', content: 'three four five', scenarioNumber: 1 },
    ] as const;
    expect(computeAvgUserWordsPerTurnScenario([...messages], 1)).toBe(2.5);
  });

  it('uses prompted follow-up threshold when a scenario has multiple user turns', () => {
    const messages = [
      { role: 'user', content: 'one two three four five six seven eight nine ten', scenarioNumber: 2 },
      { role: 'user', content: 'one two three four five six seven eight nine ten eleven', scenarioNumber: 2 },
    ] as const;
    expect(countUserTurnsForScenario([...messages], 2)).toBe(2);
    expect(scenarioDepthModifierThreshold(countUserTurnsForScenario([...messages], 2))).toBe(20);
  });
});

describe('applyElaborationAbsencePenaltiesToScenarioScores', () => {
  it('does not leak Level tag missing into keyEvidence when model omits prefix', () => {
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      1,
      'She feels upset because he keeps prioritizing work.',
      { mentalizing: 6, attunement: 6, repair: 6 },
      { mentalizing: 'high', attunement: 'User notes she is upset.' },
      40,
    );
    expect(out.keyEvidence.mentalizing).not.toMatch(/Level tag missing/i);
    expect(out.keyEvidence.attunement).not.toMatch(/Level tag missing/i);
    expect(out.keyEvidence.mentalizing).toMatch(/^Level [12] —/);
    expect(out.keyEvidence.attunement).toMatch(/^Level [12] —/);
    expect(out.depthModifierMeta.level_tag_qa?.length).toBeGreaterThan(0);
  });

  it('infers Level 1 and caps score when model omits tag and evidence is behavioral only', () => {
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      1,
      'He walked away and came back later.',
      { mentalizing: 8, attunement: 7, repair: 6 },
      { mentalizing: 'User describes what Daniel did.', attunement: 'She was upset.' },
      40,
    );
    expect(out.pillarScores.mentalizing).toBe(5);
    expect(out.pillarScores.attunement).toBe(5);
    expect(out.keyEvidence.mentalizing).toMatch(/^Level 1 —/);
    expect(out.keyEvidence.attunement).toMatch(/^Level 1 —/);
  });

  it('caps mentalizing at 5 for diagnostic label without internal-state language (Level 1)', () => {
    const text =
      'She is dismissive avoidant here — she walks away when he asks for time.';
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      1,
      text,
      { mentalizing: 9, attunement: 8, repair: 8 },
      {},
      40,
    );
    expect(out.pillarScores.mentalizing).toBe(5);
    expect(out.keyEvidence.mentalizing).toMatch(/Ceiling 5/i);
  });

  it('caps mentalizing and attunement at 5 when keyEvidence declares Level 1 but scores are too high', () => {
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      2,
      'She feels upset and he deflects.',
      {
        mentalizing: 8,
        attunement: 9,
        appreciation: 7,
      },
      {
        mentalizing: 'Level 1 — Mostly naming what happened on the page.',
        attunement: 'Level 1 — Says she is upset without stakes or meaning.',
      },
      40,
    );
    expect(out.pillarScores.mentalizing).toBe(5);
    expect(out.pillarScores.attunement).toBe(5);
    expect(out.keyEvidence.mentalizing).toMatch(/Declared Level 1/i);
  });

  it('does not cap scores when scoringMetadata marks the full answer as Level 2 despite a Level 1 display snippet', () => {
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      3,
      "Well at first it seems like he's just avoiding it, but later it sounds like he genuinely didn't know what to say and that kind of emotional confrontation is deeply uncomfortable for him, which is exactly why this creates more distance for Sophie.",
      {
        mentalizing: 7,
        attunement: 7,
        repair: 5,
      },
      {
        mentalizing: 'Level 1 — Okay, he walked away and came back later.',
        attunement: 'Level 1 — Sophie is upset.',
      },
      40,
      {
        scoringMetadata: {
          evidence_levels: { mentalizing: 2, attunement: 2 },
          evidence_level_basis: {
            mentalizing: "User later infers that he genuinely didn't know what to say and finds confrontation emotionally uncomfortable.",
            attunement: 'User later explains why the pattern creates distance and leaves Sophie in an incomplete emotional exchange.',
          },
        },
      },
    );
    expect(out.pillarScores.mentalizing).toBe(7);
    expect(out.pillarScores.attunement).toBe(7);
    expect(out.keyEvidence.mentalizing).toMatch(/^Level 2 —/);
    expect(out.keyEvidence.attunement).toMatch(/^Level 2 —/);
  });

  it('does not cap mentalizing when scoringMetadata says Level 1 but full transcript supports Level 2', () => {
    const transcript =
      "Okay, I'm on Sophie's side at first, but Daniel was honest that he didn't know what to say, this is an incredibly uncomfortable situation for him, and avoiding those real conversations just creates more friction and distance.";
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      3,
      transcript,
      { mentalizing: 7, attunement: 7, repair: 6 },
      {
        mentalizing: 'Level 1 — User sided with Sophie initially.',
        attunement: 'Level 1 — Sophie is upset.',
      },
      40,
      {
        scoringMetadata: {
          evidence_levels: { mentalizing: 1, attunement: 1 },
          evidence_level_basis: {
            mentalizing: 'Opening reaction only.',
            attunement: 'Opening reaction only.',
          },
        },
      },
    );
    expect(out.pillarScores.mentalizing).toBe(7);
    expect(out.pillarScores.attunement).toBe(7);
    expect(out.keyEvidence.mentalizing).toMatch(/^Level 2 —/);
    expect(out.keyEvidence.attunement).toMatch(/^Level 2 —/);
  });

  it('uses full-transcript holistic cues to infer Level 2 when the snippet is shallow but the answer later develops', () => {
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      3,
      "Okay, I'm on Sophie's side at first, but what stands out is that he genuinely didn't know what to say, this kind of emotional confrontation is really uncomfortable for him, and avoiding those real conversations just creates more friction and distance.",
      {
        mentalizing: 7,
        attunement: 7,
        repair: 5,
      },
      {
        mentalizing: "Okay, I'm on Sophie's side at first.",
        attunement: "Sophie is upset about the incomplete conversation.",
      },
      40,
    );
    expect(out.pillarScores.mentalizing).toBe(7);
    expect(out.pillarScores.attunement).toBe(7);
    expect(out.keyEvidence.mentalizing).toMatch(/^Level 2 —/);
    expect(out.keyEvidence.attunement).toMatch(/^Level 2 —/);
  });

  it('normalizes curly apostrophes before inferring holistic Level 2 from the full transcript', () => {
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      3,
      "Okay, I’m on Sophie’s side at first, but he genuinely didn’t know what to say, this is an incredibly uncomfortable situation for him, and avoiding those real conversations just creates more friction and distance.",
      {
        mentalizing: 7,
        attunement: 7,
        repair: 5,
      },
      {
        mentalizing: "Okay, I’m on Sophie’s side at first.",
        attunement: 'Sophie is upset.',
      },
      40,
    );
    expect(out.pillarScores.mentalizing).toBe(7);
    expect(out.pillarScores.attunement).toBe(7);
    expect(out.keyEvidence.mentalizing).toMatch(/^Level 2 —/);
    expect(out.keyEvidence.attunement).toMatch(/^Level 2 —/);
  });

  it('infers Level 2 from the full transcript even when model keyEvidence is confidence-only', () => {
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      3,
      "Okay, I'm on Sophie's side at first, but Daniel was honest that he didn't know what to say, this is an incredibly uncomfortable situation for him, and avoiding those real conversations just creates more friction and distance.",
      {
        mentalizing: 7,
        attunement: 7,
        repair: 5,
      },
      {
        mentalizing: 'high',
        attunement: 'moderate',
      },
      40,
    );
    expect(out.pillarScores.mentalizing).toBe(7);
    expect(out.pillarScores.attunement).toBe(7);
    expect(out.keyEvidence.mentalizing).toMatch(/^Level 2 —/);
    expect(out.keyEvidence.attunement).toMatch(/^Level 2 —/);
  });

  it('does not cap Vaishnava-like Scenario A scores when model returns confidence-only keyEvidence', () => {
    const transcript =
      "They have a difference in priorities. Ryan should be able to tell their family. That they will call them back. If they really liked Emma and wanted to spend time with her. Emma's frustrated. I'm assuming she's referring to him always taking time, taking shared time that they were supposed to spend together, to spend it with their family, with his family. If I'm Ryan and if I really liked Emma. I would assure her that this will not happen again and actually follow through.";
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      1,
      transcript,
      {
        mentalizing: 6,
        attunement: 5,
        repair: 7,
        accountability: 7,
      },
      {
        mentalizing: 'high',
        attunement: 'moderate',
        repair: 'high',
        accountability: 'high',
      },
      35,
      { depthModifierThreshold: 20 },
    );
    expect(out.pillarScores.mentalizing).toBe(6);
    expect(out.pillarScores.repair).toBe(7);
    expect(out.pillarScores.accountability).toBe(7);
    expect(out.keyEvidence.mentalizing).toMatch(/^Level 2 —/);
  });

  it('does not apply depth modifier when keyEvidence is confidence-only but transcript is substantive', () => {
    const transcript =
      "Emma felt dismissed and is questioning whether she matters in this relationship at all.";
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      1,
      transcript,
      { mentalizing: 7, attunement: 7, repair: 6 },
      { mentalizing: 'moderate', attunement: 'high', repair: 'moderate' },
      12,
    );
    expect(out.pillarScores.mentalizing).toBe(7);
    expect(out.pillarScores.attunement).toBe(7);
    expect(out.pillarScores.repair).toBe(6);
    expect(out.depthModifierMeta.depth_modifier_applied).toBe(false);
  });

  it('caps repair at 5 for compensatory line without emotional core', () => {
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      3,
      'I would make up the time somehow and hope that smooths things over.',
      { repair: 8, mentalizing: 5, attunement: 5 },
      { mentalizing: 'Level 2 — …', attunement: 'Level 2 — …', repair: 'Sounds constructive.' },
      40,
    );
    expect(out.pillarScores.repair).toBe(5);
    expect(out.keyEvidence.repair).toMatch(/Compensatory|scheduling/i);
  });

  it('applies −1 to mentalizing, attunement, repair when avg words are below the scenario threshold and evidence lacks assessable evidence', () => {
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      1,
      'short',
      { mentalizing: 5, attunement: 5, repair: 5, commitment_threshold: 5 },
      {},
      20,
    );
    expect(out.pillarScores.mentalizing).toBe(4);
    expect(out.pillarScores.attunement).toBe(4);
    expect(out.pillarScores.repair).toBe(4);
    expect(out.pillarScores.commitment_threshold).toBe(5);
    expect(out.keyEvidence.mentalizing).toMatch(
      /Response-depth modifier: short response with insufficient evidence for mentalizing/,
    );
    expect(out.depthModifierMeta.depth_modifier_applied).toBe(true);
  });

  it('does not apply scenario depth modifier when prompted follow-up average meets the 20-word threshold', () => {
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      1,
      'short',
      { mentalizing: 5, attunement: 5, repair: 5 },
      {},
      20,
      { depthModifierThreshold: 20 },
    );
    expect(out.pillarScores.mentalizing).toBe(5);
    expect(out.pillarScores.attunement).toBe(5);
    expect(out.pillarScores.repair).toBe(5);
    expect(out.depthModifierMeta.depth_modifier_applied).toBe(false);
  });

  it('does not apply depth modifier to markers with substantive keyEvidence despite low avg words', () => {
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      1,
      'x',
      { mentalizing: 7, attunement: 7, repair: 7 },
      {
        mentalizing: 'Level 2 — She wants to feel important and like a priority in his life.',
        attunement: 'Level 2 — She is reaching the limit of her patience in this relationship.',
        repair: 'Apologize and tell her what you are going to do next time to prevent this from happening again.',
      },
      12,
    );
    expect(out.pillarScores.mentalizing).toBe(7);
    expect(out.pillarScores.attunement).toBe(7);
    expect(out.pillarScores.repair).toBe(7);
    expect(out.keyEvidence.repair ?? '').not.toMatch(/Response-depth modifier/);
  });

  it('applies depth modifier only to markers whose keyEvidence indicates absence', () => {
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      2,
      'hi',
      { mentalizing: 6, attunement: 6, repair: 6 },
      {
        mentalizing: 'Level 2 — Infers internal need for significance.',
        attunement: 'Insufficient evidence — response too brief.',
        repair: 'Score recovered from model output.',
      },
      10,
    );
    expect(out.pillarScores.mentalizing).toBe(6);
    expect(out.pillarScores.attunement).toBe(5);
    expect(out.pillarScores.repair).toBe(5);
  });

  it('floors Level 2 mentalizing and attunement at 6 when model under-scores interior inference', () => {
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      1,
      "I'm assuming she's referring to him always taking shared time they were supposed to spend together to spend it with his family",
      { mentalizing: 4, attunement: 4, repair: 7 },
      {
        mentalizing:
          'Level 2 — Infers emotional meaning of shared-time pattern beyond scenario facts.',
        attunement:
          'Level 2 — Recognizes mismatch between what Emma needed emotionally and what she received.',
        repair: 'Concrete follow-through commitment.',
      },
      40,
    );
    expect(out.pillarScores.mentalizing).toBe(6);
    expect(out.pillarScores.attunement).toBe(6);
    expect(out.keyEvidence.mentalizing).toMatch(/Floor 6/i);
    expect(out.keyEvidence.attunement).toMatch(/Floor 6/i);
  });

  it('does not raise Level 1 scores via Level 2 floor', () => {
    const out = applyElaborationAbsencePenaltiesToScenarioScores(
      1,
      'Emma is frustrated',
      { mentalizing: 4, attunement: 4, repair: 5 },
      {
        mentalizing: 'Level 1 — Surface label only.',
        attunement: 'Level 1 — Names frustration without pattern.',
        repair: 'Apologize.',
      },
      40,
    );
    expect(out.pillarScores.mentalizing).toBe(4);
    expect(out.pillarScores.attunement).toBe(4);
    expect(out.keyEvidence.mentalizing ?? '').not.toMatch(/Floor 5/i);
  });
});

describe('applyElaborationAbsencePenaltiesMoment4', () => {
  it('nulls mentalizing and accountability when low specificity after probe', () => {
    const out = applyElaborationAbsencePenaltiesMoment4(
      { mentalizing: 8, accountability: 8 },
      {},
      { clientSpecificityFollowUpAsked: true, lowSpecificityAfterProbe: true },
      50,
    );
    expect(out.pillarScores.mentalizing).toBeNull();
    expect(out.pillarScores.accountability).toBeNull();
  });
});

describe('applyElaborationAbsencePenaltiesMoment5', () => {
  it('subtracts 1 from mentalizing and repair when depth is low (and stacks with logistics repair cap)', () => {
    const out = applyElaborationAbsencePenaltiesMoment5(
      'I would plan another date and turn our phones off.',
      { mentalizing: 6, repair: 6, regulation: 7 },
      {},
      19,
    );
    expect(out.pillarScores.mentalizing).toBe(5);
    expect(out.pillarScores.repair).toBe(4);
    expect(out.pillarScores.regulation).toBe(7);
  });

  it('does not apply Moment 5 depth modifier when avg words meets the 20-word threshold', () => {
    const out = applyElaborationAbsencePenaltiesMoment5(
      'I would plan another date and turn our phones off.',
      { mentalizing: 6, repair: 6, regulation: 7 },
      {},
      20,
    );
    expect(out.pillarScores.mentalizing).toBe(6);
    expect(out.pillarScores.repair).toBe(5);
    expect(out.pillarScores.regulation).toBe(7);
    expect(out.depthModifierMeta.depth_modifier_applied).toBe(false);
  });

  it('does not apply depth modifier when keyEvidence is substantive despite low avg words', () => {
    const out = applyElaborationAbsencePenaltiesMoment5(
      'ok',
      { mentalizing: 6, repair: 6 },
      {
        mentalizing: 'Level 2 — User infers partner fears being deprioritized.',
        repair: 'Acknowledges hurt and commits to checking in before accepting invites.',
      },
      10,
    );
    expect(out.pillarScores.mentalizing).toBe(6);
    expect(out.pillarScores.repair).toBe(6);
  });
});

describe('computeAvgUserWordsPerTurnPersonalSlice', () => {
  it('includes only user turns', () => {
    const slice = [
      { role: 'assistant', content: 'hello there friend' },
      { role: 'user', content: 'one two three' },
      { role: 'user', content: 'four' },
    ];
    expect(computeAvgUserWordsPerTurnPersonalSlice(slice)).toBe(2);
  });
});

describe('computeAvgUserWordsPerTurnForInterviewMoment', () => {
  it('recomputes Moment 5 average from tagged source transcript user turns only', () => {
    const transcript = [
      { role: 'user', content: 'one two', interviewMoment: 4 },
      { role: 'assistant', content: 'Moment 5 prompt', interviewMoment: 5 },
      { role: 'user', content: 'one two three four', interviewMoment: 5 },
      { role: 'user', content: 'one two three four five six', interviewMoment: 5 },
    ];
    expect(computeAvgUserWordsPerTurnForInterviewMoment(transcript, 5)).toBe(5);
  });
});
