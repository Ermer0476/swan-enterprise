/**
 * Derived, render-only values for a user's Employee Masterlist fields.
 *
 * NOTHING here is stored. Age and years-of-service are computed from the
 * stored `birthDate` / `dateHired` at the moment they are shown, so they can
 * never drift out of date the way a persisted number would. Pure functions:
 * given the same input and the same wall clock they return the same result,
 * with no I/O and no side effects.
 */

/**
 * Whole completed years between `from` and now — i.e. how many times the
 * anniversary of `from` has already passed. The birthday/anniversary itself
 * has not counted until the day arrives, so someone born on 1 Sep is still
 * their previous age on 31 Aug.
 *
 * Computed on UTC calendar parts to match how Prisma stores a bare date
 * (midnight UTC); mixing UTC storage with local getters would shift the
 * boundary by a day for anyone west of UTC. Clamped at 0: a future date
 * yields 0, never a negative count, so a mistyped date degrades to a harmless
 * "0 yrs" rather than a nonsense negative on the profile page.
 */
function wholeYearsSince(from: Date): number {
  const now = new Date();
  let years = now.getUTCFullYear() - from.getUTCFullYear();
  const monthDelta = now.getUTCMonth() - from.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < from.getUTCDate())) {
    years -= 1;
  }
  return years < 0 ? 0 : years;
}

/** Age in whole years from the person's date of birth. Render-only. */
export function ageFromBirthDate(d: Date): number {
  return wholeYearsSince(d);
}

/** Completed years of service from the person's hire date. Render-only. */
export function yearsOfServiceFromDateHired(d: Date): number {
  return wholeYearsSince(d);
}
