import type { ZodError } from "zod";

/**
 * The result every server action hands back to its form.
 *
 * `error` is the single headline message (the first problem found) — it is
 * what the form's top-of-card alert line shows, and it is unchanged from
 * before `fieldErrors` existed, so a form that hasn't been migrated yet keeps
 * behaving exactly as it did.
 *
 * `fieldErrors` is the additive part: field name → message, so a form can
 * also put each message next to the input it belongs to instead of leaving
 * the user to guess which of twenty fields the headline is about. Keyed by
 * the form field's `name`, which for these schemas is the zod issue path.
 */
export type ActionResult = {
  ok: boolean;
  error: string | null;
  fieldErrors?: Record<string, string>;
};

/**
 * Shown when a write is refused because the record changed underneath it —
 * the `updatedAt` the form submitted no longer matches the row in the
 * database.
 */
export const STALE_RECORD_MESSAGE =
  "This was changed by someone else on board. Reload to see their version.";

/**
 * Turns a failed `safeParse` into an ActionResult carrying both the headline
 * and the per-field breakdown.
 *
 * First issue wins per field: zod can report several problems for one field
 * (e.g. "too short" and a failed refine) and showing them stacked under one
 * input is noise — the first is the one to fix first.
 *
 * Issues with an empty path (a form-level `superRefine` that didn't set
 * `path`) can't be attributed to any input, so they only reach the headline.
 * That's why cross-field refines in these schemas all pass an explicit
 * `path` — it's what puts "Target date can't be before the date raised" on
 * the target-date input rather than floating at the top of the form.
 */
export function failFromZod(error: ZodError): ActionResult {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".");
    if (!key || key in fieldErrors) continue;
    fieldErrors[key] = issue.message;
  }
  return {
    ok: false,
    error: error.issues[0]?.message ?? "Invalid input",
    fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined,
  };
}
