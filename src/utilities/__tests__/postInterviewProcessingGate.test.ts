import {
  POST_INTERVIEW_PROCESSING_MS,
  evaluateStandardPostInterviewReveal,
  standardPostInterviewRouteFromReveal,
} from '../postInterviewProcessingGate';

describe('evaluateStandardPostInterviewReveal', () => {
  const completedAt = '2026-01-01T12:00:00.000Z';
  const completedMs = new Date(completedAt).getTime();

  it('1: override true routes to pass immediately (ignores 48h and passed=false)', () => {
    const ev = evaluateStandardPostInterviewReveal(
      {
        completed_at: completedAt,
        override_status: true,
        passed: false,
      },
      completedMs + 1000,
    );
    expect(ev).toEqual({ kind: 'reveal_pass' });
    expect(standardPostInterviewRouteFromReveal(ev)).toBe('PostInterviewPassed');
  });

  it('1: override false routes to fail immediately (ignores 48h and passed=true)', () => {
    const ev = evaluateStandardPostInterviewReveal(
      {
        completed_at: completedAt,
        override_status: false,
        passed: true,
      },
      completedMs + 1000,
    );
    expect(ev).toEqual({ kind: 'reveal_fail' });
    expect(standardPostInterviewRouteFromReveal(ev)).toBe('PostInterviewFailed');
  });

  it('2: override null and inside 48h stays processing even if passed is true', () => {
    const ev = evaluateStandardPostInterviewReveal(
      {
        completed_at: completedAt,
        override_status: null,
        passed: true,
      },
      completedMs + POST_INTERVIEW_PROCESSING_MS - 1000,
    );
    expect(ev).toEqual({ kind: 'processing' });
    expect(standardPostInterviewRouteFromReveal(ev)).toBe('PostInterview');
  });

  it('3: override null and after 48h routes by passed', () => {
    const after = completedMs + POST_INTERVIEW_PROCESSING_MS + 1000;
    expect(
      evaluateStandardPostInterviewReveal(
        { completed_at: completedAt, override_status: null, passed: true },
        after,
      ),
    ).toEqual({ kind: 'reveal_pass' });
    expect(
      evaluateStandardPostInterviewReveal(
        { completed_at: completedAt, override_status: null, passed: false },
        after,
      ),
    ).toEqual({ kind: 'reveal_fail' });
  });

  it('after 48h with passed null stays processing', () => {
    const after = completedMs + POST_INTERVIEW_PROCESSING_MS + 1000;
    expect(
      evaluateStandardPostInterviewReveal(
        { completed_at: completedAt, override_status: null, passed: null },
        after,
      ),
    ).toEqual({ kind: 'processing' });
    expect(standardPostInterviewRouteFromReveal({ kind: 'processing' })).toBe('PostInterview');
  });

  it('null snapshot stays processing', () => {
    expect(evaluateStandardPostInterviewReveal(null)).toEqual({ kind: 'processing' });
    expect(evaluateStandardPostInterviewReveal(undefined)).toEqual({ kind: 'processing' });
  });
});
