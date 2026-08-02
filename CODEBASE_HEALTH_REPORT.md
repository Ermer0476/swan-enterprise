# SWAN Enterprise — Codebase Health Report

**Date:** 2026-08-02
**Scope:** Full repository audit (`app/`, `features/`, `lib/`, `components/`, `prisma/`, tooling/config). Read-only analysis — no code was changed to produce this report.
**Method:** Static inspection (file-by-file reads), repo-wide grep sweeps for specific patterns (any-casts, TODOs, console.log, hard deletes, pagination, etc.), `npx tsc --noEmit`, `npm run lint`, `npm audit`, and `git log`/`git status`. All figures below are measured, not estimated.

---

## Overall Score: **70 / 100**

A well-architected internal ERP with unusually strong, consistently-enforced conventions for a project this size — but it is a **development-stage build, not a production-ready one**. The gap between "well-built app" and "production-ready system" is almost entirely: zero automated tests, no CI, a dev-grade database/storage layer, and a handful of easy security/dependency fixes.

| Category | Score /100 | One-line verdict |
|---|---|---|
| Architecture | 88 | Clean, consistently-applied layering; a few oversized files |
| Database | 68 | Well-modeled schema; SQLite + no pagination cap its ceiling |
| Code Quality | 90 | Exceptionally consistent conventions; almost no lint/type debt |
| Maintainability | 62 | Good docs and patterns undermined by **zero test coverage** |
| Performance | 65 | Good query discipline; unbounded lists will degrade over time |
| Security | 70 | Solid auth/RBAC core; missing headers, rate-limiting, dep patches |
| Scalability | 55 | SQLite + local-disk storage are real ceilings for a fleet-wide tool |
| UI Consistency | 74 | Strong shared component kit; native `confirm()` dialogs everywhere |
| Developer Experience | 60 | Great scripts/docs; no tests/CI, noisy lint config, coarse git history |
| Technical Debt | 66 | Low *intentional* debt; testing gap is the dominant debt item |

*(Overall score is a holistic judgment informed by, not a strict average of, the table above — production-readiness fundamentals such as tests, security, and scalability were weighted more heavily than they would be in a simple mean.)*

---

## How the codebase is organized (context for the rest of this report)

- **~23,500 lines** of hand-written TypeScript/TSX across `app/`, `features/`, `lib/`, `components/` (excludes the generated Prisma client, which is ~50k+ lines on its own).
- **19 feature modules** under `features/*/`, **57 page routes** under `app/`.
- **Prisma schema:** 41 models, 37 enums, 44 indexes, 20 unique constraints, SQLite datasource.
- **Git:** 4 commits total (`Initial commit` → 3 large squashed feature commits), **52 files currently uncommitted**, a `main` branch tracking `origin/main` on GitHub.
- **Dependencies:** Next.js 15.5.5, React 19, Prisma 6.19.3, Zod 3, no test framework, no CI config, no pre-commit hooks.

---

## 1. Architecture — 88/100

**Strengths (verified):**
- Every one of the 18 CRUD-style feature modules follows the exact same three-file shape (`schema.ts` / `queries.ts` / `actions.ts`) — confirmed with a scripted check, **0 exceptions**. The 19th (`workflow`) is a generic engine with a deliberately different shape (`engine.ts`, `admin-queries.ts`, `admin-actions.ts`), which is appropriate given it's infrastructure, not a business record.
- Reads and writes are cleanly separated: `queries.ts` is read-only DB access, `actions.ts` is Server Actions. Pages stay thin.
- The generic `WorkflowDefinition`/`WorkflowStep`/`WorkflowInstance` engine (`features/workflow/engine.ts`) is genuinely reusable — SMS approvals run through it today, and any future approval-chain module can bind to it without new engine code.
- `docs/ARCHITECTURE.md` documents the layering, security model, and "how to add a module" recipe — and matches reality closely (one stale claim noted in §10).

**Issues:**

| # | Severity | Issue | Recommendation |
|---|---|---|---|
| A1 | Low | Several files have grown large enough to hurt reviewability: `app/(app)/sire/[id]/observations-panel.tsx` (657 lines), `app/(app)/near-miss/new/new-near-miss-form.tsx` (484), `features/committee-meetings/actions.ts` (448), `features/near-miss/actions.ts` (440), `app/(app)/incidents/[id]/page.tsx` (418). | Split large client components by concern (e.g. header form vs. row-repeater vs. submit logic) once a module's churn slows down; not urgent, but will get harder to change safely as they grow further. |
| A2 | Low | The `workflow` module's file naming diverges from the rest of the codebase's `schema/queries/actions` convention. | Optional — rename to match, or explicitly document it as the sanctioned exception in `ARCHITECTURE.md` (it currently isn't called out). |

---

## 2. Database — 68/100

**Strengths (verified):**
- Consistent audit-column convention enforced across every business table (`id` uuid, `companyId`, `createdAt/updatedAt`, `createdBy/updatedBy/deletedBy`, `deletedAt`) — documented at the top of `schema.prisma` and followed throughout.
- Soft-delete is the default; a repo-wide search found **exactly one** genuine hard `.delete()` call in application code (`features/workflow/admin-actions.ts:98`, removing a workflow *config* step — not a business record), everything else uses `deletedAt`.
- 44 indexes present, generally on the `(companyId, status)` / `(companyId, kind)` hot-path shapes list pages actually filter by.
- Multi-tenant scoping (`companyId`) is present on every business table and consistently threaded through queries.

**Issues:**

| # | Severity | Issue | Recommendation |
|---|---|---|---|
| D1 | **High** | **SQLite** is the datasource for what is intended to be a fleet-wide, multi-user maritime ERP. SQLite serializes writes (single-writer lock) and has no native replication/HA story. This is explicitly labeled "local dev" in the schema header and `CLAUDE.md`, but there's no migration plan documented for the production datastore. | Before any real multi-vessel/multi-office rollout, plan and test a migration to Postgres (schema is already Prisma-based, so the model layer ports with minimal change — `String` id/uuid defaults, enums, and relations all translate directly). |
| D2 | Medium | Cascade-delete rules (`onDelete: Cascade`, 17 occurrences) are defined on child tables (agenda items, findings, revisions, etc.), but since the app **never hard-deletes** parent rows, these cascades are effectively dead code — child rows have no soft-delete column of their own and are only ever hidden by virtue of their (soft-deleted) parent being filtered out. | Either (a) accept this as intentional and note it in `ARCHITECTURE.md` so a future contributor doesn't assume cascades are load-bearing, or (b) add a scheduled hard-purge job for old soft-deleted rows, at which point the cascades become meaningful. |
| D3 | Low | One field/query bypasses the type system: `features/sms-manual/queries.ts:23` casts `filters.department as any` (with an accompanying `eslint-disable`) because `DocumentListFilters.department` is typed as loose `string` instead of the `DepartmentType` enum. | Retype `DocumentListFilters.department` as `DepartmentType \| undefined` and drop the cast — this is the *only* `any` in the entire hand-written codebase, so it's a five-minute fix. |
| D4 | Medium | No table has a pagination-friendly query today (see P1 below) — this is really a database *usage* issue, but it starts at the schema/index level (no cursor-friendly composite indexes for `ORDER BY x LIMIT n` patterns). | Design pagination and its supporting indexes together (see recommendation under P1). |

---

## 3. Code Quality — 90/100

This is the strongest category in the report, and the score reflects that everything below was checked mechanically, not sampled.

**Strengths (verified):**
- **100%** of `features/*/queries.ts` files start with `import "server-only"`.
- **100%** of `features/*/actions.ts` files gate every write with `requirePermission(...)`.
- **Zero** `@ts-ignore` / `@ts-expect-error` anywhere in the codebase.
- **Zero** `console.log`/`console.debug` statements left in the codebase.
- **Zero** `TODO` / `FIXME` / `HACK` / `XXX` comments anywhere — either genuinely no known shortcuts, or (more likely, given other findings) shortcuts aren't being flagged in-line at all, which cuts both ways (see Technical Debt).
- Exactly **one** `any`-cast in ~23,500 lines of hand-written code (see D3), and it's explicitly `eslint-disable`d, not silent.
- `tsconfig.json` is strict in the ways that matter: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `noUnusedLocals` are all `true`.
- `npm run lint` surfaces exactly **one** real issue in hand-written code (`components/vessels/vessel-form.tsx:90`, an unescaped apostrophe — `react/no-unescaped-entities`). Everything else in the lint output is noise from the generated Prisma client (see DX2).
- `writeAudit(...)` is called roughly 1:1 with exported action functions across every module (a small number of modules — `sire`, `cdi`, `internal-audits`, `external-audits` — show a slightly lower ratio and are worth a quick manual check, see below).

**Issues:**

| # | Severity | Issue | Recommendation |
|---|---|---|---|
| CQ1 | Low | `features/sire/actions.ts` (7 exported functions, 5 `writeAudit` calls), `features/cdi/actions.ts` (6/5), `features/internal-audits/actions.ts` (6/5), `features/external-audits/actions.ts` (6/5) have slightly fewer audit-log calls than exported actions. | Spot-check each of these four files to confirm every state-changing action writes an audit entry (a pure read-helper or a function that delegates to another audited function would explain the gap legitimately — but worth confirming rather than assuming). |
| CQ2 | Low | The single `as any` (D3) is the only type-safety hole, but it's real. | See D3's recommendation. |

---

## 4. Maintainability — 62/100

**Strengths (verified):**
- `README.md` (115 lines) and `docs/ARCHITECTURE.md` (103 lines) both exist, are current in almost every respect, and give a genuine "how do I add a module" recipe.
- The rigid schema/queries/actions convention (Architecture §1) is itself a huge maintainability asset — a new contributor can predict where any given piece of logic lives.
- `CLAUDE.md` (project root) captures hard-won conventions (no `any`, permission-key rules, audit-column shape, local-dev DB quirks) in enough detail that an AI or human contributor can onboard from it directly.

**Issues:**

| # | Severity | Issue | Recommendation |
|---|---|---|---|
| M1 | **Critical** | **There are zero automated tests in the repository** — no unit tests, no integration tests, no component tests, no e2e tests, and no test framework installed at all. Every verification this project has ever gotten has been manual (typecheck + build + live browser click-through). | This is the single highest-leverage investment available. Start narrow: (a) unit tests for the Zod schemas in `features/*/schema.ts` (cheap, high value — these encode the actual business rules), (b) a handful of integration tests around the highest-risk flows (RBAC gating in `requirePermission`, the Near Miss Draft/Report/Close state machine, the Committee Meeting revert-and-reclose cycle) since those have already had multiple live bugs caught only by manual testing this session. |
| M2 | High | No CI pipeline (no `.github/workflows`, confirmed absent). Nothing enforces `typecheck`/`lint`/`build` on push or PR — `next.config.ts` even has a comment claiming "Lint is run explicitly in CI," which is currently **not true**. | Add a minimal GitHub Actions workflow running `npm ci && npm run typecheck && npm run lint && npm run build` on every push/PR. This alone would have caught several issues faster than manual verification did this session. |
| M3 | Medium | `docs/ARCHITECTURE.md`'s "Shared services" table lists Attachments as "🟡 schema ready (DigitalOcean Spaces integration)" — but Attachments is actually **fully implemented** today, just on local disk (`features/attachments/storage.ts`), not "schema ready." | Update the status table to reflect reality: "✅ implemented (local disk; swap-in point for Spaces documented in `storage.ts`)." |
| M4 | Low | 52 files are currently uncommitted against a repo with only 4 commits total, each covering a very large span of work (e.g. one commit titled "Rebuild Committee Meetings on ADM-04, unify CAPA/root-cause across modules, and polish shell UI"). | Commit more granularly going forward — smaller, single-purpose commits make `git bisect`, code review, and rollback dramatically easier. Not urgent to rewrite history, but worth changing habits from here. |

---

## 5. Performance — 65/100

**Strengths (verified):**
- 22 uses of `Promise.all(...)` across the codebase for independent parallel queries (e.g. fetching CAPA rows + agenda items together) — good discipline against accidental request waterfalls.
- Server Components are the default; client components (`"use client"`) are scoped to genuinely interactive pieces (forms, trackers), not whole pages.
- Prisma `include` is used to fetch related rows in a single round-trip rather than looping and re-querying (spot-checked in several detail pages).

**Issues:**

| # | Severity | Issue | Recommendation |
|---|---|---|---|
| P1 | **High** | **Zero pagination anywhere.** Every list page (57 routes) calls `findMany` with no `take`/`skip` — confirmed by grepping all 18 `queries.ts` files for `take:`/`skip:` (zero matches). Every list page loads its entire table on every request. | Fine today at demo/small-fleet data volumes; will degrade as Near Miss/Incident/Audit-finding history accumulates over real operating years. Add cursor- or offset-based pagination to the highest-volume lists first (Near Miss, Incidents, NCR, CAPA-heavy modules), paired with the composite indexes needed to make `ORDER BY ... LIMIT` cheap. |
| P2 | Low | `next.config.ts` sets `serverActions.bodySizeLimit: "2mb"` (reasonable) but there's no equivalent guard visible on the list-query side (e.g., no max page size once pagination is added). | Bake a sane max page size into the pagination work in P1 from day one, rather than adding it later. |

---

## 6. Security — 70/100

**Strengths (verified):**
- Passwords hashed with `bcrypt` (cost factor 10) — never stored or logged in plaintext.
- Sessions are JWTs (`jose`, HS256) in an `httpOnly`, `sameSite: lax` cookie, `secure` in production, 30-day expiry — a solid, standard pattern (`lib/auth.ts`).
- `middleware.ts` does a coarse cookie-presence redirect before any protected page renders, and `getCurrentUser()` re-verifies the JWT and re-fetches fresh roles/permissions from the DB on every request — no stale-permission caching risk, and no page can silently skip the real check.
- **Every** Server Action across **every** feature module calls `requirePermission(...)` server-side (100%, mechanically verified) — the codebase's own stated rule ("UI-level `can()` checks are for hiding controls only, never trusted") is actually followed everywhere, not just in the docs.
- Login returns a generic "Invalid credentials" for both wrong-email and wrong-password cases (no user enumeration via error message).
- File uploads (`features/attachments/actions.ts`): MIME-type allowlist enforced, size cap enforced, and the on-disk filename is a fresh `randomUUID()` plus a length-bounded extension taken from `path.extname()` — not the user-supplied filename — so path traversal via a crafted filename isn't viable. Downloads are served through an authenticated route scoped by `companyId`, never from `/public`.
- Exactly one `dangerouslySetInnerHTML` in the whole codebase (`app/layout.tsx`, a theme-flash-avoidance script), and its content is a fully static string with zero user/request-data interpolation — no XSS risk there.
- `.env` is correctly gitignored; `.env.example` exists as a template with no real secrets in it.

**Issues:**

| # | Severity | Issue | Recommendation |
|---|---|---|---|
| S1 | **Critical** | `npm audit` reports **3 vulnerabilities (2 high, 1 critical)** in the currently-installed Next.js 15.5.5 dependency chain (React Flight protocol RCE and related advisories), with a fix available by upgrading to `next@15.5.22` — a **patch-level** bump within the same major/minor line, not a breaking upgrade. | Run `npm audit fix` (or bump the `next` version in `package.json` directly) and re-verify the build. This is the cheapest, highest-value fix in this entire report. |
| S2 | Medium | No login rate-limiting, attempt throttling, or account lockout (`app/(auth)/actions.ts`) — a scripted client could attempt unlimited password guesses against any known email. | Add basic throttling (e.g. a short lockout after N failed attempts per account/IP, or an off-the-shelf edge rate-limiter) before this app is reachable from an untrusted network. |
| S3 | Medium | No security headers configured anywhere (`next.config.ts` has no `headers()` block) — no CSP, no `X-Frame-Options`, no `Strict-Transport-Security`, no `Referrer-Policy`. | Add a `headers()` function in `next.config.ts` with baseline hardening headers; a CSP is the highest-value one given this is a data-entry-heavy internal app. |
| S4 | Low | `AUTH_SECRET` falls back to a hardcoded placeholder (`"dev-insecure-secret"` / `"dev-insecure-secret-change-me"`) if the env var is unset, in both `lib/auth.ts` and the checked-in `.env`. | Low risk today since it's clearly dev-only and the real value lives in a gitignored `.env`, but consider making the app **refuse to boot** in `NODE_ENV=production` if `AUTH_SECRET` is missing or matches the known placeholder, so a misconfigured production deploy fails loudly instead of silently using a guessable secret. |
| S5 | Low | No CSRF token beyond `SameSite=Lax` cookie behavior. Next.js Server Actions do have some built-in origin-checking, but it wasn't independently verified in this audit. | Worth an explicit verification pass (attempt a cross-origin POST to a Server Action) rather than relying on assumed framework behavior, given this app handles real operational/safety data. |

---

## 7. Scalability — 55/100

This is the lowest-scoring category, and it's a direct, predictable consequence of decisions that were reasonable for a local-dev/demo build but haven't yet been revisited for real deployment.

**Issues:**

| # | Severity | Issue | Recommendation |
|---|---|---|---|
| SC1 | **High** | SQLite (see D1) — single-writer semantics mean concurrent writes from multiple vessels/office users serialize; there's no read-replica or horizontal-scaling story available on this datastore. | Plan the Postgres migration (schema already Prisma-based) before onboarding more than a handful of concurrent users. |
| SC2 | **High** | Attachments are stored on local disk (`features/attachments/storage.ts`, `ATTACHMENTS_STORAGE_DIR`). This works on a single always-on server but **breaks on most modern hosting** (serverless functions, multi-instance deployments, ephemeral containers) since the filesystem isn't shared or persistent across instances. The code itself acknowledges this is a placeholder ("swapping to DigitalOcean Spaces later only means changing these three functions") — the swap just hasn't happened yet. | Before deploying anywhere other than a single persistent VM/server, migrate to object storage (S3-compatible — DigitalOcean Spaces, as already planned). The abstraction boundary is already correctly drawn in `storage.ts`, so this is a contained change. |
| SC3 | Medium | No pagination (P1) compounds directly into a scalability ceiling — response payload size and query cost both grow unbounded with data volume. | Same recommendation as P1. |
| SC4 | Low | No caching layer beyond Next.js's own request-level dedup/`revalidatePath`. For a low-traffic internal tool this is fine; noting it for completeness. | Not urgent; revisit only if read load ever becomes a bottleneck. |

---

## 8. UI Consistency — 74/100

**Strengths (verified):**
- A real shared component kit exists and is used consistently: `Button`, `Card`, `Badge`, `Input`/`AutoGrowInput`/`Select`/`Textarea`, `PageHeader`, `SortableHeader`, `VesselField` (8 primitives in `components/ui/`).
- Status badges follow one consistent `label + tone` pairing pattern across modules (Near Miss, Committee Meetings, etc.), including a fix applied this session specifically to prevent the same status from ever rendering in two different colors.
- The CAPA tracker (`components/capa/`) and root-cause picker are genuinely shared and reused across Incidents, Near Miss, PSC, and Audits rather than being reimplemented per module.
- The `VesselField` component (`components/ui/vessel-field.tsx`) is a good example of the right instinct: a shared, reusable primitive was built once and consistently rolled out across 10 of 12 modules that needed vessel-locking behavior, rather than copy-pasted.

**Issues:**

| # | Severity | Issue | Recommendation |
|---|---|---|---|
| U1 | Medium | Destructive-action confirmation uses the browser's native `window.confirm()` in **18 separate files** across the app, rather than a styled in-app modal consistent with the rest of the UI kit. | Build one shared `<ConfirmDialog>` component and swap the 18 `confirm(...)` call sites to it. Consistent today (no mix of native + custom), so this is a polish upgrade, not a bug fix. |
| U2 | Low | No shared toast/notification component was found — success/error feedback is handled per-form via inline `<p role="alert">` text, which is functional but inconsistent in placement/timing across modules. | Consider a shared toast system if the number of "did my save work?" support questions ever becomes a real signal; not currently a blocker. |
| U3 | Low | No Dialog/Modal primitive in `components/ui/` at all — every "are you sure" and every inline edit currently happens either inline on the page or via `confirm()`. | Natural pairing with U1 — build one Modal primitive and both the confirm-dialog and any future "quick edit" overlay needs are covered. |

---

## 9. Developer Experience — 60/100

**Strengths (verified):**
- `package.json` scripts cover the full loop well: `dev`, `build`, `typecheck`, `lint`, `db:generate/migrate/push/seed/studio`.
- `CLAUDE.md` is unusually thorough for a project this size — it documents the exact conventions (audit columns, permission-key rules, `noUncheckedIndexedAccess` implications, the SQLite absolute-path quirk, the safe `.next` restart sequence) that a new contributor (human or AI) would otherwise have to rediscover by trial and error.
- `npx tsc --noEmit` runs clean with strict settings enabled — a genuinely fast, reliable feedback loop for catching mistakes before they reach the browser.

**Issues:**

| # | Severity | Issue | Recommendation |
|---|---|---|---|
| DX1 | **Critical** | No test framework and no CI (restated from M1/M2 because it's as much a DX problem as a maintainability one — every change today is verified by a human clicking through the app in a browser, which doesn't scale as the app grows). | See M1/M2. |
| DX2 | Low | `eslint.config.mjs` has no `ignores` entry for `lib/generated/prisma/`, so `npm run lint` produces **hundreds of warnings/errors from generated code**, burying the one real issue (`vessel-form.tsx:90`) in noise. | Add `{ ignores: ["lib/generated/**"] }` to the ESLint flat config. Five-minute fix, immediately makes `npm run lint` actually useful again. |
| DX3 | Low | `next.config.ts` sets `eslint.ignoreDuringBuilds: true` with a comment stating lint runs "explicitly in CI" — but no CI exists (DX1/M2), so lint currently never gates anything automatically. | Resolves itself once M2 (CI) is addressed; until then, the comment is misleading about the actual safety net in place. |
| DX4 | Low | Git history is coarse (4 commits, 52 files currently uncommitted) — restated from M4 because it directly affects reviewability and safe rollback for future contributors. | See M4. |

---

## 10. Technical Debt — 66/100

**Overall shape of the debt:** low *intentional*/shortcut-style debt (no TODOs, no `any`-casts beyond one, no suppressed errors), but one large *structural* debt item (testing) that colors several other categories above.

**Issues:**

| # | Severity | Issue | Recommendation |
|---|---|---|---|
| TD1 | **Critical** | Zero automated test coverage (restated as the dominant, cross-cutting debt item — see M1). | See M1. |
| TD2 | Medium | Dependency vulnerabilities (S1) are debt in the sense that they accumulated simply by not bumping a patch version — cheap to pay down, so worth doing promptly rather than letting it compound with future upgrades. | See S1. |
| TD3 | Low | Stale documentation claim in `ARCHITECTURE.md` about Attachments status (M3). | See M3. |
| TD4 | Low | 5 nav items are explicitly marked `soon: true` (Planned Maintenance, Procurement, Crewing, Fleet Tracking, KPI & TMSA in `components/shell/nav.ts`) — **this is tracked, intentional roadmap work, not hidden debt**, and is called out here only for completeness. | No action needed; these are correctly surfaced to users as "not yet built" rather than silently broken. |
| TD5 | Low | The single `any`-cast (D3) and single real lint issue (`vessel-form.tsx:90`) are both trivial, isolated, quick wins. | Fix both in one small pass — neither requires design discussion. |

---

## Priority action list (do these first)

1. **S1 — `npm audit fix`** (Next.js patch bump to 15.5.22): fixes 1 critical + 2 high vulnerabilities. Cheapest, highest-value item in this report.
2. **M1/TD1 — Start a test suite**, beginning with the Zod schemas in `features/*/schema.ts` and the highest-risk state machines (Near Miss Draft/Report/Close, Committee Meeting revert-and-reclose).
3. **M2 — Add a CI workflow** running `typecheck` + `lint` + `build` on every push/PR.
4. **DX2 — Fix ESLint config** to ignore `lib/generated/**`, then fix the one real lint issue in `vessel-form.tsx`.
5. **D1/SC1 — Plan the SQLite → Postgres migration** before any real multi-user/multi-vessel rollout.
6. **SC2 — Plan the local-disk → object-storage migration** for attachments before deploying anywhere other than a single persistent server.
7. **S2/S3 — Add login rate-limiting and baseline security headers** before this app is reachable from an untrusted network.
8. **P1 — Add pagination** to the highest-volume list pages (Near Miss, Incidents, NCR) before real operational history accumulates.
9. **D3/TD5 — Fix the one `any`-cast** in `features/sms-manual/queries.ts`.
10. **M3 — Correct the stale Attachments status line** in `docs/ARCHITECTURE.md`.

---

*This report reflects the state of the repository at the time of analysis (2026-08-02) and did not modify any source code.*
