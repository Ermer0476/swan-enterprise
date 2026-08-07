# Workflow Architecture Review — SWAN Enterprise

**Scope:** Compare the generic Workflow Engine against the hand-rolled workflows in SMS Manual, Near Miss, Committee Meetings, NCR, PSC, and Internal/External Audits. Recommend one architecture for the whole application.

**Recommendation: B — each module continues owning its own workflow.** The generic engine should remain exactly where it is today (bound to SMS Manual only) rather than become the app-wide standard. Rationale follows.

---

## 1. What the generic Workflow Engine actually models

`features/workflow/engine.ts` + the `WorkflowDefinition` / `WorkflowStep` / `WorkflowInstance` / `WorkflowAction` Prisma models implement one specific, narrow shape:

> An ordered chain of named steps. Each step is approved by a fixed authority (a role, a department, or one specific user). A single instance walks the chain **strictly forward**: `act()` records an APPROVE (advance to next step, or finalize APPROVED if last) or a REJECT (finalize REJECTED — terminal, no path back). Admins edit the chain — add/remove/reorder/toggle steps — at **Settings → Workflows**, with no code deploy.

This is a **multi-actor sequential sign-off chain** — the same shape as "this document needs the Chief Officer, then the Master, then the DPA to each say yes." It is a good, clean implementation of that one shape, and it is genuinely admin-configurable: a company can change who signs off, and in what order, without a code change.

It is *not* a general status-machine framework. It has no concept of:
- A transition gated by a **computed business condition** rather than a person's decision (e.g. "closeable only once every linked corrective action is closed").
- A **backward** transition (reopening a record).
- A transition that **carries its own payload** alongside the status change (e.g. per-agenda-item office replies written in the same transaction as the close).
- Department- or record-ownership-based **visibility** rules (who can even see a DRAFT).

## 2. Current adoption: one consumer, by design fit — not by oversight

Grepping the whole repo for imports of `startInstance` / `getActiveInstance` / `act` from `features/workflow/engine` turns up exactly:

```
features/sms-manual/actions.ts   ← the only business-logic consumer
app/(app)/settings/workflows/*   ← the admin UI for the engine itself
```

No other module — Near Miss, Committee Meetings, NCR, PSC, Internal Audits, External Audits, SIRE, CDI, Incidents, Risk, Defects, Drills — touches the engine. `docs/ARCHITECTURE.md` still describes it as the pattern "any future module binds to the same way," but in practice every module built since SMS has bypassed it. `BUSINESS_CONSISTENCY.md` §5 flagged this same gap and left the decision open — this report closes it.

**Why SMS fits and the others don't:** SMS Manual's real workflow *is* "N reviewers sign off in sequence, authority varies by company policy" — that is precisely what a Document Control procedure requires, and precisely what the engine models. Approve/reject authorization in `sms-manual/actions.ts` is delegated entirely to the engine's `canAct()` (role/department/specific-user match against the *current step*) — `sms:approve` exists only as a catalog entry in `lib/permissions.ts` and is never checked by `requirePermission()`. That is correct: who may approve a document depends on which step of *which chain* is active, not on a single static permission.

## 3. What every other module's "workflow" actually is

None of the other five workflows are actor-approval chains. Each is a **record lifecycle enforcing an SMS-mandated invariant**, where the gate is a computed condition, not a person's yes/no:

| Module | States | What actually gates the terminal transition | Shape |
|---|---|---|---|
| **Near Miss** | `DRAFT → REPORTED → UNDER_REVIEW → CLOSED` | `nm:close` permission **and** all linked CAPA rows closed | Linear index-walk (`NM_STATUSES.indexOf`), ship reports / office reviews-and-closes |
| **Committee Meetings** | `DRAFT → REPORTED → CLOSED`, plus a **backward** `revertMeetingToDraftAction` | `meeting:close`; **atomic** single-transaction write of `shoreRemarks` + per-agenda-item `shoreComments` + `status: CLOSED` + `closedAt` together | Named per-transition functions, not an index-walk; genuinely non-linear |
| **NCR** | `OPEN → SUBMITTED_TO_OFFICE → CLOSED` | `ncr:close`; root cause recorded; all linked CAPA rows closed | Linear index-walk, submission is a side effect of saving root cause (no separate "submit" click) |
| **PSC** | `OPEN → IN_PROGRESS → CLOSED` | `psc:close`; every deficiency has ≥1 CAPA row and all are closed (deficiencies linked to an NCR check CAPA under `NonConformity` instead) | `IN_PROGRESS` is an automatic side effect of adding the first deficiency — nobody "decides" that transition |
| **Internal/External Audits** | `OPEN → IN_PROGRESS → CLOSED` | Same CAPA-resolution loop as PSC; a finding's own "resolved" state is **computed** from its CAPA rows, never stored, specifically to avoid drift (see schema comment at `InternalAuditFinding`) | Same implicit-bump shape as PSC |

Two structural facts fall out of this table and matter for the decision:

1. **The real gate everywhere except SMS is "is the linked corrective-action work actually done?", not "did an approver click yes."** Forcing this through the engine would mean either (a) inventing a new step-approver type that means "computed condition met" — a change to the shared engine's core model, or (b) checking the CAPA condition in module code *before* calling the engine, at which point the module still owns its real logic and the engine is a redundant status mirror on top.
2. **Committee Meetings' backward revert-to-draft and atomic multi-field close have no equivalent in the engine at all.** The engine's `act()` only ever moves forward or terminates; adding "go back a step" or "write arbitrary side-payload with the transition" are both changes to the shared component, which every other consumer (SMS) would then also carry the risk surface of, for a need only one module has.

## 4. Comparison

### Maintainability
- **A (universal engine):** Would remove the duplicated `nextStatus()`/`nextOf()` index-walk helpers (currently re-declared per module, once server-side in `actions.ts` and again client-side in the page as `nextOf()`). But it would not remove the CAPA-resolution loop, the root-cause gate, or the computed finding-resolution logic — those stay in module code regardless, *plus* a new translation layer to the engine, *plus* seed data (`WorkflowDefinition`/`WorkflowStep` rows) that must stay in sync with the hardcoded gates. Net: two sources of truth (seeded chain + code-side business gate) per module instead of one.
- **B (bespoke, status quo):** Duplication is real but shallow and mechanical (an index into a status array; a copy-pasted tone function — the latter was already centralized this session into `lib/status.ts`). The actual business logic lives in exactly one place per module, directly readable without cross-referencing seeded config.
- **Edge:** B, once the shallow duplication (`nextOf`/`nextStatus`) is optionally extracted into a small shared helper — see §6.

### Complexity
- **A:** Adds a second vocabulary everywhere (`WorkflowInstance.status`: DRAFT/IN_PROGRESS/APPROVED/REJECTED/CANCELLED) that must be reconciled with each entity's own domain status (`NcrStatus`, `NearMissStatus`, …) — SMS already carries this dual-state cost today. Extending the engine to support computed-condition steps and backward transitions adds permanent complexity to a shared component for the benefit of a subset of modules.
- **B:** Complexity is local and proportional — a module with a real CAPA gate has CAPA-gate code; a module without one doesn't carry engine machinery it doesn't need.
- **Edge:** B.

### Performance
- **A:** Every transition becomes a `WorkflowInstance` + `WorkflowStep` join plus a `WorkflowAction` insert inside a transaction, versus today's single-row `update()`. On SQLite (single-writer), that's more lock time per transition across every module, for modules that never needed multi-step sequencing in the first place.
- **B:** Minimal, direct writes already in place.
- **Edge:** B (though the absolute difference is small at current data volumes — this is a minor factor, not the deciding one).

### Flexibility
- **A's one genuine strength:** admin-editable chains with no code deploy — real value when the *identity of the approver* is a business policy that legitimately varies (SMS review chain today, potentially "who chairs this committee" tomorrow).
- **Where that flexibility is a liability, not a feature:** NCR/Near Miss/PSC/Audit closure rules ("closed only once every linked CAPA is closed") are SMS-mandated compliance invariants, not tunable business policy. Exposing them through the same generic "admin reconfigures the chain" UI would let a company accidentally configure a chain that permits closing an NCR without CAPA closure — a compliance regression the current hardcoded gate cannot suffer.
- **Edge:** Context-dependent — this is the strongest argument *for* A in the abstract, but it only actually helps the one module (SMS) whose transitions are genuinely a configurable sign-off chain.

### Business suitability
- Per `CLAUDE.md`: *"The SMS Manual governs. The ERP enforces it; it never contradicts it."* The five non-SMS workflows all enforce fixed SMS procedure (CAPA must close before the finding/NCR/near-miss closes) — that belongs in code as an invariant, not in an admin-editable chain that could be reconfigured away from the procedure it's supposed to enforce.
- SMS Manual's workflow is the one case in the app where "who approves, in what order" is itself the business content of a company-specific procedure — exactly what the engine is for.
- **Edge:** B for the five compliance-invariant modules; A (i.e., today's status quo) for SMS.

## 5. Why "B" and not a forced migration to "A"

Migrating Near Miss, Committee Meetings, NCR, PSC, or the Audits onto the generic engine would require extending the engine's core model (computed-condition steps, backward transitions, atomic side-payload writes) to fit shapes it wasn't built for — at which point every existing and future consumer, including SMS, inherits the complexity and risk of a more general-purpose (and more failure-prone) shared component, in exchange for admin-configurability that these five modules should not have in the first place, since their transition rules are compliance invariants, not adjustable policy.

The clean architectural line is:

- **Use the generic engine** when a module's real need is *"N actors sign off in a company-configurable sequence."* Today that's SMS Manual only.
- **Keep a module-owned, hardcoded workflow** when the real need is *"enforce a fixed SMS procedure via computed conditions and permission-gated actions."* That's Near Miss, Committee Meetings, NCR, PSC, and both Audit modules today — and should be the default assumption for any new module unless it specifically turns out to need a configurable multi-actor sign-off chain.

## 6. Recommendation detail (no code changes made — this is guidance for future work)

1. **Keep the engine as-is, bound to SMS Manual only.** Do not deprecate it — it is well-built for its one real use case and may fit a genuinely new future need (e.g., if a Change-of-Management or Permit-to-Work module ever needs a company-configurable multi-role sign-off chain).
2. **Update `docs/ARCHITECTURE.md`** to stop presenting "any future module binds to the engine" as the default recipe. Replace it with: *bind to the engine only when the module's real workflow is a configurable multi-actor sign-off chain; otherwise follow the module-owned pattern used by Near Miss / NCR / PSC / Audits.*
3. **Optional, low-risk cleanup** (does not require adopting the engine): extract the repeated `nextStatus()` (server) / `nextOf()` (page) index-walk pattern — currently re-declared near-identically in `near-miss/actions.ts`, `non-conformities/actions.ts`, and four page files — into one small shared helper (e.g. `lib/status.ts`, which already hosts `lifecycleStatusTone`/`LIFECYCLE_TONE` from this session's refactor). This removes the one piece of *genuine, mechanical* duplication across these modules without touching any module's actual business gating logic.
4. **Leave the CAPA-resolution loop, root-cause gate, and computed finding-resolution logic exactly where they are** (module-owned `actions.ts`), since they are SMS-procedure invariants, not policy the engine should ever mediate.

## Appendix — files reviewed

| File | Lines | Hand-rolled transition logic? | Uses generic engine? |
|---|---:|---|---|
| `features/workflow/engine.ts` | 191 | — (is the engine) | — |
| `features/workflow/admin-actions.ts` | 175 | — (admin CRUD on chain config) | — |
| `features/workflow/admin-queries.ts` | 21 | — | — |
| `features/workflow/workflow-progress.tsx` | 64 | — (render-only) | — |
| `app/(app)/settings/workflows/page.tsx` + `workflow-editor.tsx` | 61 + 239 | — | — |
| `features/sms-manual/{schema,actions,queries}.ts` | 48 + 313 + 53 | No | **Yes** |
| `features/near-miss/{schema,actions,queries}.ts` | 184 + 440 + 71 | Yes — index-walk + CAPA gate | No |
| `features/committee-meetings/{schema,actions,queries}.ts` | 126 + 448 + 67 | Yes — named per-transition fns + backward transition + atomic close | No |
| `features/non-conformities/{schema,actions,queries,ui}.ts` | 88 + 289 + 137 + 16 | Yes — index-walk + root-cause + CAPA gate | No |
| `app/(app)/non-conformities/[id]/page.tsx` (and 3 other page files) | 186 | Yes — client-side `nextOf()` duplicate | No |
| `features/psc/{schema,actions,queries}.ts` | 63 + 263 + 47 | Yes — implicit bump + CAPA-resolution loop | No |
| `features/internal-audits/{schema,actions,queries}.ts` | 50 + 257 + 49 | Yes — same shape as PSC | No |
| `features/external-audits/{schema,actions,queries}.ts` | 50 + 257 + 50 | Yes — same shape as PSC | No |
| `docs/ARCHITECTURE.md` | 103 | — (source of the stale "any future module binds here" claim) | — |
| `BUSINESS_CONSISTENCY.md` §5–§6 | — | Prior finding this report resolves | — |
