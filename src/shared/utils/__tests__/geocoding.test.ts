import { describe, expect, it } from '@jest/globals';

import {
  formatPlaceLabelFromAddress,
  looksLikeRawCoordinates,
} from '@/shared/utils/geocoding';

describe('geocoding place labels', () => {
  it('looksLikeRawCoordinates detects coordinate strings', () => {
    expect(looksLikeRawCoordinates('41.8781, -87.6298')).toBe(true);
    expect(looksLikeRawCoordinates('Chicago, Illinois')).toBe(false);
  });

  it('formatPlaceLabelFromAddress prefers city and state', () => {
    expect(
      formatPlaceLabelFromAddress({
        city: 'Chicago',
        state: 'Illinois',
        country: 'United States',
      }),
    ).toBe('Chicago, Illinois');
  });

  it('formatPlaceLabelFromAddress falls back to city and country', () => {
    expect(
      formatPlaceLabelFromAddress({
        city: 'Paris',
        country: 'France',
      }),
    ).toBe('Paris, France');
  });
});
