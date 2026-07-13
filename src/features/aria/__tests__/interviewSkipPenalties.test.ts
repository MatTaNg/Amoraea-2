import { describe, expect, it } from '@jest/globals';

import { SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS } from '@features/aria/interviewSkipPenalties';

describe('interviewSkipPenalties', () => {
  it('SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS lists all scenario-one markers', () => {
    expect(SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS[1]).toEqual(
      expect.arrayContaining(['mentalizing', 'repair', 'appreciation']),
    );
    expect(SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS[2]).toContain('appreciation');
    expect(SCENARIO_FRUSTRATION_SKIP_NULL_MARKER_IDS[3]).toContain('regulation');
  });
});
