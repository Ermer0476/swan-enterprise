# SWAN Enterprise

**Integrated Maritime Enterprise Management Platform** for Swan Shipping Corporation.

An enterprise-grade maritime ERP that digitally implements, automates, monitors,
and enforces the company's approved Ship Management System (SMS) Manual. The SMS
Manual is the governing document — the ERP never replaces it, only enforces it.

> **Status:** Foundation + Phase 1 safety-reporting suite (Milestone 2). The
> platform skeleton (auth + middleware gate, RBAC, audit trail,
> attachments/notifications schema, app shell) is in place. The **generic
> workflow engine** drives **SMS Manual** approvals through admin-configurable
> chains (Settings → Workflows). Four **separate** SMS report modules are built
> on the same feature pattern, each with its own form, reference series and
> lifecycle:
>
> | Module | Ref | Lifecycle |
> | --- | --- | --- |
> | **Incidents** | `INC-` | Reported → Investigation → Action Pending → Closed |
> | **Near Miss** | `NM-` | Reported → Under Review → Closed |
> | **Hazard Observations (HOR)** | `HOR-` | Open → In Progress → Closed |
> | **Non-Conformities (NCR)** | `NCR-` | Open → In Progress → Verified → Closed |
> | **SIRE Inspections** | `SIRE-` | Open → In Progress → Closed (+ VIQ observations) |
> | **PSC Inspections** | `PSC-` | Open → In Progress → Closed (+ deficiencies, detention) |
> | **CDI Inspections** | `CDI-` | Open → In Progress → Closed (+ observations) |
> | **Internal Audits** | `IA-` | Open → In Progress → Closed (+ findings: Major/Minor NC, Obs) |
> | **External Audits** | `EA-` | Open → In Progress → Closed (+ findings: Major/Minor NC, Obs) |
>
> The inspection and audit modules are each a header + its own findings sub-table
> (SIRE observations / PSC deficiencies / CDI observations / audit findings); they
> close only once every finding is closed. The two audit modules share identical
> structure — their findings/status/create UI is one shared component set, each
> module passing its own server actions in.

---

## Tech stack

| Layer     | Choice                                            |
| --------- | ------------------------------------------------- |
| Framework | Next.js 15 (App Router, Server Actions), React 19 |
| Language  | TypeScript (strict, `noUncheckedIndexedAccess`)   |
| Styling   | Tailwind CSS v4, hand-rolled shadcn-style UI      |
| Database  | PostgreSQL                                        |
| ORM       | Prisma 6                                           |
| Auth      | Session JWT (jose) in an httpOnly cookie + bcrypt |

---

## Getting started

### 1. Get a PostgreSQL database

Pick whichever is easiest for you:

- **Postgres.app** (simplest on Mac) — download from <https://postgresapp.com>, start
  it, then create the DB:
  ```bash
  createdb swan_enterprise
  ```
- **Docker** — `docker compose up -d` (uses `docker-compose.yml` in this repo).
- **Neon** (free cloud) — create a project at <https://neon.tech> and copy the
  connection string.

### 2. Configure env

```bash
cp .env.example .env
```

Set `DATABASE_URL` to your Postgres connection string, and set a real
`AUTH_SECRET` (`openssl rand -base64 32`).

### 3. Create the schema and seed demo data

```bash
npm install
npm run db:push      # creates tables from prisma/schema.prisma
npm run db:seed      # company, roles, users, fleet, sample SMS docs
```

### 4. Run

```bash
npm run dev
```

Open <http://localhost:3000> and sign in. Seeded logins (password `swan1234`):

| Email                    | Role                   | Can do                          |
| ------------------------ | ---------------------- | ------------------------------- |
| admin@swanshipping.com   | Administrator          | Everything                      |
| qhse@swanshipping.com    | QHSE Manager           | Author **and approve** SMS docs |
| marine@swanshipping.com  | Marine Superintendent  | Author + submit (no approve)    |
| master@swanshipping.com  | Ship Officer           | Read-only                       |

> Sign in as `marine@…` to author + submit a document, then as `qhse@…` to
> approve it — that's the SMS approval workflow in action.

---

## Scripts

| Command             | Purpose                              |
| ------------------- | ------------------------------------ |
| `npm run dev`       | Dev server                           |
| `npm run build`     | Production build (`prisma generate`) |
| `npm run typecheck` | `tsc --noEmit`                       |
| `npm run db:push`   | Sync schema to DB (no migration)     |
| `npm run db:migrate`| Create a dev migration               |
| `npm run db:seed`   | Seed demo data                       |
| `npm run db:studio` | Prisma Studio                        |

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how modules are structured
and how to add the next one.
