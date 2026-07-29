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

## Shared services (status)

| Service         | Status                                             |
| --------------- | -------------------------------------------------- |
| Auth            | ✅ implemented (+ middleware gate)                 |
| RBAC            | ✅ implemented                                     |
| Audit trail     | ✅ implemented                                     |
| Workflow engine | ✅ implemented — SMS bound; admin-configurable     |
| Attachments     | 🟡 schema ready (DigitalOcean Spaces integration)  |
| Comments        | 🟡 schema ready                                    |
| Notifications   | 🟡 schema ready                                    |
| Global search   | 🟡 UI shell in topbar                              |
| AI assistant    | ⬜ planned                                         |
| Offline sync    | ⬜ planned (hybrid office-cloud / ship-local)      |
```
