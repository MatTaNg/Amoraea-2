import { buildScenarioScoringPrompt } from '../scenarioScoringPrompt';
import { FLOOR_AND_BONUS_SCORING_PHILOSOPHY } from '../holisticScoringPrompt';
import { SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS } from '../interviewScoringCalibration';

describe('buildScenarioScoringPrompt', () => {
  it('includes appreciation in Scenario A marker list and rubric', () => {
    const prompt = buildScenarioScoringPrompt(1, [
      { role: 'assistant', content: 'What if you were Ryan? How would you repair?', scenarioNumber: 1 },
      { role: 'user', content: 'I would apologize and tell her she matters to me.', scenarioNumber: 1 },
    ]);
    expect(prompt).toContain('"appreciation"');
    expect(prompt).toContain('SCENARIO A (Emma/Ryan) — APPRECIATION');
    expect(prompt).toContain('repair-as-Ryan');
  });

  it('does not add Scenario A appreciation rubric to Scenario B', () => {
    const prompt = buildScenarioScoringPrompt(2, [
      { role: 'assistant', content: 'What do you think is going on here?', scenarioNumber: 2 },
      { role: 'user', content: 'James missed her emotional need.', scenarioNumber: 2 },
    ]);
    expect(prompt).toContain('SCENARIO B (Sarah/James) — ATTUNEMENT, MENTALIZING & APPRECIATION');
    expect(prompt).not.toContain('SCENARIO A (Emma/Ryan) — APPRECIATION');
  });

  it('requires holistic evidence-level metadata based on the full scenario answer', () => {
    const prompt = buildScenarioScoringPrompt(3, [
      { role: 'assistant', content: 'What do you make of Daniel saying he did not know what to say?', scenarioNumber: 3 },
      { role: 'user', content: 'He might be overwhelmed at the emotional weight of it.', scenarioNumber: 3 },
    ]);
    expect(prompt).toContain("Do **not** base the level tag on the opening reaction alone");
    expect(prompt).toContain('scoringMetadata.evidence_levels.mentalizing');
    expect(prompt).toContain('scoringMetadata.evidence_level_basis.attunement');
  });

  it('states pillarConfidence is metadata only and must not change numeric scores', () => {
    const prompt = buildScenarioScoringPrompt(1, [
      { role: 'assistant', content: 'What do you think?', scenarioNumber: 1 },
      { role: 'user', content: 'Emma felt dismissed.', scenarioNumber: 1 },
    ]);
    expect(prompt).toContain('PILLAR CONFIDENCE IS METADATA ONLY');
    expect(prompt).toContain('must not change numeric scores');
    expect(prompt).not.toContain('reduced certainty');
  });

  it('requires distinct per-pillar analytical keyEvidence in scenario scoring output', () => {
    const prompt = buildScenarioScoringPrompt(2, [
      { role: 'assistant', content: 'What do you think?', scenarioNumber: 2 },
      { role: 'user', content: 'James missed her emotional need.', scenarioNumber: 2 },
    ]);
    expect(prompt).toContain('SCORING INSTRUCTIONS:');
    expect(prompt.indexOf('KEY EVIDENCE — ANALYTICAL NARRATIVE')).toBeLessThan(
      prompt.indexOf('OUTPUT CONTRACT (STRICT):'),
    );
    expect(prompt).toContain('KEY EVIDENCE — ANALYTICAL NARRATIVE');
    expect(prompt).toContain('scoring rationale');
    expect(prompt).toContain('KEY EVIDENCE — PER PILLAR');
    expect(prompt).toContain('distinct for every scored marker');
    expect(prompt).toContain('Never leave keyEvidence empty, quote-only');
    expect(prompt).not.toContain('quote or paraphrase the response that most informed the score');
    expect(prompt).toContain('Include **appreciation** keyEvidence in Scenario B');
  });

  it('embeds restored canonical 5/6/7 anchors and does not deflate concrete answers to 5–6', () => {
    const prompt = buildScenarioScoringPrompt(1, [
      { role: 'assistant', content: 'If you were Ryan, how would you repair?', scenarioNumber: 1 },
      {
        role: 'user',
        content: 'I would assure her that this will not happen again and actually follow through.',
        scenarioNumber: 1,
      },
    ]);
    expect(prompt).toContain('CANONICAL SCORE ANCHORS');
    expect(prompt).toContain('actually follow through');
    expect(prompt).not.toMatch(/complete answer deserving a score of 5/);
    expect(prompt).not.toContain('BONUS PRINCIPLE');
    expect(prompt).not.toMatch(
      /Score 7\+ only when repair addresses both behavioral and emotional core of the rupture unprompted/,
    );
  });

  it('Scenario B appreciation anchors score specific appreciation behavior at 7', () => {
    const prompt = buildScenarioScoringPrompt(2, [
      { role: 'assistant', content: 'What do you think James could have done differently?', scenarioNumber: 2 },
      {
        role: 'user',
        content: 'He should have just been happy for her and appreciated her efforts.',
        scenarioNumber: 2,
      },
    ]);
    expect(prompt).toContain('Appreciation score anchors');
    expect(prompt).toContain('just been happy for her and appreciated her efforts');
    expect(SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS).toContain('**7:**');
    expect(SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS).toContain('Attunement score anchors');
    expect(SCENARIO_B_ATTUNEMENT_APPRECIATION_ANCHORS).toContain('they needed X');
  });

  it('Scenario C attunement floor does not require bilateral volunteering for a 7', () => {
    const prompt = buildScenarioScoringPrompt(3, [
      { role: 'assistant', content: 'What do you make of that?', scenarioNumber: 3 },
      { role: 'user', content: 'Daniel was uncomfortable facing the emotional conversation.', scenarioNumber: 3 },
    ]);
    expect(prompt).toContain('Score **7** when the user clearly recognized Daniel');
    expect(prompt).not.toMatch(
      /Score 7\+ only when the user described the emotional experience of both characters/,
    );
  });

  it('maps Level 1/2 mentalizing and attunement to 3–5 / 6–7 bands with canonical anchors', () => {
    const prompt = buildScenarioScoringPrompt(1, [
      { role: 'assistant', content: 'What do you think is going on?', scenarioNumber: 1 },
      {
        role: 'user',
        content:
          "I'm assuming she's referring to him always taking shared time they were supposed to spend together to spend it with his family",
        scenarioNumber: 1,
      },
    ]);
    expect(prompt).toContain('Level 1 — Behavioral observation (mentalizing & attunement scores 3–5)');
    expect(prompt).toContain('Level 2 — Emotional-interior / meaning inference (mentalizing & attunement scores 6–7');
    expect(prompt).toContain('**Mentalizing 6:**');
    expect(prompt).toContain('**Attunement 5:**');
    expect(prompt).toContain('**never 3–5**');
  });

  it('includes Scenario B mentalizing and attunement Level 2 calibration anchors', () => {
    const prompt = buildScenarioScoringPrompt(2, [
      { role: 'assistant', content: 'What do you think is going on between Sarah and James?', scenarioNumber: 2 },
      {
        role: 'user',
        content: 'She needed him to celebrate with her, not jump into logistics.',
        scenarioNumber: 2,
      },
    ]);
    expect(prompt).toContain('CALIBRATION PRESERVATION (Scenario B — attunement & mentalizing)');
    expect(prompt).toContain('Mentalizing score anchors (Scenario B)');
    expect(prompt).toContain('emotional mismatch');
    expect(prompt).toContain('REFERENCE CALIBRATION (Scenario B — attunement, mentalizing & appreciation)');
  });

  it('Scenario C Q1 Level 2 deep interior anchors at 7 not only 7–8', () => {
    const prompt = buildScenarioScoringPrompt(3, [
      { role: 'assistant', content: 'What do you make of that?', scenarioNumber: 3 },
      {
        role: 'user',
        content:
          'Daniel felt genuinely at a loss about what to say next. He had some unresolved things that he wanted to say out loud but does not know how to say them.',
        scenarioNumber: 3,
      },
    ]);
    expect(prompt).toContain('Level 2 (scores **5–7** typical');
    expect(prompt).toContain('Deep interior');
    expect(prompt).toContain('→ **7**');
    expect(prompt).not.toContain('Level 2 (scores 7–8)');
  });
});

describe('FLOOR_AND_BONUS_SCORING_PHILOSOPHY', () => {
  it('restores original 5/6/7 anchors and removes bonus-deflation language', () => {
    expect(FLOOR_AND_BONUS_SCORING_PHILOSOPHY).toContain('CANONICAL SCORE ANCHORS');
    expect(FLOOR_AND_BONUS_SCORING_PHILOSOPHY).toContain('Score 7');
    expect(FLOOR_AND_BONUS_SCORING_PHILOSOPHY).toContain('Score 6');
    expect(FLOOR_AND_BONUS_SCORING_PHILOSOPHY).toContain('Score 5');
    expect(FLOOR_AND_BONUS_SCORING_PHILOSOPHY).toContain('actually follow through');
    expect(FLOOR_AND_BONUS_SCORING_PHILOSOPHY).not.toContain('BONUS PRINCIPLE');
    expect(FLOOR_AND_BONUS_SCORING_PHILOSOPHY).not.toMatch(/complete answer deserving a score of 5/);
    expect(FLOOR_AND_BONUS_SCORING_PHILOSOPHY).toContain('MARKER-SPECIFIC ANCHORS');
    expect(FLOOR_AND_BONUS_SCORING_PHILOSOPHY).toContain(
      'Consistently calm, analytical tone maintained across the full interview',
    );
    expect(FLOOR_AND_BONUS_SCORING_PHILOSOPHY).toContain(
      'Concrete behavioral commitment with clear intention to change',
    );
    expect(FLOOR_AND_BONUS_SCORING_PHILOSOPHY).toContain(
      'Explicit first-person ownership of the failure',
    );
  });
});

describe('GUARDRAIL 4 prompted hierarchy (via scenario prompt)', () => {
  it('does not force prompted demonstrations into a 5–8-only band that parks concrete answers at 5–6', () => {
    const prompt = buildScenarioScoringPrompt(1, [
      { role: 'assistant', content: 'If you were Ryan, how would you repair?', scenarioNumber: 1 },
      {
        role: 'user',
        content: 'I would assure her that this will not happen again and actually follow through.',
        scenarioNumber: 1,
      },
    ]);
    // Holistic prompt embeds GUARDRAIL 4; scenario prompt embeds FLOOR_AND_BONUS which must win.
    // Assert the deflating "complete answer = 5–6" bonus language is gone from shared philosophy.
    expect(FLOOR_AND_BONUS_SCORING_PHILOSOPHY).not.toMatch(/score range 5.?8 depending on quality/i);
  });
});
