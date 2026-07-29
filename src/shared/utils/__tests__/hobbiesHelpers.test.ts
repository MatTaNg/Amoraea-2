import { describe, expect, it } from '@jest/globals';
import { hobbiesIdsToString, hobbiesStringToIds } from '@/shared/utils/hobbiesHelpers';

describe('hobbiesHelpers', () => {
  it('round-trips comma-separated hobby ids', () => {
    const ids = ['running', 'reading_fiction', 'international_travel'];
    expect(hobbiesStringToIds(hobbiesIdsToString(ids))).toEqual(ids);
  });

  it('drops unknown ids and dedupes', () => {
    expect(hobbiesStringToIds('running,unknown,running,reading_fiction')).toEqual([
      'running',
      'reading_fiction',
    ]);
    expect(hobbiesIdsToString(['running', 'running', 'unknown', 'cooking'])).toBe(
      'running,cooking',
    );
  });

  it('normalizes legacy hobby ids to current equivalents', () => {
    expect(hobbiesStringToIds('gym,reading,travel')).toEqual([
      'weightlifting',
      'reading_fiction',
      'international_travel',
    ]);
    expect(hobbiesIdsToString(['gym', 'gaming'])).toBe('weightlifting,video_games');
  });

  it('keeps legacy-only ids that have no alias', () => {
    expect(hobbiesStringToIds('nightlife,entrepreneurship')).toEqual([
      'nightlife',
      'entrepreneurship',
    ]);
  });

  it('returns empty for blank storage', () => {
    expect(hobbiesStringToIds('')).toEqual([]);
    expect(hobbiesStringToIds(undefined)).toEqual([]);
    expect(hobbiesIdsToString([])).toBe('');
  });
});
