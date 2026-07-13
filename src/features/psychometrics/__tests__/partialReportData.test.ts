import type { PartialReportAttemptRow } from '../partialReportData';
import { buildPartialReportDataFromRows, fetchPartialReportDataForUser } from '../partialReportData';

describe('buildPartialReportDataFromRows', () => {
  it('falls back to scenario-bundle pillar average when pillar_scores is empty', () => {
    const attempt: PartialReportAttemptRow = {
      id: 'attempt-1',
      pillar_scores: {},
      scenario_1_scores: { pillarScores: { repair: 8, mentalizing: 7 } },
      scenario_2_scores: { pillarScores: { repair: 6, mentalizing: 9 } },
      scenario_3_scores: { pillarScores: { repair: 7, mentalizing: 8 } },
      weighted_score: 7.2,
      passed: true,
      final_gate_pass: true,
      gate_fail_reasons: [],
      defense_patterns: {},
      scenario_specific_patterns: {},
    };

    const data = buildPartialReportDataFromRows({ name: 'Test' }, attempt);
    expect(data.attempt?.pillarScores?.repair).toBe(7);
    expect(data.attempt?.pillarScores?.mentalizing).toBe(8);
    expect(data.attempt?.scenarioScoreGrounding).not.toBeNull();
  });

  it('returns null attempt when row is missing', () => {
    const data = buildPartialReportDataFromRows({ name: 'Test' }, null);
    expect(data.attempt).toBeNull();
    expect(data.user.name).toBe('Test');
  });
});

describe('fetchPartialReportDataForUser', () => {
  it('fetches user and latest completed attempt then assembles partial report data', async () => {
    const userRow = { name: 'Jordan', basic_info: null, email: 'j@example.com' };
    const attemptRow = {
      id: 'attempt-99',
      pillar_scores: { repair: 7, mentalizing: 8 },
      weighted_score: 7.1,
      passed: true,
      final_gate_pass: true,
      gate_fail_reasons: [],
      defense_patterns: {},
      scenario_specific_patterns: {},
    };

    const usersMaybeSingle = jest.fn().mockResolvedValue({ data: userRow });
    const attemptsMaybeSingle = jest.fn().mockResolvedValue({ data: attemptRow });

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'users') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({ maybeSingle: usersMaybeSingle }),
            }),
          };
        }
        if (table === 'interview_attempts') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                or: jest.fn().mockReturnValue({
                  not: jest.fn().mockReturnValue({
                    order: jest.fn().mockReturnValue({
                      limit: jest.fn().mockReturnValue({ maybeSingle: attemptsMaybeSingle }),
                    }),
                  }),
                }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table ${table}`);
      }),
    };

    const result = await fetchPartialReportDataForUser(supabase as never, 'user-1');

    expect(result.attemptId).toBe('attempt-99');
    expect(result.data.user.name).toBe('Jordan');
    expect(result.data.attempt?.pillarScores).toEqual({ repair: 7, mentalizing: 8 });
    expect(result.data.attempt?.finalGatePass).toBe(true);
  });
});
