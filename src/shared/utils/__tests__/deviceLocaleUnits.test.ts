import { describe, expect, it } from '@jest/globals';
import { getLocaleRegion, prefersImperialUnits } from '../deviceLocaleUnits';

describe('deviceLocaleUnits', () => {
  it('detects imperial regions from locale tags', () => {
    expect(getLocaleRegion('en-US')).toBe('US');
    expect(prefersImperialUnits('en-US')).toBe(true);
    expect(prefersImperialUnits('en-LR')).toBe(true);
    expect(prefersImperialUnits('en-MM')).toBe(true);
  });

  it('defaults to metric for other regions', () => {
    expect(prefersImperialUnits('en-GB')).toBe(false);
    expect(prefersImperialUnits('fr-FR')).toBe(false);
  });
});
