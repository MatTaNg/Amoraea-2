import { describe, expect, it } from '@jest/globals';
import { hobbiesIdsToString, hobbiesStringToIds } from '@/shared/utils/hobbiesHelpers';

describe('hobbiesHelpers', () => {
  it('round-trips comma-separated hobby ids', () => {
    const ids = ['running', 'reading', 'international_solo_travel'];
    expect(hobbiesStringToIds(hobbiesIdsToString(ids))).toEqual(ids);
  });

  it('drops unknown ids and dedupes', () => {
    expect(hobbiesStringToIds('running,unknown,running,reading_fiction')).toEqual([
      'running',
      'reading',
    ]);
    expect(hobbiesIdsToString(['running', 'running', 'unknown', 'cooking'])).toBe(
      'running,cooking',
    );
  });

  it('normalizes legacy hobby ids to current equivalents', () => {
    expect(hobbiesStringToIds('gym,reading,travel')).toEqual([
      'weightlifting',
      'reading',
      'international_solo_travel',
    ]);
    expect(hobbiesIdsToString(['gym', 'gaming'])).toBe('weightlifting,video_games');
    expect(hobbiesStringToIds('nightlife,entrepreneurship')).toEqual([
      'hosting_dinner_parties_game_nights',
      'coding_side_projects',
    ]);
  });

  it('keeps legacy-only ids that have no alias', () => {
    expect(hobbiesStringToIds('parenting')).toEqual(['parenting']);
  });

  it('returns empty for blank storage', () => {
    expect(hobbiesStringToIds('')).toEqual([]);
    expect(hobbiesStringToIds(undefined)).toEqual([]);
    expect(hobbiesIdsToString([])).toBe('');
  });
});
