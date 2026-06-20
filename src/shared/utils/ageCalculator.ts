/** Minimum age to use Amoraea (profile + onboarding). */
export const MIN_USER_AGE = 18;

export type DateParts = { y: number; m: number; d: number };

/** Expect YYYY-MM-DD */
export function parseBirthDateParts(isoDate: string): DateParts | null {
  const t = isoDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const y = Number(t.slice(0, 4));
  const m = Number(t.slice(5, 7));
  const d = Number(t.slice(8, 10));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  if (m < 1 || m > 12 || d < 1) return null;
  const maxD = daysInMonth(y, m);
  if (d > maxD) return null;
  return { y, m, d };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Expect YYYY-MM-DD */
export function calculateAgeFromBirthdate(isoDate: string): number {
  const p = parseBirthDateParts(isoDate);
  if (!p) return 0;
  const today = new Date();
  let age = today.getFullYear() - p.y;
  const monthDelta = today.getMonth() + 1 - p.m;
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < p.d)) age--;
  return Math.max(0, age);
}

/** Compare calendar dates (y,m,d); negative if a before b. */
export function compareDateParts(a: DateParts, b: DateParts): number {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.d - b.d;
}

/**
 * Latest birth date selectable today while still being at least `minAge`.
 * Born on this date → exactly `minAge` today; any later birth date is under `minAge`.
 */
export function latestAllowedBirthDateParts(
  minAge: number = MIN_USER_AGE,
  today: Date = new Date(),
): DateParts {
  return {
    y: today.getFullYear() - minAge,
    m: today.getMonth() + 1,
    d: today.getDate(),
  };
}

export function isBirthDateAllowedForMinimumAge(
  isoDate: string,
  minAge: number = MIN_USER_AGE,
  today: Date = new Date(),
): boolean {
  const p = parseBirthDateParts(isoDate);
  if (!p) return false;
  return compareDateParts(p, latestAllowedBirthDateParts(minAge, today)) <= 0;
}

/**
 * Latest birth year for which every calendar date in that year yields age >= minAge.
 * (Dec 31 of the birth year must still be on or before the latest allowed birth date.)
 */
export function maxBirthYearForMinimumAge(
  minAge: number = MIN_USER_AGE,
  today: Date = new Date(),
): number {
  const latest = latestAllowedBirthDateParts(minAge, today);
  let y = latest.y;
  while (y >= 1900) {
    if (compareDateParts({ y, m: 12, d: 31 }, latest) <= 0) return y;
    y -= 1;
  }
  return 1900;
}

export function maxSelectableMonthForBirthYear(
  year: number,
  minAge: number = MIN_USER_AGE,
  today: Date = new Date(),
): number {
  const latest = latestAllowedBirthDateParts(minAge, today);
  if (year < latest.y) return 12;
  if (year > latest.y) return 0;
  return latest.m;
}

export function maxSelectableDayForBirthYearMonth(
  year: number,
  month: number,
  minAge: number = MIN_USER_AGE,
  today: Date = new Date(),
): number {
  const latest = latestAllowedBirthDateParts(minAge, today);
  const monthCap = maxSelectableMonthForBirthYear(year, minAge, today);
  if (month > monthCap) return 0;
  const lastDayInMonth = daysInMonth(year, month);
  if (year < latest.y || month < latest.m) return lastDayInMonth;
  if (year === latest.y && month === latest.m) return Math.min(lastDayInMonth, latest.d);
  return lastDayInMonth;
}
