import { describe, expect, it } from 'vitest';
import {
  applyElaborationAbsencePenaltiesMoment4,
  applyElaborationAbsencePenaltiesMoment5,
  applyElaborationAbsencePenaltiesToScenarioScores,
  computeAvgUserWordsPerTurnScenario,
  computeAvgUserWordsPerTurnPersonalSlice,
} from '../elaborationAbsencePenaltiesHeuristic';

describe('computeAvgUserWordsPerTurnScenario', () => {
  it('averages user words for the given scenario number', () => {
    const messages = [
      { role: 'user', content: 'one two', scenarioNumber: 1 },
      { role: 'user', content: 'three four five', scenarioNumber: 1 },
    ] as const;
    expect(computeAvgUserWordsPerTurnScenario([...messages], 1)).toBe(2.5);
  });
});

describe('applyElaborationAbsencePenaltiesToScenarioScores', () => {
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

  it('applies −1 to mentalizing, attunement, repair when avg words < 35 and keyEvidence lacks assessable evidence', () => {
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
});

describe('applyElaborationAbsencePenaltiesMoment4', () => {
  it('caps mentalizing and accountability when low specificity after probe', () => {
    const out = applyElaborationAbsencePenaltiesMoment4(
      { mentalizing: 8, accountability: 8 },
      {},
      { clientSpecificityFollowUpAsked: true, lowSpecificityAfterProbe: true },
      50,
    );
    expect(out.pillarScores.mentalizing).toBe(5);
    expect(out.pillarScores.accountability).toBe(4);
  });
});

describe('applyElaborationAbsencePenaltiesMoment5', () => {
  it('subtracts 1 from mentalizing and repair when depth is low (and stacks with logistics repair cap)', () => {
    const out = applyElaborationAbsencePenaltiesMoment5(
      'I would plan another date and turn our phones off.',
      { mentalizing: 6, repair: 6, regulation: 7 },
      {},
      20,
    );
    expect(out.pillarScores.mentalizing).toBe(5);
    expect(out.pillarScores.repair).toBe(4);
    expect(out.pillarScores.regulation).toBe(7);
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
