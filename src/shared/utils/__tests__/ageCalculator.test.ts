import {
  calculateAgeFromBirthdate,
  isBirthDateAllowedForMinimumAge,
  maxBirthYearForMinimumAge,
  maxSelectableDayForBirthYearMonth,
  maxSelectableMonthForBirthYear,
  MIN_USER_AGE,
} from '../ageCalculator';

describe('maxBirthYearForMinimumAge', () => {
  it('excludes a birth year until every date in that year yields age >= 18', () => {
    const june2025 = new Date(2025, 5, 10);
    expect(maxBirthYearForMinimumAge(MIN_USER_AGE, june2025)).toBe(2006);
  });

  it('allows the prior birth year once the latest allowed birth date moves into that year', () => {
    const june2026 = new Date(2026, 5, 10);
    expect(maxBirthYearForMinimumAge(MIN_USER_AGE, june2026)).toBe(2007);
  });
});

describe('birth date caps within a year', () => {
  const june2025 = new Date(2025, 5, 10);

  it('caps months in the latest allowed birth year', () => {
    expect(maxSelectableMonthForBirthYear(2007, MIN_USER_AGE, june2025)).toBe(6);
    expect(maxSelectableMonthForBirthYear(2006, MIN_USER_AGE, june2025)).toBe(12);
  });

  it('caps days in the latest allowed birth month', () => {
    expect(maxSelectableDayForBirthYearMonth(2007, 6, MIN_USER_AGE, june2025)).toBe(10);
    expect(maxSelectableDayForBirthYearMonth(2007, 5, MIN_USER_AGE, june2025)).toBe(31);
  });

  it('treats late 2007 dates as under 18 in mid-2025', () => {
    expect(isBirthDateAllowedForMinimumAge('2007-07-01', MIN_USER_AGE, june2025)).toBe(false);
    expect(isBirthDateAllowedForMinimumAge('2007-06-10', MIN_USER_AGE, june2025)).toBe(true);
  });
});

describe('calculateAgeFromBirthdate', () => {
  it('respects month and day within the year', () => {
    const today = new Date(2026, 5, 10);
    jest.useFakeTimers();
    jest.setSystemTime(today);
    expect(calculateAgeFromBirthdate('2008-01-01')).toBe(18);
    expect(calculateAgeFromBirthdate('2008-06-11')).toBe(17);
    jest.useRealTimers();
  });
});
