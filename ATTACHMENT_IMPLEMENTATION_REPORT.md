# Attachment Framework Extension — Implementation Report

## Summary

The existing Attachment Framework (`features/attachments/*`, `components/attachments/attachment-list.tsx`, the `/api/attachments/[id]` download route, and the `Attachment` Prisma model) has been extended to 10 additional modules, using the exact same shared component and upload/download/delete logic already proven in the Incident module. **No new attachment system was built, no upload logic was duplicated, and the UI is byte-identical everywhere it appears** — every module renders the same `<AttachmentList>` component with the same file-picker, list, and delete-button markup.

One module — **SIRE Observations** — already had attachments wired in from earlier work and was left untouched.

## Modules updated

| # | Module | Entity attached to | Level |
|---|---|---|---|
| 1 | Non-Conformity (NCR) | `NonConformity` | Top-level record |
| 2 | PSC Deficiencies | `PscDeficiency` | Per deficiency (child row) |
| 3 | Internal Audit Findings | `InternalAuditFinding` | Per finding (child row) |
| 4 | External Audit Findings | `ExternalAuditFinding` | Per finding (child row) |
| 5 | Risk Assessments | `RiskAssessment` | Top-level record |
| 6 | Defect Reports | `Defect` | Top-level record |
| 7 | Near Miss / HOR | `NearMiss` | Top-level record (covers both Near Miss and Hazard Observation reports, which share one model since the earlier NM/HOR merge) |
| 8 | Safety Meetings (Committee Meetings) | `CommitteeMeeting` | Top-level record |
| 9 | Emergency Drills | `EmergencyDrill` | Top-level record |
| 10 | CDI Observations | `CdiObservation` | Per observation (child row) |
| — | SIRE Observations | `SireObservation` | Already done (unchanged) |

No other module in the app had an ad-hoc "supporting documents" mechanism that needed replacing — every module above is a green-field addition of the shared component, not a migration away from something else.

## Files modified

**Shared engine (one file, additive change only):**
- [`features/attachments/actions.ts`](features/attachments/actions.ts) — added 10 `REGISTRY` entries (one per module above) and extended the registry's `permission` field to optionally accept an array of permission keys (`PermissionKey | PermissionKey[]`) instead of just one. This was necessary for Near Miss specifically (see **Permission verification** below) and is fully backward-compatible — every existing single-permission entry (`Incident`, `SireObservation`) works unchanged.

**Per-module wiring (queries + pages + panels):**
- `app/(app)/non-conformities/[id]/page.tsx`
- `features/psc/queries.ts`, `app/(app)/psc/[id]/page.tsx`, `app/(app)/psc/[id]/deficiencies-panel.tsx`
- `features/internal-audits/queries.ts`, `app/(app)/internal-audits/[id]/page.tsx`
- `features/external-audits/queries.ts`, `app/(app)/external-audits/[id]/page.tsx`
- `components/audit/findings-panel.tsx` (shared by both audit modules — added `entityType` + `attachmentsByFinding` props so the same component serves `InternalAuditFinding` and `ExternalAuditFinding` without duplicating the panel)
- `app/(app)/risk/[id]/page.tsx`
- `app/(app)/defects/[id]/page.tsx`
- `app/(app)/near-miss/[id]/page.tsx`
- `app/(app)/meetings/[id]/page.tsx`, `app/(app)/meetings/[id]/meeting-edit-form.tsx`
- `app/(app)/drills/[id]/page.tsx`
- `features/cdi/queries.ts`, `app/(app)/cdi/[id]/page.tsx`, `app/(app)/cdi/[id]/observations-panel.tsx`

**Nothing else changed.** No Prisma schema migration was needed — the `Attachment` model is already fully polymorphic (`entityType` + `entityId` strings, no per-module relation fields), which is exactly what let every module above be wired in without touching `schema.prisma`.

## Existing components reused (nothing new built)

- **UI:** `components/attachments/attachment-list.tsx` (`AttachmentList` + `AttachmentView` type) — unmodified, used as-is everywhere.
- **Server actions:** `uploadAttachmentAction` / `deleteAttachmentAction` in `features/attachments/actions.ts` — unmodified except the registry-permission type widening described above.
- **Storage:** `features/attachments/storage.ts` (local disk, `saveAttachmentFile`/`readAttachmentFile`/`deleteAttachmentFile`) — untouched.
- **Download route:** `app/api/attachments/[id]/route.ts` — untouched; already authenticated and company-scoped, works for every new entityType automatically since it looks up by attachment `id`, not by entityType.
- **Validation:** `ALLOWED_MIME_TYPES` / `MAX_ATTACHMENT_SIZE` in `features/attachments/schema.ts` — untouched, exactly as instructed.

For child-row modules (PSC deficiencies, Internal/External Audit findings, CDI observations), the batched attachment-fetch pattern already established by SIRE's `getSire()` was copied exactly: one `prisma.attachment.findMany({ entityId: { in: [...] } })` per parent record, filtered in memory per child row, instead of one query per row.

## Permission verification

Every module's attachment upload/delete is gated by the module's own existing `<module>:update` permission (already defined in `lib/permissions.ts`, already granted to the correct roles in `prisma/seed.ts` — no new permission keys were added):

| Module | Registered permission |
|---|---|
| NonConformity | `ncr:update` |
| PscDeficiency | `psc:update` |
| InternalAuditFinding | `iaudit:update` |
| ExternalAuditFinding | `eaudit:update` |
| RiskAssessment | `risk:update` |
| Defect | `defect:update` |
| CommitteeMeeting | `meeting:update` |
| EmergencyDrill | `drill:update` |
| CdiObservation | `cdi:update` |
| **NearMiss** | **`nm:create` OR `nm:update`** (see below) |

**One deliberate exception — Near Miss:** the vessel (which reports/drafts a Near Miss) holds `nm:create`, not `nm:update` — only the office holds `nm:update` (confirmed by reading `features/near-miss/actions.ts`: the ship's own draft-edit action requires `nm:create`, while office review/advance actions require `nm:update`). A single fixed permission key would have blocked one side or the other from ever attaching evidence. The registry's `permission` field was widened to accept an array (`["nm:create", "nm:update"]`, "any one of these") specifically to cover this — every other module's `editable` gate already lines up with a single existing permission, so no other entry needed the array form.

**Business rule compliance, verified per module:**
- Upload requires the module's own edit permission — confirmed for all 10 modules (table above).
- Delete requires the same permission, only while editable — reuses the identical `editable` boolean already computed on each page for its own status-gated edit window (e.g. NCR/PSC/Audits/CDI/Drills: `<module>:update && status !== "CLOSED"`; Risk: `status === "ACTIVE"`; Near Miss: ship's own edit window OR office's non-closed edit window; Committee Meetings: `shipEditable || officeEditable`, which is itself gated to DRAFT (ship) or REPORTED (office) — never once CLOSED).
- Once the parent record is closed, attachments become read-only — verified live in the browser (see below): a CLOSED Committee Meeting shows the attachment list with no Upload form and no delete buttons.

## Synchronization verification

**No synchronization work was done, and none was needed to do correctly.** Before touching any code, the codebase was searched end-to-end for an existing office-cloud / ship-local sync engine (per the brief's instruction to reuse it, not rebuild it). The result:

- `docs/ARCHITECTURE.md`'s own "Shared services" status table lists **"Offline sync — ⬜ planned (hybrid office-cloud / ship-local)"** — the lowest tier in that doc's own ✅/🟡/⬜ scale, i.e. explicitly not started.
- No `SyncQueue` model, sync service, or replication code exists anywhere in the repo. Every text match for "sync" in the codebase is either UI copy (PSC/NCR "synced with SWA-NCR-…" cross-link label), one unused `AuditAction.SYNC` enum value never actually written by any action, or an unrelated root-cause taxonomy label ("Connectivity / data-sync loss").
- The app runs today as a **single** Next.js instance against a **single local SQLite file** (`prisma/schema.prisma` datasource is `provider = "sqlite"`; the real `.env` points at one absolute local `file:` path). There is no second (ship) environment deployed anywhere yet, and no dual-connection code in `lib/prisma.ts`.

Given that, "attachments synchronize through the existing synchronization framework" cannot be implemented today — there is no framework to plug into, and building one would directly violate the brief's own "do NOT build a separate synchronization engine" instruction. Attachments are stored and behave exactly like every other table in the app (Incidents, NCRs, CAPA rows, etc.) — as soon as a real office/ship sync engine is built for the rest of the data model, attachments will sync through it the same way, with no attachment-specific work needed, since `Attachment` rows already carry `companyId`/`entityType`/`entityId` like every other business table.

**Recommendation:** if hybrid office/ship deployment is an active near-term goal, that sync engine needs to be scoped and built as its own project — it is a prerequisite for every module in this app, not something attachments can bootstrap alone. Until then, this gap applies equally to every table in the database, not specifically to attachments.

## Validation results

- **Type check:** `npm run typecheck` — clean, zero errors.
- **Lint:** `npm run lint` — zero errors or warnings in any file touched by this change. (The two pre-existing lint errors in the repo — `components/vessels/vessel-form.tsx` unescaped apostrophe, and a `require()` import inside the generated Prisma client — are unrelated to this work and were not introduced by it.)
- **Build:** `npm run build` — succeeded, all 39 routes compiled.
- **Live browser verification** (dev server restarted clean, `.next` cleared): opened a real record in every one of the 10 modules and confirmed the Attachments section renders correctly:
  - NCR, PSC (per-deficiency), Internal Audit (per-finding), External Audit (per-finding, including one finding already linked to an NCR), Risk Assessment, Emergency Drill, CDI Observation (per-observation), Near Miss/HOR — all show "No files attached yet." plus a working Upload form when the record is open/editable.
  - Committee Meeting in **CLOSED** status correctly hides the Upload form entirely (read-only), confirming the "closed record → read-only attachments" business rule holds.

## Recommendations

1. **Build the real sync engine before hybrid office/ship deployment**, as a project of its own — every table needs it, not just attachments, and it should be designed once and reused by all of them (consistent with this task's own "reuse, don't duplicate" instruction).
2. **PSC deficiency / audit finding attachments are not reparented to a linked NCR** the way CAPA rows are. When a PSC deficiency or audit finding gets an NCR raised from it, its CAPA tracker points at the NCR (single source of truth), but its attachments stay on the deficiency/finding itself. This was a deliberate simplification (evidence of the physical deficiency is arguably a different concept from the NCR's own corrective-action paperwork) — flagging it here in case the business actually wants those merged too.
3. Local-disk attachment storage (`storage/attachments/`) remains a single-server deployment liability once the app is no longer running on one machine — this was already flagged in `CODEBASE_HEALTH_REPORT.md` before this task and is unchanged by this work; worth prioritizing alongside the sync engine.
