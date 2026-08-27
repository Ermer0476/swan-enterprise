import "server-only";

/**
 * Before/after diffs for audit metadata.
 *
 * The one rule that keeps this trustworthy: build the Prisma `data` object
 * once, into a named const, and pass that same const both to
 * `prisma.*.update({ data })` and to `diffFields(existing, data)`. Diffing
 * anything else — a re-derived object, a spread with extra fields — lets the
 * diff drift from what was actually written, and a diff that lies is worse
 * than no diff at all.
 *
 * Never diff a credential or personal field (password hash, session token,
 * API key; a date of birth, a passport number, a next of kin's phone number)
 * through this helper. A before/after pair on a secret would leak it into
 * `AuditLog.metadata`, which is never pruned — and personal data is the same
 * class of problem with a longer tail: `AuditLog` is a SECOND COPY that no
 * redaction path touches and that every `admin:view-audit` holder can read.
 * Pass those field names in `opts.exclude` (see {@link diffFields}); the diff
 * then records THAT they changed, by name, with no values.
 */

/**
 * Several free-text fields diffed through this helper are `max(10000)` in
 * their Zod schemas, and `AuditLog` is never pruned — two unclipped 10 KB
 * strings would cost 20 KB per edit, forever. Clip long values and flag them
 * `truncated: true` instead: the audit summary carries the human meaning,
 * metadata carries the machine record, not a second copy of the document.
 */
export const MAX_AUDIT_VALUE_CHARS = 500;

/**
 * Row bookkeeping that must never reach a diff, for two separate reasons.
 *
 * It leaks. `changedLabels` falls back to the raw key when a module hasn't
 * labeled a field, so a `data` object carrying `updatedBy` produces an
 * inspector-facing summary reading "changed Action, updatedBy" — a database
 * column name in a compliance record, which is exactly what the summaries
 * exist to avoid.
 *
 * And it is redundant, which is the worse half. `AuditLog` already records
 * `actorId` and `actorName` for every row, so `updatedBy` in the diff says
 * nothing the audit row does not already say — while making the diff
 * non-empty. That is what breaks the "re-saved with no changes" branch: a
 * second actor opening a record and saving it untouched would be reported as
 * having changed something, and the one signal that distinguishes a real edit
 * from a no-op edit would be lost.
 *
 * Excluded here rather than at each call site, because remembering to leave a
 * field out of a `data` object is precisely the kind of thing that gets
 * forgotten — and the "one `data` const, two consumers" rule above means the
 * field legitimately has to be in `data` for the write.
 */
const BOOKKEEPING_FIELDS: ReadonlySet<string> = new Set([
  "updatedBy",
  "updatedAt",
  "createdBy",
  "createdAt",
]);

/**
 * One changed field. Two shapes, and the second is the point:
 *
 *  - the ordinary before/after pair, and
 *  - `{ withheld: true }` — this field changed and ITS VALUES ARE NOT
 *    RECORDED, because the caller named it in `opts.exclude`.
 *
 * A union rather than an optional `from`/`to`, so a consumer that renders a
 * diff cannot reach `change.from` without first proving the change is not a
 * withheld one. That is a compile error at every rendering site the day a
 * module starts excluding a field, which is exactly when someone needs to be
 * told (see app/(app)/settings/audit/audit-table.tsx).
 */
export type FieldChange =
  | { from: unknown; to: unknown; truncated?: boolean }
  | { withheld: true };
export type FieldDiff = Record<string, FieldChange>;

/** Narrowing helper for the union above — `"withheld" in change` inline reads
 *  as a typo the first three times somebody sees it. */
export function isWithheld(change: FieldChange): change is { withheld: true } {
  return "withheld" in change;
}

function normalize(value: unknown): unknown {
  if (value instanceof Date) return value.toISOString();
  if (value === "") return null;
  return value;
}

function clip(value: unknown): { value: unknown; truncated: boolean } {
  if (typeof value === "string" && value.length > MAX_AUDIT_VALUE_CHARS) {
    return { value: value.slice(0, MAX_AUDIT_VALUE_CHARS), truncated: true };
  }
  return { value, truncated: false };
}

/**
 * Compares `before` (the existing row) against `after` (the exact `data`
 * object about to be written) and returns only the fields that changed.
 *
 * Iterates `Object.entries(after)`, never the union of both key sets: a key
 * absent from `after` means the form didn't submit that field, which is not
 * a change. Entries whose value is `undefined` are skipped for the same
 * reason. Values are normalized before comparing — a `Date` by its ISO
 * string, an empty string as `null` (matching the `|| null` convention these
 * actions already use before touching Prisma) — and compared with
 * `Object.is`.
 *
 * Row bookkeeping (`updatedBy`, `updatedAt`, `createdBy`, `createdAt`) is
 * skipped — see `BOOKKEEPING_FIELDS` above for why that belongs here and not
 * at the call sites.
 *
 * `opts.exclude` names fields whose VALUES must never be written to
 * `AuditLog.metadata` — credentials, and personal data such as a date of
 * birth, a passport number or a next of kin's phone number. It is unioned
 * with `BOOKKEEPING_FIELDS` but behaves differently, and the difference is
 * deliberate: bookkeeping is dropped from the diff entirely (it is noise),
 * while an excluded field that changed is KEPT as `{ withheld: true }`. So
 * `changedLabels` still reports "Date of birth" and the compliance property —
 * *somebody edited this, and here is who and when* — survives, while the old
 * and new values do not exist anywhere in the audit trail.
 *
 * The list belongs to the module, not to this file: see the note on
 * `changedLabels` about module vocabulary, and
 * `features/crewing/audit.ts`'s `CREW_AUDIT_EXCLUDE`.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  opts?: { exclude?: ReadonlySet<string> },
): FieldDiff {
  const diff: FieldDiff = {};
  for (const [key, rawAfter] of Object.entries(after)) {
    if (rawAfter === undefined) continue;
    if (BOOKKEEPING_FIELDS.has(key)) continue;
    const afterValue = normalize(rawAfter);
    const beforeValue = normalize(before[key]);
    if (Object.is(beforeValue, afterValue)) continue;

    // Excluded: record the fact, never the values. Checked after the equality
    // test so an unchanged sensitive field produces no entry at all — a
    // "withheld" marker on a field nobody touched would report an edit that
    // did not happen.
    if (opts?.exclude?.has(key)) {
      diff[key] = { withheld: true };
      continue;
    }

    const clippedBefore = clip(beforeValue);
    const clippedAfter = clip(afterValue);
    const change: FieldChange = { from: clippedBefore.value, to: clippedAfter.value };
    if (clippedBefore.truncated || clippedAfter.truncated) change.truncated = true;
    diff[key] = change;
  }
  return diff;
}

/**
 * Turns a diff into a human list — e.g. `["Root cause", "Target date",
 * "Status"]` — in the order the changed fields appear in the diff, using
 * `labels` to translate each key and falling back to the raw key when a
 * module hasn't labeled it. Keep label maps local to each feature file: they
 * are module vocabulary, not shared vocabulary.
 */
export function changedLabels(diff: FieldDiff, labels: Record<string, string>): string[] {
  return Object.keys(diff).map((key) => labels[key] ?? key);
}

/**
 * Clips a string to `max` characters for an audit summary or metadata value
 * — a smaller shared cousin of the clipping `diffFields` does internally,
 * used at the several soft-delete sites that record the deleted content's
 * substance (a `deletedAt`-only row with no `deletedBy` has nowhere else to
 * record who removed it or what it said).
 */
export function clipText(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}
