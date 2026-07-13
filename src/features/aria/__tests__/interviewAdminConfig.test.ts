import { describe, expect, it } from '@jest/globals';

import {
  ADMIN_PASS_EMAIL,
  ADMIN_PASS_PHRASE,
  S1_CONTEMPT_FIX_VERSION,
} from '@features/aria/interviewAdminConfig';

describe('interviewAdminConfig', () => {
  it('exports stable admin pass and telemetry version constants', () => {
    expect(S1_CONTEMPT_FIX_VERSION).toBeGreaterThan(0);
    expect(ADMIN_PASS_EMAIL).toMatch(/@/);
    expect(ADMIN_PASS_PHRASE.length).toBeGreaterThan(4);
  });
});
