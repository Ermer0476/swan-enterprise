# Status Badge Refactor Report

**Date:** 2026-08-02
**Author:** Lead Software Architect (this session)
**Scope:** Refactor the duplicated `statusTone()` function identified in `BUSINESS_CONSISTENCY.md` §6 into one shared helper. No database, Prisma schema, business logic, workflow, or UI-layout changes were made.

---

## A note on the "Business Rule" in the task brief

The task brief included a "Business Rule" stating *"SWAN Enterprise shall use ONLY the following lifecycle statuses: OPEN, UNDER_REVIEW, CLOSED,"* with definitions written in NCR-specific language (Root Cause Analysis, DPA/General Manager verification). Taken completely literally, that would mean renaming/collapsing the real Prisma status enums across most modules — e.g. `NcrStatus` (`OPEN`/`SUBMITTED_TO_OFFICE`/`CLOSED`), `IncidentStatus` (`REPORTED`/`UNDER_INVESTIGATION`/`ACTION_PENDING`/`CLOSED`), `NearMissStatus` (`DRAFT`/`REPORTED`/`UNDER_REVIEW`/`CLOSED`), and others — which directly contradicts requirement #6 in the same brief: *"Do NOT modify: Database, Prisma Schema, Business Logic, Existing Workflows... Only refactor duplicated status handling."*

Given that direct conflict, **this refactor treats requirement #6 as authoritative** and implements the "OPEN / UNDER_REVIEW / CLOSED" rule as the shared helper's **internal three-bucket color model** — a display-only concept — rather than as a mandate to rename any module's actual status values:

- Every module keeps its real Prisma status enum exactly as it is today.
- The shared function normalizes whatever status string a module passes it into one of exactly three tone buckets (`OPEN`-like → accent, `UNDER_REVIEW`-like → warning, `CLOSED` → success) purely for badge coloring.
- No schema, workflow, or business logic changed as a result.

**If the literal, schema-wide reading was actually intended, that is a substantially larger project** (touching ~10 Prisma models, their seed data, and every action/query that branches on status) and should be scoped and confirmed separately before starting — it is not what was done here.

---

## What was duplicated

`BUSINESS_CONSISTENCY.md` identified this exact function, copy-pasted **byte-for-byte identical** across 13 files:

```ts
function statusTone(s: string) {
  return s === "CLOSED" ? "success" : s === "IN_PROGRESS" ? "warning" : "accent";
}
```

Used for two Prisma enums that share this same OPEN/(IN_PROGRESS)/CLOSED shape: `InspectionStatus` (SIRE/PSC/CDI inspections: `OPEN`/`IN_PROGRESS`/`CLOSED`) and `FindingStatus` (Internal/External Audit findings: `OPEN`/`CLOSED`).

---

## The shared helper

**Location:** `lib/status.ts` (new file)

**Why this location, not `lib/utils/status.ts`:** `lib/utils.ts` is currently a single file, not a directory — turning it into `lib/utils/` would mean moving its existing contents into an `index.ts` and updating every one of its ~36 existing importers, which is a much larger and riskier change than this refactor calls for. `lib/status.ts` instead matches the project's existing convention of one small file per shared cross-cutting concern, sitting alongside `lib/root-cause.ts` (shared root-cause taxonomy) and `lib/crew-ranks.ts` (shared crew position lists).

```ts
const UNDER_REVIEW_VALUES = new Set(["IN_PROGRESS", "UNDER_REVIEW"]);

export function lifecycleStatusTone(status: string): "success" | "warning" | "accent" {
  if (status === "CLOSED") return "success";
  if (UNDER_REVIEW_VALUES.has(status)) return "warning";
  return "accent"; // OPEN, and anything else not yet under review or closed
}
```

**Why `"IN_PROGRESS"` is still recognized:** every one of the 13 replaced call sites passes `InspectionStatus` or `FindingStatus` values, and neither of those enums has an `UNDER_REVIEW` value today — they use `IN_PROGRESS` instead. Treating `IN_PROGRESS` as an alias for the same warning bucket means the function's output is **byte-for-byte identical** to the old one for every value actually in use, while still literally recognizing `"UNDER_REVIEW"` as an equivalent input for any future caller that uses that exact enum value (e.g. `NearMissStatus`, if that module is ever migrated to this shared helper).

---

## Files modified (14 total)

**1 new file:**
- `lib/status.ts` — the shared helper.

**13 files updated** (added an import, deleted the local `function statusTone`, renamed the call site from `statusTone(...)` to `lifecycleStatusTone(...)`):

| File | Call-site variable |
|---|---|
| `app/(app)/sire/page.tsx` | `r.status` |
| `app/(app)/sire/[id]/page.tsx` | `insp.status` |
| `app/(app)/psc/page.tsx` | `r.status` |
| `app/(app)/psc/[id]/page.tsx` | `insp.status` |
| `app/(app)/cdi/page.tsx` | `r.status` |
| `app/(app)/cdi/[id]/page.tsx` | `insp.status` |
| `app/(app)/internal-audits/page.tsx` | `r.status` |
| `app/(app)/internal-audits/[id]/page.tsx` | `audit.status` |
| `app/(app)/external-audits/page.tsx` | `r.status` |
| `app/(app)/external-audits/[id]/page.tsx` | `audit.status` |
| `app/psc/[id]/report/page.tsx` | `insp.status` |
| `app/internal-audits/[id]/report/page.tsx` | `audit.status` |
| `app/external-audits/[id]/report/page.tsx` | `audit.status` |

No other line in any of these 13 files was touched — imports for `formatDate`, `humanize`, `Badge`, and every other existing line are untouched.

---

## Files deliberately left unchanged

| File(s) | Reason |
|---|---|
| `components/ui/badge.tsx` (its own exported `statusTone()`) | A **different** function entirely — maps `DocumentStatus` (`DRAFT`/`IN_REVIEW`/`APPROVED`/`ARCHIVED`) for SMS Manual, not the OPEN/IN_PROGRESS/CLOSED shape. Not one of the 13 duplicates identified in the consistency report; genuinely a different concept. |
| `features/near-miss/schema.ts` (`nearMissStatusLabel`/`nearMissStatusTone`) | Bespoke by design — pairs the *label* and *tone* together so they can never visually contradict each other (a real bug this was built to fix earlier this session), and additionally varies by viewer department (office sees "For Review" collapsing two statuses; ship sees the literal status). Not a duplicate of the 13; a genuinely different, more sophisticated shape. |
| `features/committee-meetings/schema.ts` (`meetingStatusTone`) | Same reasoning as Near Miss — a bespoke 3-state (`DRAFT`/`REPORTED`/`CLOSED`) function with its own shape, not one of the 13 duplicates. |
| `app/(app)/vessels/page.tsx` (`statusTone`) | Maps `VesselStatus` (`ACTIVE`/`LAID_UP`/`DRYDOCK`/`SOLD`) — an entirely different enum and business meaning (fleet status, not a workflow lifecycle). Not one of the 13 duplicates. |
| `app/(app)/near-miss/[id]/report/page.tsx` (local `statusTone`) | This one *does* look similar at a glance but was **not** part of the 13 identified in the consistency report — it maps Near Miss's own status shape, not the Inspection/Finding shape this refactor targeted. Left alone to keep this change strictly scoped to the identified duplicates; flagged here as a candidate for a **follow-up** pass if Near Miss/Committee Meetings are ever consolidated onto a shared multi-status helper. |
| Prisma schema (`InspectionStatus`, `FindingStatus`, and every other `*Status` enum) | Explicitly out of scope per requirement #6. |
| `features/*/actions.ts`, `features/*/queries.ts` (status transition logic) | Explicitly out of scope per requirement #6 — no status transition, permission check, or workflow logic was touched. |
| CAPA (`features/capa/`), root-cause (`lib/root-cause.ts`), Attachments | Unrelated to status badges; not touched. |

---

## Before vs. after

**Before** (repeated 13 times, verbatim, across 5 modules):

```ts
// app/(app)/sire/page.tsx
function statusTone(s: string) {
  return s === "CLOSED" ? "success" : s === "IN_PROGRESS" ? "warning" : "accent";
}
// ...
<Badge tone={statusTone(r.status)}>{humanize(r.status)}</Badge>
```

*(and 12 more files with the identical 3-line function, only the call-site variable name differing)*

**After** (one definition, 13 call sites):

```ts
// lib/status.ts
export function lifecycleStatusTone(status: string): "success" | "warning" | "accent" { /* ... */ }

// app/(app)/sire/page.tsx
import { lifecycleStatusTone } from "@/lib/status";
// ...
<Badge tone={lifecycleStatusTone(r.status)}>{humanize(r.status)}</Badge>
```

Net effect: **-36 lines** (13 × 3-line function bodies minus the one shared definition, plus 13 one-line imports), one function to change if the color mapping ever needs to change, instead of 13.

---

## Verification performed

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ Clean, zero errors |
| `npm run lint` | ✅ Zero new issues in any of the 14 files touched (confirmed by filtering lint output to just those paths). Pre-existing, unrelated lint noise from `lib/generated/prisma` (the generated Prisma client, not excluded in `eslint.config.mjs`) and one pre-existing unrelated issue in `components/vessels/vessel-form.tsx` remain exactly as they were before this change — neither was introduced or touched by this refactor. |
| `npm run build` | ✅ Clean production build, full route manifest generated, no errors |
| Live browser verification | ✅ Confirmed in-browser after a clean dev-server restart: SIRE Inspections list shows "In Progress" with `bg-warning/10 text-warning` (identical class list to pre-refactor); Internal Audits list shows the same; PSC's report page shows the inspection-level status via the new `lifecycleStatusTone` (`bg-warning/10 text-warning`) *and* the separate, untouched deficiency-level `resolved ? "success" : "warning"` badges rendering correctly alongside it, confirming the two independent tone functions on that page didn't interfere with each other. |

No visual regression was found — every badge that rendered a given color before this refactor renders the identical color after it.

---

## Migration risks

1. **Low risk overall** — this was a pure extract-function refactor with no logic change; the new function is provably output-identical to the old one for every value actually passed today (verified both by code inspection and live rendering).
2. **`lifecycleStatusTone`'s type signature is `string`, not a specific enum union** — same as the original 13 duplicates (`s: string`), so it will silently return `"accent"` for any typo or unexpected status value rather than a compile error. This is pre-existing behavior, not a regression, but worth noting if stricter typing is ever wanted (e.g. `status: InspectionStatus | FindingStatus`).
3. **The `near-miss/[id]/report/page.tsx` local `statusTone`** (see "Files deliberately left unchanged") is similar-looking but was intentionally not touched, since it wasn't one of the 13 duplicates named in the consistency report. A future pass consolidating *all* status-tone logic (including Near Miss, Committee Meetings, and Vessels) into a richer shared module is possible, but was out of scope here and would need its own review given those three have genuinely different bucket shapes.
4. **If the literal "rename every module's status enum" reading of the Business Rule was actually intended** (see the note at the top of this report), none of that work has been done — this refactor only changed how existing statuses are *colored*, not what statuses exist. Flagging this explicitly so it isn't mistaken for having been completed.

---

*This report reflects the state of the repository at the time of this refactor (2026-08-02).*
