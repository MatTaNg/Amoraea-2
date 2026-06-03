import {
  anchorConstructBreakdownScores,
  ensureOverallGrowthAreas,
  prepareAIReasoningForPersistence,
  recoverFailedReasoningPayload,
  validateAndCorrectReasoningScores,
} from '../aiReasoningPostProcess';
import type { AIReasoningResult } from '../generateAIReasoning';

const pillarScores = {
  mentalizing: 7,
  accountability: 6,
  contempt: 5,
  repair: 6,
  regulation: 6,
  attunement: 6,
  appreciation: 6,
  commitment_threshold: 6,
};

describe('aiReasoningPostProcess', () => {
  it('corrects construct scores that diverge from computed pillar scores', () => {
    const reasoning: AIReasoningResult = {
      construct_breakdown: {
        mentalizing: { score: 9, growth_edge: 'Practice naming feelings earlier.' },
        accountability: { score: 6, growth_edge: 'Watch over-owning outcomes.' },
      },
    };
    anchorConstructBreakdownScores(reasoning, pillarScores);
    expect(reasoning.construct_breakdown?.mentalizing?.score).toBe(7);
    expect(reasoning.construct_breakdown?.accountability?.score).toBe(6);
  });

  it('synthesizes overall_growth_areas from pillar growth_edge when empty', () => {
    const reasoning: AIReasoningResult = {
      overall_growth_areas: [],
      construct_breakdown: {
        mentalizing: { score: 7, growth_edge: 'Slow down assumptions about intent.' },
        repair: { score: 6, growth_edge: 'Follow up after conflict sooner.' },
      },
    };
    ensureOverallGrowthAreas(reasoning, []);
    expect(reasoning.overall_growth_areas?.length).toBeGreaterThanOrEqual(2);
  });

  it('strips false failure flags when substantive summary exists', () => {
    const recovered = recoverFailedReasoningPayload({
      _generationFailed: true,
      _narrativeFailed: true,
      overall_summary: 'You showed thoughtful repair in Scenario A.',
      last_error: 'The signal has been aborted',
    });
    expect(recovered).not.toBeNull();
    expect(recovered?._generationFailed).toBeUndefined();
    expect(recovered?._narrativeFailed).toBeUndefined();
    expect(recovered?.overall_summary).toContain('repair');
  });

  it('validateAndCorrectReasoningScores fixes fabricated weighted score in prose', () => {
    const reasoning = {
      overall_summary: 'Your overall score of 7.5 suggests solid readiness.',
      construct_breakdown: { repair: { score: 6 } },
    };
    const { corrected, hadErrors } = validateAndCorrectReasoningScores(reasoning, 6.2, pillarScores);
    expect(hadErrors).toBe(true);
    expect(corrected.overall_summary).toContain('score of 6.2');
    expect(corrected.overall_summary).not.toContain('7.5');
  });

  it('prepareAIReasoningForPersistence applies score anchor and growth synthesis', () => {
    const out = prepareAIReasoningForPersistence(
      {
        overall_summary: 'Summary.',
        overall_growth_areas: [],
        construct_breakdown: {
          contempt: { score: 8, growth_edge: 'Soften character judgments under stress.' },
          repair: { score: 6, growth_edge: 'Name impact before proposing fixes.' },
        },
      },
      pillarScores,
      [],
      6.2
    );
    expect(out.contempt).toBeUndefined();
    expect((out.construct_breakdown as Record<string, { score: number }>).contempt.score).toBe(5);
    expect(Array.isArray(out.overall_growth_areas)).toBe(true);
    expect((out.overall_growth_areas as string[]).length).toBeGreaterThanOrEqual(2);
  });
});
