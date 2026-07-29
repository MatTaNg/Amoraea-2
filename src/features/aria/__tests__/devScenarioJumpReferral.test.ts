import {
  DEV_SCENARIO_JUMP_EMAIL,
  isBareDevScenarioJumpReferralCode,
  isDevScenarioJumpEmail,
  parseDevScenarioJumpReferralCode,
} from '@features/aria/devScenarioJumpReferral';

describe('devScenarioJumpReferral', () => {
  it('accepts referral codes 1–4 only for the dev email', () => {
    for (const code of ['1', '2', '3', '4'] as const) {
      expect(parseDevScenarioJumpReferralCode(DEV_SCENARIO_JUMP_EMAIL, code)).toBe(Number(code));
      expect(parseDevScenarioJumpReferralCode('other@example.com', code)).toBeNull();
    }
  });

  it('rejects non-numeric or out-of-range codes even for the dev email', () => {
    expect(parseDevScenarioJumpReferralCode(DEV_SCENARIO_JUMP_EMAIL, '0')).toBeNull();
    expect(parseDevScenarioJumpReferralCode(DEV_SCENARIO_JUMP_EMAIL, '5')).toBeNull();
    expect(parseDevScenarioJumpReferralCode(DEV_SCENARIO_JUMP_EMAIL, '01')).toBeNull();
    expect(parseDevScenarioJumpReferralCode(DEV_SCENARIO_JUMP_EMAIL, 'MTRX-7K2P')).toBeNull();
  });

  it('normalizes email case for the dev gate', () => {
    expect(isDevScenarioJumpEmail('  MattAng5280@Gmail.COM ')).toBe(true);
    expect(parseDevScenarioJumpReferralCode('MattAng5280@Gmail.COM', '3')).toBe(3);
  });

  it('detects bare jump referral codes', () => {
    expect(isBareDevScenarioJumpReferralCode('2')).toBe(true);
    expect(isBareDevScenarioJumpReferralCode(' 4 ')).toBe(true);
    expect(isBareDevScenarioJumpReferralCode('12')).toBe(false);
  });
});
