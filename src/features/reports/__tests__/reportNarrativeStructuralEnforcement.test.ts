import {
  crossrefHasRealContent,
  crossrefWovenIntoNarrative,
  parseStructuralNarrativeFields,
  stripStructuralNarrativeBlock,
  validateAiReasoningStructuralEnforcement,
  validateMarkdownStructuralEnforcement,
  STRUCTURAL_NARRATIVE_BLOCK_END,
  STRUCTURAL_NARRATIVE_BLOCK_START,
} from '../reportNarrativeStructuralEnforcement';

describe('reportNarrativeStructuralEnforcement', () => {
  const sampleBlock = `${STRUCTURAL_NARRATIVE_BLOCK_START}
scenario_personal_pattern_crossref: Scenario C read of Sophie's avoidance — "she shuts down and withdraws" — mirrors your own experiential-avoidance pattern from M4 where you described pulling back from difficult conversations.
psychometric_integration: GASP/harm-response profile suggests repair-over-withdrawal tendency — woven into conflict recovery section in plain language.
${STRUCTURAL_NARRATIVE_BLOCK_END}

## Overview
You show strong other-directed reads in scenarios.

## Your Relational Strengths
### Reading Others in Fiction
In Scenario C you named Sophie's withdrawal clearly — that same avoidance theme shows up when you describe pulling back from difficult conversations in your own account.

## Where You Have Room to Grow
### Turning Inward After Conflict
Your experiential-avoidance band suggests difficulty staying with painful feelings after rupture.`;

  it('parses and strips structural block', () => {
    const fields = parseStructuralNarrativeFields(sampleBlock);
    expect(fields?.scenario_personal_pattern_crossref).toMatch(/Scenario C/i);
    expect(fields?.psychometric_integration).toMatch(/GASP/i);
    const visible = stripStructuralNarrativeBlock(sampleBlock);
    expect(visible).not.toContain(STRUCTURAL_NARRATIVE_BLOCK_START);
    expect(visible).toMatch(/## Overview/);
  });

  it('validates woven crossref in visible markdown', () => {
    const result = validateMarkdownStructuralEnforcement(sampleBlock);
    expect(result.ok).toBe(true);
    expect(result.crossrefWovenIntoNarrative).toBe(true);
    expect(result.crossrefHasRealContent).toBe(true);
  });

  it('fails when crossref real content not woven into narrative', () => {
    const bad = `${STRUCTURAL_NARRATIVE_BLOCK_START}
scenario_personal_pattern_crossref: Scenario C read of Sophie's avoidance — "she shuts down and withdraws" — mirrors your own documented avoidance pattern from M4.
psychometric_integration: none applicable — no populated instruments beyond GASP, RSES, Dweck, RFQ.
${STRUCTURAL_NARRATIVE_BLOCK_END}

## Overview
Generic overview with no scenario or avoidance language at all.`;
    const result = validateMarkdownStructuralEnforcement(bad);
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes('key terms'))).toBe(true);
  });

  it('accepts explicit no-crossref statement without weave requirement', () => {
    const na = `${STRUCTURAL_NARRATIVE_BLOCK_START}
scenario_personal_pattern_crossref: No meaningful scenario/personal crossref — scenarios were analytically strong and personal account was concrete conflict narrative, no shared avoidance theme.
psychometric_integration: none applicable — no populated instruments beyond AAQ-II.
${STRUCTURAL_NARRATIVE_BLOCK_END}

## Overview
You demonstrated depth in scenarios.`;
    const result = validateMarkdownStructuralEnforcement(na);
    expect(result.ok).toBe(true);
    expect(crossrefHasRealContent(na)).toBe(false);
  });

  it('fails psychometric N/A when non-AAQ2 instruments are populated', () => {
    const markdown = `${STRUCTURAL_NARRATIVE_BLOCK_START}
scenario_personal_pattern_crossref: Scenario 2 at moderate band — "she withdraws when criticized" — mirrors M5 where you described going quiet after conflict.
psychometric_integration: none applicable — no populated instruments beyond GASP, RSES.
${STRUCTURAL_NARRATIVE_BLOCK_END}

## Overview
You tend to withdraw when criticized, matching your scenario read of Sarah.

## Your Relational Strengths
### Reading Withdrawal in Others
In Scenario 2 you named Sarah's shutdown — the same pattern appears when you go quiet after conflict in M5.

## Where You Have Room to Grow
### Staying Present Under Criticism
Your harm-response lens suggests repair over confrontation when hurt.`;
    const result = validateMarkdownStructuralEnforcement(markdown, {
      requirePsychometricIntegration: true,
      populatedNonAaq2InstrumentLabels: ['GASP/harm-response', 'RSES/self-esteem'],
    });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes('psychometric_integration'))).toBe(true);
  });

  it('flags scenario score inflation in visible narrative', () => {
    const inflated = `${STRUCTURAL_NARRATIVE_BLOCK_START}
scenario_personal_pattern_crossref: Scenario 3 at 7 — "she shuts down" — mirrors M4 withdrawal pattern.
psychometric_integration: none applicable — no populated instruments beyond AAQ-II.
${STRUCTURAL_NARRATIVE_BLOCK_END}

## Overview
In every scenario you demonstrated strong, accurate empathy.

## Your Relational Strengths
### Empathy in Fiction
You read others with real precision across scenarios.`;
    const grounding = {
      slices: [
        {
          scenarioLabel: 'Scenario 1',
          mentalizing: 5,
          attunement: 5,
          mentalizingKeyEvidence: null,
          attunementKeyEvidence: null,
        },
        {
          scenarioLabel: 'Scenario 2',
          mentalizing: 6,
          attunement: 6,
          mentalizingKeyEvidence: null,
          attunementKeyEvidence: null,
        },
        {
          scenarioLabel: 'Scenario 3',
          mentalizing: 7,
          attunement: 7,
          mentalizingKeyEvidence: null,
          attunementKeyEvidence: null,
        },
      ],
      moment4Mentalizing: 4,
      moment4KeyEvidence: null,
      moment5Mentalizing: null,
      moment5KeyEvidence: null,
      maxScenarioMentalizing: { scenarioLabel: 'Scenario 3', score: 7 },
    };
    const result = validateMarkdownStructuralEnforcement(inflated, { scenarioScoreGrounding: grounding });
    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.includes('inflation'))).toBe(true);
  });

  it('validates ai_reasoning JSON structural fields', () => {
    const reasoning = {
      overall_summary:
        'In Scenario C you read avoidance in Sophie, and your M4 account shows the same withdrawal pattern when conversations get hard.',
      scenario_personal_pattern_crossref:
        'Scenario C read of Sophie\'s avoidance mirrors M4 withdrawal pattern in your own disclosure.',
      psychometric_integration:
        'none applicable — ai_reasoning payload has no populated psychometric instruments; available here: interview pillar scores and transcript only; full personal report carries GASP/RSES/Dweck/RFQ/etc.',
      overall_growth_areas: ['Grow self-directed curiosity'],
    };
    const result = validateAiReasoningStructuralEnforcement(reasoning);
    expect(result.ok).toBe(true);
    expect(crossrefWovenIntoNarrative(
      reasoning.scenario_personal_pattern_crossref,
      reasoning.overall_summary,
    )).toBe(true);
  });
});
