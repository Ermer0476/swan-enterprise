# SWAN Enterprise — Business Concept Consistency Report

**Date:** 2026-08-02
**Scope:** All 19 feature modules (`features/*`), their pages (`app/*`), and the underlying Prisma schema. Read-only analysis — no code was changed to produce this report.
**Method:** Every finding below is backed by a direct file read or a repo-wide grep; counts are measured, not estimated. Where a concept has multiple implementations, this report names all of them, states whether the difference is *justified* (genuinely different business meaning) or *accidental* (same meaning, different code), and recommends one standard.

---

## Executive summary

SWAN Enterprise has two very different consistency stories running in parallel:

- **Where a shared component/module was built, it was rolled out thoroughly.** The Vessel selector, the CAPA (Corrective Action) tracker, and the root-cause taxonomy are the strongest examples — each is a real, reused abstraction adopted by 6–10 modules, not a copy-pasted pattern.
- **Where no shared abstraction was built, every module invented its own.** Status labeling/coloring, "who is responsible" fields, and office-reply/comment fields each have somewhere between 3 and 13 independent, near-duplicate implementations — including one function that is **copy-pasted verbatim in 13 separate files**.

The single highest-value fix in this report is consolidating the `statusTone(...)` function (see §6) — it is the clearest, lowest-risk, highest-repetition-count case of "same concept, many implementations" in the codebase.

| Concept | Consistency verdict |
|---|---|
| 1. Vessel selector | Strong — one shared component, minor copy drift |
| 2. Department selector | Consistent by scarcity (only used once) — but not derived from the single source of truth |
| 3. Crew / "who's responsible" selector | **Inconsistent** — 3 different tiers of formality for the same concept |
| 4. Attachments | **Inconsistent** — a shared feature used by only 2 of 19 modules |
| 5. Approval workflow | **Inconsistent** — one generic engine, used by 1 of 19 modules |
| 6. Status handling | **Inconsistent** — the `statusTone` function is duplicated verbatim 13 times |
| 7. Audit trail | Strong — enforced everywhere, one enum, one function |
| 8. Comments / office replies | **Inconsistent** — 4 different field names/shapes for the same concept, plus an unused shared model |
| 9. Root cause | Mostly strong — one shared taxonomy, one deliberate outlier |
| 10. Corrective action | Strong where adopted — but 3 modules reimplement it as a single free-text field instead |
| 11. Date handling | Strong — one display formatter, no bypasses found |
| 12. User permissions | Strong — one consistent `module:action` naming convention |
| 13. Notifications | N/A — schema exists, zero modules use it (nothing to be inconsistent *with* yet) |

---

## 1. Vessel selector

**Current state:** A shared `<VesselField>` component (`components/ui/vessel-field.tsx`) locks the field to the logged-in vessel for shipboard users and shows a normal dropdown for office users. It is used in **10 create forms** directly (Near Miss, Incidents, SIRE, PSC, CDI, Defects, Risk, Drills, Committee Meetings) plus the shared `<AuditForm>` (Internal + External Audits) — 12 modules total. NCR uses a deliberately bespoke inline version because its vessel field also drives a live client-side ref-number preview that `<VesselField>` can't support without becoming controlled. Documents and Circulars intentionally do **not** use it — their vessel field means "distribution scope" (a fleet-wide notice vs. a vessel-targeted one), not "which vessel does this event concern," so a different component is the *right* call there.

**Inconsistency found — copy: the "blank/no vessel" placeholder text is worded five different ways** for functionally the same optional-vessel case:

| Modules | `blankLabel` text |
|---|---|
| Near Miss, Incidents, Risk | `— Shore / N/A —` (component default, never overridden) |
| SIRE, PSC, CDI | `— Select —` |
| Committee Meetings | `— Shore / Office —` |
| Internal/External Audits | `— Shore / office —` *(note the capitalization mismatch with Meetings)* |
| Defects, Drills | `Select vessel…` *(these two are also `required` — a genuinely different case, since a defect/drill can't be shore-originated)* |

**Recommendation:** Standardize on one wording for the optional case — keep the component's own default (`— Shore / N/A —`) and stop passing a custom `blankLabel` in SIRE/PSC/CDI/Meetings/Audits, since none of them have a functional reason to say something different. Keep `Select vessel…` + `required` for Defects/Drills as the deliberately distinct required case.

---

## 2. Department selector

**Current state:** There is exactly **one** department `<select>` in the entire app — SMS Manual's "author which department owns this document" field (`app/(app)/sms-manual/new/new-document-form.tsx`). Nowhere else does a form ask for a department (there's no in-app user-management UI at all; departments are only ever assigned via `prisma/seed.ts`).

**Inconsistency found:** `features/sms-manual/schema.ts` **manually re-declares** the department list as its own `DEPARTMENTS` const array, with a comment admitting *"Department values mirror the Prisma `DepartmentType` enum"* — instead of importing the real `DepartmentType` enum from `@/lib/generated/prisma` the way `lib/auth.ts` correctly does. The two currently match (12 values, same order), so there's no active bug, but nothing would catch it if they ever drifted.

**Recommendation:** Replace `DEPARTMENTS` in `features/sms-manual/schema.ts` with the actual Prisma `DepartmentType` enum values (e.g. `z.nativeEnum` or importing the generated enum) so there is exactly one source of truth for department values.

---

## 3. Crew / "who's responsible" selector

**Current state — three different tiers of formality for the same underlying concept ("which person or role is accountable here"):**

| Tier | Modules | Implementation |
|---|---|---|
| Validated dropdown, department-scoped | Near Miss, Incidents | `lib/crew-ranks.ts` — `positionsFor(department)` returns ship ranks (Master…Cadet) for SHIPBOARD, office titles (Marine Supt…Technical Manager) for everyone else. Required. |
| Fixed enum, mixes ranks and departments | Non-Conformities (NCR) | `PERSON_IN_CHARGE_OPTIONS` — `["Master", "Chief Engineer", "Marine Department", "Technical Department", "Purchasing Department"]`. Required. Deliberately designed this way (comment explains office NCRs are often owned by a whole department, not one person) — a legitimate reason, but a third vocabulary. |
| Free text, no validation | Committee Meetings (`chairman`, `inCharge`), Drills (`conductedBy`), Internal/External Audits (`auditorName`) | Plain optional `AutoGrowInput`, any text accepted. |

**Recommendation:** These don't all need to converge — NCR's department-ownership case is genuinely different from "which crew rank reported this." But Committee Meetings' `chairman`/`inCharge` and Drills' `conductedBy` are conceptually identical to Near Miss/Incident's "who reported" field (a named crew member, from the same vessel, doing an official act) and would benefit from the same `positionsFor()` dropdown instead of unvalidated free text — it's the same shared module, already built, just not applied there.

---

## 4. Attachments

**Current state:** `features/attachments/` is a genuinely well-built, generic, entity-agnostic feature (registry pattern, MIME allowlist, size cap, auth-gated download route, local-disk storage with a documented swap-in point for cloud storage). It is registered for exactly **2 of 19 modules**: `Incident` and `SireObservation` (`features/attachments/actions.ts`, `REGISTRY`).

**Inconsistency found:** Every other module that plausibly needs supporting evidence — PSC deficiencies, CDI observations, NCRs, Defects (a defect report with no photo?), Risk Assessments, Internal/External Audit findings, Committee Meeting minutes — has **no attachment capability at all**. There's no documented reason in the code for why Incident and SireObservation specifically got it first; it reads as "built for the module being worked on at the time," not a deliberate scope decision.

**Recommendation:** The registry pattern already makes adding a new entity type a small, mechanical change (see the `PscDeficiency`/`InternalAuditFinding` entries in the CAPA registry for the exact shape to copy). Extend the `REGISTRY` in `features/attachments/actions.ts` to cover NCR, PSC deficiencies, Internal/External Audit findings, and Defects at minimum — these are the modules where "attach a photo/document as evidence" is standard maritime-safety practice.

---

## 5. Approval workflow

**Current state:** A genuinely generic, admin-configurable approval-chain engine exists (`WorkflowDefinition`/`WorkflowStep`/`WorkflowInstance`/`WorkflowAction` + `features/workflow/engine.ts`, editable at **Settings → Workflows** with no code changes). `docs/ARCHITECTURE.md` describes it as the pattern *every* module should bind to going forward ("Any future module binds to the engine the same way").

**Inconsistency found:** It is bound to **exactly one module** — SMS Manual. Every module built since (12+ modules) implements its own hand-rolled, hardcoded status-enum-plus-action-functions approval flow instead:

- Near Miss: `DRAFT → REPORTED → UNDER_REVIEW → CLOSED`, ship reports / office reviews & closes, hardcoded in `features/near-miss/actions.ts`.
- Committee Meetings: `DRAFT → REPORTED → CLOSED` (+ a ship-initiated revert-to-draft), hardcoded in `features/committee-meetings/actions.ts`.
- NCR, SIRE/PSC/CDI, Internal/External Audits: each has its own `OPEN`/`IN_PROGRESS`/`CLOSED`-shaped status enum and its own close/approve action function.

None of these are wrong per se — they work, and each was tuned to its module's real workflow (this session's own work built and refined two of them, Near Miss and Committee Meetings, independently). But it means the codebase now has **two parallel, non-interoperable notions of "approval workflow"**: the generic engine (unused outside SMS) and N bespoke reimplementations of a similar shape. An admin who configures a new approval chain at Settings → Workflows has no way to apply it to Near Miss, NCR, or any other module — that page's configurability only ever affects SMS documents.

**Recommendation:** Either (a) treat the bespoke per-module flows as the accepted standard going forward and update `ARCHITECTURE.md` to stop presenting the generic engine as the default pattern for new modules, or (b) if admin-configurable approval chains are actually wanted for more than SMS, plan a migration of at least one more module (Near Miss or Committee Meetings, since both already have very engine-shaped DRAFT→...→CLOSED flows) onto the real engine to prove it generalizes before investing further in bespoke per-module flows.

---

## 6. Status handling — the clearest single fix in this report

**Current state:** Every module has its own `*Status` Prisma enum (`NearMissStatus`, `CommitteeMeetingStatus`, `IncidentStatus`, `NcrStatus`, `InspectionStatus`, `FindingStatus`, `SireObservationStatus`, `DefectStatus`, `RiskAssessmentStatus`, `ControlledDocStatus`, `DocumentStatus`, `CapaStatus` — 12+ distinct enums). That part is expected and fine; different records genuinely have different lifecycles.

**Inconsistency found — the status-to-badge-color mapping function is copy-pasted verbatim across the codebase:**

```ts
function statusTone(s: string) {
  return s === "CLOSED" ? "success" : s === "IN_PROGRESS" ? "warning" : "accent";
}
```

This **exact function body** (byte-for-byte identical) is independently declared in **13 separate files**:

```
app/(app)/sire/page.tsx                    app/(app)/sire/[id]/page.tsx
app/(app)/psc/page.tsx                     app/(app)/psc/[id]/page.tsx
app/(app)/cdi/page.tsx                     app/(app)/cdi/[id]/page.tsx
app/(app)/internal-audits/page.tsx         app/(app)/internal-audits/[id]/page.tsx
app/(app)/external-audits/page.tsx         app/(app)/external-audits/[id]/page.tsx
app/psc/[id]/report/page.tsx
app/internal-audits/[id]/report/page.tsx
app/external-audits/[id]/report/page.tsx
```

Separately, Near Miss and Committee Meetings each built their **own**, differently-named, better-designed version that pairs the label and the tone together so they can never visually contradict each other (`nearMissStatusLabel`/`nearMissStatusTone` in `features/near-miss/schema.ts`; `meetingStatusTone` in `features/committee-meetings/schema.ts`) — this label+tone pairing was in fact added *specifically* to fix a real bug this session, where the same label showed two different badge colors. That fix has not propagated to the 13 files above, which remain vulnerable to the same class of bug if their status labeling logic ever needs to diverge for any one status value.

**Recommendation:** Extract one shared helper into `lib/utils.ts` (where `humanize` and `severityTone` already live) — something like:

```ts
export function lifecycleStatusTone(status: string): BadgeTone {
  if (status === "CLOSED") return "success";
  if (status === "IN_PROGRESS" || status === "ONGOING" || status === "UNDER_REVIEW" || status === "PENDING_VERIFICATION") return "warning";
  return "accent";
}
```

and delete all 13 local copies in favor of importing it. Modules with a genuinely different shape (Near Miss, Committee Meetings, Vessels, Defects) can keep their own bespoke function — the point isn't to force every status into one shape, it's to stop hand-copying the *identical* one.

---

## 7. Audit trail

**Current state — this is the strongest, most consistent concept in the app:**
- One `AuditLog` model, one `AuditAction` enum (`CREATE`/`UPDATE`/`DELETE`/`APPROVE`/`REJECT`/`SUBMIT`/`LOGIN`/`LOGOUT`/`SYNC`/`UPLOAD`/`DOWNLOAD`/`PRINT`/`EXPORT`), one `writeAudit()` function (`lib/audit.ts`), called with the same four fields (`actor`, `action`, `entityType`, `entityId`, `summary`) everywhere.
- Roughly one `writeAudit()` call per exported Server Action across every module (mechanically checked in the prior codebase health audit).
- Because `AuditAction` is a real TypeScript enum, no module can invent an ad-hoc action string — the compiler enforces the shared vocabulary.

**No inconsistency found.** This is the model other concepts in this report should be brought toward.

---

## 8. Comments / office replies

**Current state — four different names/shapes for "the office's written reply," plus an unused shared model built for exactly this purpose:**

| Module | Field(s) | Shape |
|---|---|---|
| *(schema-level, generic)* | `Comment` model (`entityType`/`entityId`/`authorId`/`body`) | Polymorphic, reusable — **zero usages anywhere in the app** |
| Near Miss | `companyComments` | Single nullable `String` on the record itself |
| Committee Meetings | `shoreRemarks` (overall) + `shoreComments` (one per agenda item) | Two nullable `String` fields, one at record level, one per child row |
| SIRE Observations | `SireObservationComment` model | A real one-to-many relation (author, timestamp, body) — the most structurally sophisticated of the four, but a one-off, not derived from the generic `Comment` model above |
| NCR | *(none)* | No field exists at all for the office/DPA to record why or with what conditions they closed an NCR |

**Recommendation:**
1. Rename for consistency at minimum: `companyComments` (Near Miss) and `shoreRemarks` (Committee Meetings) mean the same thing — pick one name (`shoreRemarks` reads more clearly as "the shore side's reply") and use it in both.
2. Add an equivalent field to NCR — closing out a non-conformity with no record of the closing rationale is a real documentation gap for a compliance-driven module.
3. Longer-term, consider whether the generic `Comment` model should actually be adopted (it already supports exactly the SIRE Observation use case) rather than continuing to add bespoke fields per module — but this is a bigger structural change than the others in this report and shouldn't block the quick wins above.

---

## 9. Root cause

**Current state:** A shared taxonomy (`lib/root-cause.ts` — `RootCauseCategory` enum + per-category subcategory lists + `formatRootCause()`) is used by **7 modules**: Incident, Near Miss, NCR, SIRE Observations, PSC Deficiencies, Internal Audit Findings, External Audit Findings. Each stores `rootCauseCategory` + `rootCauseSubCategory` the same way. This is a strong, deliberate unification (explicitly called out in the commit history as "unify... root-cause across modules").

**Inconsistency found:** 6 of the 7 modules (Incident, NCR, SIRE, PSC, Internal Audit, External Audit) *also* carry a free-text `rootCause: String?` field alongside the structured category/subcategory, for elaboration beyond the fixed taxonomy. **Near Miss is the one outlier** — it has no free-text `rootCause` field, and its `rootCauseCategory` is the only one of the seven that's **required** rather than optional. Given Near Miss was the first module to adopt the shared taxonomy (per commit history), this reads as: the pattern was refined (free-text elaboration added) after Near Miss shipped, and Near Miss was never revisited to match.

**Recommendation:** Add a `rootCause: String?` free-text elaboration field to `NearMiss` to match the other six modules, for consistency. Separately, confirm whether `rootCauseCategory` should really be required on Near Miss but optional everywhere else — if there's no specific reason Near Miss enforces this more strictly, relax it to match, or if there *is* a reason, document it.

---

## 10. Corrective action

**Current state — strong where it's used:** A single, genuinely polymorphic `CapaAction` model plus shared `<CapaTracker>`/`<CapaSummaryTable>` components are wired through one `REGISTRY` (`features/capa/actions.ts`), covering **6 entity types**: `Incident`, `NearMiss`, `NonConformity`, `PscDeficiency`, `InternalAuditFinding`, `ExternalAuditFinding`. Every one of these gets the same Action/Responsible/Target Date/Status/Closed Date row shape, the same add/edit/close UI, for free.

**Inconsistency found — three modules that conceptually need the exact same thing reimplement it as a single free-text field instead:**

| Module | Field | What it should probably be |
|---|---|---|
| Defect | `actionTaken: String?` | A `CapaAction` row (or rows) — a defect can need more than one follow-up action, and "what was done, by whom, by when, is it closed" is exactly the CAPA shape |
| Risk Assessment | `additionalControls: String?` | Same — mitigating controls are structurally corrective/preventive actions |
| CDI Observation | *(nothing at all)* | PSC Deficiency (a near-identical "finding during a port/vetting-style inspection" concept) already gets the full CAPA registry treatment; CDI Observation has no equivalent |

**Recommendation:** Register `Defect` and `RiskAssessment` in the CAPA `REGISTRY` and drop their bespoke `actionTaken`/`additionalControls` free-text fields (or keep them as an optional summary line, with the real tracked actions living in `CapaAction` rows). Register `CdiObservation` too, matching the precedent already set by its sibling module PSC.

---

## 11. Date handling

**Current state:** Every business date field (`occurredAt`, `meetingDate`, `raisedAt`, `auditDate`, `drillDate`, `issueDate`, `assessmentDate`, `dateRaised`, etc.) is stored as Prisma `DateTime` (SQLite has no native date-only type, so this is the only option) and consistently normalized to date-only at the UI boundary via `<Input type="date">` and `.toISOString().slice(0, 10)`. Display formatting goes through one shared `formatDate()` (`lib/utils.ts`), used in **36 files** — a repo-wide grep found **zero** places calling `.toLocaleDateString()` directly instead.

**No inconsistency found.** This is the second-strongest concept in the app after Audit Trail, and worth explicitly protecting (e.g. in a lint rule or code-review habit) as new modules are added — it would be easy for a new date field to bypass `formatDate()` if no one's watching for it.

---

## 12. User permissions

**Current state:** 82 permission keys, uniformly named `module:action`. A repo-wide count of the action suffixes: `read` (16), `create` (16), `update` (16), `delete` (16), `close` (11), `submit` (1), `approve` (1). The `submit`/`approve` pair belongs entirely to SMS Manual, which is the one module bound to the generic workflow engine (§5) and therefore has a genuinely different action vocabulary by design. Every Server Action across every module calls `requirePermission(...)` server-side (100%, mechanically verified) — UI-level `can()` checks are correctly treated as display-only, never trusted.

**No inconsistency found.** The naming convention is real and enforced, not just documented.

---

## 13. Notifications

**Current state:** A `Notification` model exists (`type`, `title`, `body`, `link`, `readAt` — a complete, sensible shape for an in-app notification center) but has **zero usages anywhere in the application code**. Nothing creates a notification today; the topbar's search/notification UI shell (per `docs/ARCHITECTURE.md`'s own "🟡 UI shell in topbar" note) is not backed by this model yet.

**Not an inconsistency (yet) — a risk to flag before it becomes one.** Because nothing uses `Notification` today, there's no wrong pattern to fix. But several modules in this report have natural "someone should be told about this" moments (a Near Miss reported to office, an NCR closed, a Committee Meeting revised-after-review) that would be tempting to solve with a quick per-module toast or badge instead of wiring into the shared model. **Recommendation:** when notification behavior is first added to any module, route it through the existing `Notification` model rather than inventing a per-module mechanism — this is the one concept in the report where prevention is cheaper than a later consolidation.

---

## Priority recommendations (ranked by effort-to-value)

1. **Extract `lifecycleStatusTone()` to `lib/utils.ts`** and delete the 13 duplicate `statusTone` functions (§6). Smallest, safest, highest-repetition-count fix in this report.
2. **Standardize `VesselField`'s `blankLabel` wording** across SIRE/PSC/CDI/Meetings/Audits (§1). Copy-only change, no logic touched.
3. **Fix `features/sms-manual/schema.ts`'s `DEPARTMENTS`** to derive from the real `DepartmentType` enum instead of a hand-maintained copy (§2).
4. **Rename `companyComments` → `shoreRemarks`** (or vice versa) so Near Miss and Committee Meetings use one name for the same concept, and add an equivalent field to NCR (§8).
5. **Add the missing `rootCause` free-text field to Near Miss** to match the other six root-cause modules (§9).
6. **Register `Defect`, `RiskAssessment`, and `CdiObservation` in the CAPA registry** (§10) — the highest-value structural change in this report, since it replaces three bespoke free-text fields with the same well-built tracker six other modules already benefit from.
7. **Extend the Attachments registry** to at least NCR, PSC, Internal/External Audit findings, and Defects (§4).
8. **Decide and document the intended scope of the generic workflow engine** (§5) — either commit to it for future modules or update `ARCHITECTURE.md` to stop presenting it as the default pattern.
9. **Route any future notification behavior through the existing `Notification` model** rather than a per-module mechanism (§13) — cheapest possible time to get this right is before the first usage exists.

---

*This report reflects the state of the repository at the time of analysis (2026-08-02) and did not modify any source code.*
