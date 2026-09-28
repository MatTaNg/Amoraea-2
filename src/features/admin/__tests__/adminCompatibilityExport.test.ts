import { describe, expect, it } from '@jest/globals';
import { buildAdminBatchMatchExportCsv } from '../adminCompatibilityExport';
import type { AdminBatchMatchResult } from '@features/compatibility/adminCompatibilityMatching';

function makePair(rank: number, score: number) {
  return {
    rank,
    userA: { id: 'a1', email: 'alice@test.com', phone: null, displayLabel: 'Alice' },
    userB: { id: 'b1', email: 'bob@test.com', phone: null, displayLabel: 'Bob' },
    result: {
      finalScore: score,
      subscores: {
        attachment: 0.8,
        values: 0.7,
        semantic: 0,
        concreteLifeFit: 0.8,
        lifeDomainImportanceAlignment: 0.7,
        finance: 0.6,
        interviewProcess: 0.65,
        dealbreakerMultiplier: 1,
        capacityA: 0.8,
        capacityB: 0.8,
      },
      breakdown: {
        attachment: 0.016,
        values: 0.04,
        lifeDomain: 0.147,
        concreteLifeFit: 0.4,
        semantic: 0,
        finance: 0.132,
        interviewProcess: 0,
        baseline: 0,
        capacityDiscount: 0,
        interviewDiscount: 1,
        adjustments: 0,
      },
      adjustments: [],
    },
    preDealbreakerScore: score,
    effectiveScore: score,
    dealbreakerFailed: false,
    dealbreakerReasons: [],
    insights: [],
  };
}

describe('adminCompatibilityExport', () => {
  it('exports matched pairs and all skip categories', () => {
    const result: AdminBatchMatchResult = {
      mode: 'all_pairs',
      pairs: [makePair(1, 0.82)],
      unmatched: [{ id: 'u3', email: 'carol@test.com', phone: null, displayLabel: 'Carol' }],
      notFound: ['missing@test.com'],
      profileIncomplete: ['fail@test.com'],
      duplicateIdentifiers: ['dup@test.com'],
    };

    const csv = buildAdminBatchMatchExportCsv(result);
    const lines = csv.split('\r\n');

    expect(lines[0]).toContain('Row type');
    expect(lines.some((line) => line.startsWith('matched_pair,'))).toBe(true);
    expect(lines.some((line) => line.startsWith('unmatched,'))).toBe(true);
    expect(lines.some((line) => line.startsWith('not_found,'))).toBe(true);
    expect(lines.some((line) => line.startsWith('profile_incomplete,'))).toBe(true);
    expect(lines.some((line) => line.startsWith('duplicate_skip,'))).toBe(true);
    expect(lines.find((line) => line.startsWith('matched_pair,'))).toContain('82');
  });

  it('includes anchor row for one-vs-list mode', () => {
    const result: AdminBatchMatchResult = {
      mode: 'one_vs_list',
      anchor: { id: 'anchor', email: 'anchor@test.com', phone: null, displayLabel: 'Anchor User' },
      pairs: [makePair(1, 0.91)],
      unmatched: [],
      notFound: [],
      profileIncomplete: [],
      duplicateIdentifiers: [],
    };

    const csv = buildAdminBatchMatchExportCsv(result);
    expect(csv).toContain('anchor,');
    expect(csv).toContain('ranked_match,');
    expect(csv).toContain('Anchor User');
  });
});
