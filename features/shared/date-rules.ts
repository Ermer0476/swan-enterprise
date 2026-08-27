/**
 * Predicates for the date rules these schemas keep repeating, so the awkward
 * parts are decided once. Messages stay at the call site — "Date is required"
 * on a drill and "Enter the date the inspection took place" on a PSC report
 * are the same rule but not the same sentence.
 */

/** A `yyyy-mm-dd` (or any parseable) date string. */
export function isValidDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

/**
 * Rejects a date that can't have happened yet.
 *
 * Every date this guards — when a near miss occurred, when an inspection or
 * audit took place, when a defect was raised — is a record of something that
 * already happened, so a value in the future is always a typo (usually the
 * wrong year, or next month picked by mistake).
 *
 * The one-day tolerance is deliberate. A `<input type="date">` submits a bare
 * calendar date, which parses as UTC midnight, but the fleet files reports
 * from every timezone: a vessel at UTC+8 filing at 08:00 local on the 7th is
 * at 00:00 UTC on the 7th, and a stricter comparison would reject their own
 * "today". Being lenient by up to a day costs nothing — nobody typos by one
 * day into the future — while a false rejection of today's date would block a
 * legitimate report outright.
 */
export function isNotFuture(value: string): boolean {
  const t = Date.parse(value);
  if (Number.isNaN(t)) return true; // not our rule to enforce — isValidDate's
  return t <= Date.now() + 24 * 60 * 60 * 1000;
}
