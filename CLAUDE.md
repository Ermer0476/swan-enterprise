# SWAN Enterprise — notes for Claude

Maritime ERP for Swan Shipping Corp. Next.js 15 + TypeScript (strict) + Tailwind
v4 + Prisma 6 + **PostgreSQL 15** (local dev). Custom session auth (jose + bcrypt),
data-driven RBAC. Read `docs/ARCHITECTURE.md` before adding features.

## Core rule

The **SMS Manual governs**. The ERP enforces it; it never contradicts it. Every
feature must trace back to an SMS procedure.

## Conventions (follow exactly)

- **No `any`.** `noUncheckedIndexedAccess` is on.
- **Writes** go in `features/*/actions.ts` (Server Actions), each starting with
  `requirePermission("<module>:<action>")` and ending with `writeAudit(...)`.
- **Reads** go in `features/*/queries.ts` (`import "server-only"`), always scoped
  by `companyId` and filtering `deletedAt: null`.
- Permission keys are defined in `lib/permissions.ts` and granted in
  `prisma/seed.ts`. Add there, never inline.
- New business tables include: `id` (uuid), `companyId`, `createdAt`,
  `updatedAt`, `createdBy`, `updatedBy`, `deletedAt`, `deletedBy`.
- Prisma client is generated to `lib/generated/prisma` — import from
  `@/lib/generated/prisma`.
- UI primitives live in `components/ui`; the sidebar is **collapsible** (arrow
  toggle) per the house style.

## Local workflow

Iterate locally; don't deploy until asked. Verify with `npm run typecheck` and
`npm run build`. Uses a local PostgreSQL 15 server (via Homebrew,
`brew services start postgresql@15`) — `DATABASE_URL` in `.env` is
`postgresql://ermermagbanua:swan@localhost:5432/swan_enterprise`. `npm run
db:push && npm run db:seed` to reset demo data. Seeded logins use password
`swan1234`. Postgres supports `mode: "insensitive"` and `skipDuplicates` in
Prisma queries (SQLite didn't) — fine to use going forward, existing code
doesn't need to change.
