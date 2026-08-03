# SWAN Enterprise — Architecture

## Guiding principle

The **SMS Manual is the governing document**. The ERP digitally implements,
automates, monitors, records, and enforces the approved SMS. Where software
behavior and the SMS Manual conflict, **the SMS Manual prevails**. Every feature
must be traceable to an SMS procedure.

## Layers

```
app/                 Next.js App Router — routing, layouts, pages (thin)
  (auth)/            Login + auth server actions (unauthenticated)
  (app)/             Authenticated shell (sidebar + topbar) and all modules
  api/               Route handlers (health, future integrations)
features/            Business logic per feature — the real work lives here
  <feature>/
    schema.ts        Zod validation (input contracts)
    queries.ts       Read-side DB access ("server-only")
    actions.ts       Write-side Server Actions (guarded + audited)
components/
  ui/                Reusable design-system primitives (Button, Card, …)
  shell/             App chrome (sidebar, topbar, nav config)
lib/                 Cross-cutting services
  prisma.ts          Prisma client singleton
  auth.ts            Session, password hashing, getCurrentUser
  rbac.ts            can() / requirePermission() guards
  audit.ts           writeAudit() — immutable audit trail
  permissions.ts     Permission catalog (single source of truth)
prisma/              schema.prisma + seed.ts
```

**Rule:** UI is separate from business logic. Pages/components never touch
Prisma directly for writes — they call `features/*/actions.ts`. Reads go through
`features/*/queries.ts`.

## Security model

- **Authentication:** JWT in an httpOnly, SameSite=Lax cookie (`lib/auth.ts`).
  `middleware.ts` redirects unauthenticated requests to `/login` before any
  protected page renders; the `(app)` layout re-checks as defense-in-depth.
- **Authorization:** data-driven RBAC. Permissions (`module:action`) live in
  `lib/permissions.ts`; roles grant subsets; users have roles. Every Server
  Action calls `requirePermission()` **server-side** — UI-level `can()` checks
  are for hiding controls only and are never trusted.
- **Audit:** every business mutation calls `writeAudit()`. The `AuditLog` table
  is append-only and is the system of record for "who did what".
- **Multi-tenancy:** every business row carries `companyId`; all queries scope by
  it.
- **Soft deletes:** business tables carry `deletedAt` / `deletedBy`; queries
  filter `deletedAt: null`.

## The SMS Manual module (reference pattern)

The SMS Manual is the template every Phase 1 module copies:

1. **Entity + revision history** — `SmsDocument` holds identity; `SmsRevision`
   holds versioned content. `currentRevisionId` points at the approved,
   in-force revision.
2. **Approval workflow** — status flow `DRAFT → IN_REVIEW → APPROVED` (or back to
   `DRAFT` on reject), gated by permissions `sms:submit` / `sms:approve`.
3. **Audit** on every transition.
4. **Empty / loading / error** states throughout.

### Workflow engine

`WorkflowDefinition` / `WorkflowStep` / `WorkflowInstance` / `WorkflowAction`
model **configurable, non-hardcoded** approval chains (approver by role,
department, or specific user). The generic engine lives in
`features/workflow/engine.ts` (start / act / canAct / currentStep) and knows
nothing about any module. **SMS approvals run through this engine**: submitting
a document starts an instance from the company's active `SmsDocument` chain, and
each approve/reject is authorized against the current step's approver — not a
blanket permission. Admins edit chains at **Settings → Workflows**
(`/settings/workflows`) — add / reorder / remove steps and toggle active — with
no code changes. Any future module binds to the engine the same way (pick an
`entityType`, seed a definition, call `startInstance` / `act`).

## Adding a new module (recipe)

1. Add models to `prisma/schema.prisma` (follow the audit-column convention).
2. Add permission keys to `lib/permissions.ts` and grant them in `prisma/seed.ts`.
3. Create `features/<module>/{schema,queries,actions}.ts`.
4. Create pages under `app/(app)/<module>/`.
5. Add the nav entry in `components/shell/nav.ts` (drop `soon: true`).
6. `npm run db:push && npm run typecheck`.

## Phase 1 modules (implemented)

All of the following exist end-to-end (schema + `features/*` + pages + nav),
following the SMS Manual reference pattern above:

- **Vessels** — fleet master data + particulars
- **SMS Manual** — the reference module (revisions + approval workflow)
- **Incidents** — classification, CAPA, root cause, Statement of Facts
- **Near Miss / HOR** — merged module (`kind` field distinguishes them)
- **Non-Conformities (NCR)**
- **SIRE / PSC / CDI Inspections** — observations/deficiencies, evidence attachments; SIRE also supports importing observations from a Draft Response `.docx` (see below)
- **Internal / External Audits** — findings, shared audit components
- **Committee Meetings**, **Emergency Drills**
- **Documents** (general controlled-document register, distinct from SMS Manual)
- **Circulars** — Flag/Class/Insurance/Company source facet + category facet, sidebar flyout by source, distribution/acknowledgement tracking, required attachments, in-app PDF viewer
- **Risk Assessments**, **Defect List**

Every module reuses the same shared CAPA tracker, root-cause taxonomy
(`lib/root-cause.ts`), and attachment framework below rather than rolling its
own.

## Shared services (status)

| Service              | Status                                                     |
| --------------------- | ----------------------------------------------------------- |
| Auth                  | ✅ implemented (+ middleware gate)                          |
| RBAC                  | ✅ implemented                                              |
| Audit trail            | ✅ implemented                                              |
| Workflow engine        | ✅ implemented — SMS bound; admin-configurable               |
| Attachments            | ✅ implemented — local disk storage (`features/attachments`), entity-agnostic registry pattern (register a new module's `entityType` in `features/attachments/actions.ts`), in-app PDF viewer via `pdfjs-dist` (no forced download), list-page quick-view without opening the record |
| Comments               | ✅ implemented — per-module threads (e.g. SIRE observations) |
| CAPA tracker           | ✅ implemented — shared corrective/preventive action tracker reused across Incidents, Near Miss, SIRE/PSC/CDI, Audits |
| Document import/parse  | ✅ implemented for SIRE — uploads a Draft Response `.docx`, parses via `mammoth` + `features/sire/document-parser.ts`, shows an editable review screen before anything saves |
| Notifications          | 🟡 schema ready                                              |
| Global search          | 🟡 UI shell in topbar                                        |
| AI assistant           | ⬜ planned                                                   |
| Offline sync           | ⬜ planned (hybrid office-cloud / ship-local)                |
