# Office Comments Standardization — Report

## Standard chosen

**`shoreRemarks`** — the office/shore-side written reply to a vessel- or office-submitted report, on the specific record it responds to.

## What the audit actually found

Before touching any code, every field named in the brief's examples (`companyComments`, `shoreRemarks`, `comments`, `officeReply`) was traced to its real definition. Two of the four examples don't exist in this codebase as scalar office-reply fields — flagging that explicitly rather than inventing something to rename:

| Cited name | Found? | What it actually is |
|---|---|---|
| `companyComments` | Yes | `NearMiss.companyComments` — the office's single free-text reply to a Near Miss/HOR report. **This is the concept being standardized.** |
| `shoreRemarks` | Yes | `CommitteeMeeting.shoreRemarks` — the office's overall reply to a committee meeting. **Already the target name — no rename needed.** |
| `comments` | No, as a single-reply field | Two *different* concepts share the word "comments": (1) `SireObservation.comments` → `SireObservationComment[]`, a multi-author threaded discussion on a VIQ finding, and (2) an unused, dormant polymorphic `Comment` model (0 rows in the live database, no code anywhere reads or writes it). Neither is "one shore reply to one report" — both are left untouched. |
| `officeReply` | No | Does not exist anywhere in the codebase (schema, features, app, components) — not even as a variable name. |

**One additional field found during the audit that the brief didn't name:** `CommitteeMeetingAgenda.shoreComments` — the office's *per-agenda-item* reply (as opposed to `CommitteeMeeting.shoreRemarks`, the *overall* reply). Same business actor, different granularity. **Deliberately left unrenamed** — see "Scoping decisions" below.

## Old field names → New field name

| Old name | Model | New name | Change type |
|---|---|---|---|
| `NearMiss.companyComments` | `NearMiss` | `NearMiss.shoreRemarks` | **Renamed** |
| `CommitteeMeeting.shoreRemarks` | `CommitteeMeeting` | `CommitteeMeeting.shoreRemarks` | No change — already correct |
| *(did not exist)* | `NonConformity` | `NonConformity.shoreRemarks` | **Added** (new field, per the brief's explicit NCR requirement) |
| `CommitteeMeetingAgenda.shoreComments` | `CommitteeMeetingAgenda` | *(unchanged)* | Not renamed — see scoping note |
| `SireObservation.comments` → `SireObservationComment` | — | *(unchanged)* | Different concept (threaded discussion) — not touched |
| `Comment` (polymorphic model) | — | *(unchanged)* | Different concept (dormant, unused) — not touched |

## Scoping decisions (why two things were deliberately left alone)

1. **`CommitteeMeetingAgenda.shoreComments` was not renamed to `shoreRemarks`.** It is the same business actor (the office) but a structurally different shape — one row *per agenda item*, repeated many times per meeting, versus one `shoreRemarks` value for the whole record everywhere else. Renaming it would only create a second, conflicting meaning for the word "remarks" inside the same module (a meeting-level `shoreRemarks` and an item-level one, both editable in the same form) with real migration risk (2 non-empty rows in the live dev database) for a purely cosmetic gain. The brief's own examples (`companyComments`, `shoreRemarks`) were both whole-record fields, matching how NCR's new field was added — so this is the more faithful reading of "the same business concept," not a shortcut.
2. **`SireObservation`'s `SireObservationComment` thread and the dormant `Comment` model were not touched.** Both are genuinely different concepts from "one shore reply to one report": the former is a multi-author, unbounded discussion thread (any user with `sire:update` can post any number of times), the latter is unused scaffolding with zero live rows and zero code references. Renaming either would misrepresent what they are.

## Files modified

**Schema:**
- `prisma/schema.prisma` — renamed `NearMiss.companyComments` → `NearMiss.shoreRemarks`; added `NonConformity.shoreRemarks String?`.

**Near Miss (rename only, no new behavior):**
- `features/near-miss/schema.ts` — `officeReviewSchema.companyComments` → `shoreRemarks`.
- `features/near-miss/actions.ts` — `saveOfficeReviewAction` reads/writes `shoreRemarks`.
- `components/near-miss/office-review-form.tsx` — prop, input `id`/`name`, and label renamed (`companyComments` → `shoreRemarks`; "Company comments" → "Shore Remarks"; button "Save comments" → "Save Shore Remarks").
- `app/(app)/near-miss/[id]/page.tsx` — prop pass-through updated.
- `app/near-miss/[id]/report/page.tsx` — prop pass-through updated (read-only report view).

**NCR (new feature, added from scratch):**
- `features/non-conformities/schema.ts` — new `shoreRemarksSchema`.
- `features/non-conformities/actions.ts` — new `saveShoreRemarksAction`, gated by `ncr:update` (the same permission already gating root cause and CAPA edits on this record — NCR has no ship/office permission split elsewhere, so this doesn't introduce one), blocked once `status === "CLOSED"` (same read-only-on-close rule as the rest of the module), writes an audit entry (`UPDATE` / `"Shore remarks recorded for {refNo}"`).
- `app/(app)/non-conformities/[id]/shore-remarks-form.tsx` — new client component, modeled directly on the existing `root-cause-form.tsx` pattern already used on this page.
- `app/(app)/non-conformities/[id]/page.tsx` — new "Shore Remarks" card (editable form when `editable`, plain read-only text otherwise, "No shore remarks recorded yet." when empty) — placed after Attachments, before Lifecycle.
- `app/non-conformities/[id]/report/page.tsx` — new read-only "Shore Remarks" card in the print/report view.

**Committee Meetings:** no files changed — the module already used the standard name.

## Migration required?

**Yes — one migration, already applied to the dev database:**

```bash
npx prisma db push --accept-data-loss
```

- `NearMiss.companyComments → shoreRemarks`: safe. The live `dev.db` was checked before renaming — **zero non-null values** existed in this column across every seeded and manually-created Near Miss/HOR row, so nothing was lost. Verified post-migration: the column now reads `shoreRemarks` with all prior (empty) values intact.
- `NonConformity.shoreRemarks`: a new nullable column — additive, no risk.
- `prisma generate` was re-run automatically as part of `db push`, regenerating the Prisma client and its checked-in copy under `lib/generated/prisma/` so TypeScript sees the new field names.

**In a production/office-cloud environment with real `NearMiss.companyComments` data already on file, this same rename would need a proper `ALTER TABLE ... RENAME COLUMN` migration (not a drop/recreate)** — `db push --accept-data-loss` is only safe here because this is local dev SQLite with a verified-empty column. This distinction is called out explicitly because a sibling field on a different model, `CommitteeMeeting.shoreRemarks`, is a live example in this very database of a column that **must** be migrated carefully: it currently holds real office replies on 3 of its 4 seeded/test meetings (confirmed non-empty), which is exactly the scenario a rename must not be run carelessly against. That field wasn't renamed in this pass, but the same caution applies to any future rename touching a populated column.

## Backward compatibility risks

- **None for this pass, verified directly against the database**, because:
  - The only field actually renamed (`NearMiss.companyComments`) had no non-null data anywhere in the current database.
  - The only field added (`NonConformity.shoreRemarks`) is a new nullable column — every existing NCR row reads it as `null`/empty, exactly like every other optional field added to this schema in earlier work this session.
  - No API route, external integration, or other consumer of `companyComments` exists outside this app's own Next.js Server Actions — there's no external client contract to break.
- **Residual risk if this rename is ever repeated against a populated database** (e.g. a future office-cloud deployment that already has live Near Miss office comments on file): `prisma db push --accept-data-loss` would silently drop that column's data rather than preserve it. A real deployment must use `prisma migrate dev`/`deploy` with a hand-written `ALTER TABLE RENAME COLUMN` step instead of `db push`, exactly as flagged above for `CommitteeMeeting.shoreRemarks` should it ever need touching.
- **No permission model changes.** NCR's new `shoreRemarks` field reuses the existing `ncr:update` permission already granted to the correct roles in `prisma/seed.ts` — no new permission key was added, so no role-grant update was needed.

## Validation results

- `npm run typecheck` — clean, zero errors.
- `npm run lint` — zero errors/warnings in any file touched by this change (the two pre-existing repo-wide lint errors — an unescaped apostrophe in `components/vessels/vessel-form.tsx` and a `require()` import inside the generated Prisma client — are unrelated and pre-date this work).
- `npm run build` — succeeded, all routes compiled.
- **Live verification** (dev server restarted clean, `.next` cleared):
  - NCR detail page (`/non-conformities/[id]`) shows the new "Shore Remarks" card; typed a value, clicked Save, confirmed the value persisted to `NonConformity.shoreRemarks` in `dev.db` and a matching `AuditLog` row was written (`"Shore remarks recorded for NCR-2026-0001"`).
  - NCR report page (`/non-conformities/[id]/report`) correctly shows the saved value read-only.
  - Near Miss detail page now shows "Shore Remarks" (not "Company comments") in the Office Review card, and the form still saves/loads correctly under the new field name.
  - Committee Meetings list/detail pages checked for regressions — unaffected, since that module's schema was not touched.
