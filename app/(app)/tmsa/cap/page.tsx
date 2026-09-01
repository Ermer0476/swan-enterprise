import Link from "next/link";
import { requirePermission, can } from "@/lib/rbac";
import { listFindings, listAllFindingsLight, listFindingElementCodes } from "@/features/tmsa/queries";
import { TMSA_FINDING_STATUSES, TMSA_FINDING_STATUS_LABELS } from "@/features/tmsa/schema";
import { daysUntil, formatTargetDate } from "@/features/tmsa/target";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TmsaTabs } from "../tmsa-tabs";
import { StatusSelect } from "./status-select";
import { CorrectiveActionEdit } from "./corrective-action-edit";
import { ResponsibleEdit } from "./responsible-edit";
import { TargetDateEdit } from "./target-date-edit";
import { NewObservationForm } from "./new-observation-form";
import { CapSearch } from "./cap-search";
import { DeleteFindingButton } from "./delete-finding-button";

type SP = {
  status?: string;
  source?: string;
  element?: string;
  due?: string; // overdue | soon | nodate
  q?: string;
  from?: string; // element code the user came from (for the Back button)
};

// Highlight every occurrence of `query` inside `text`.
function Highlight({ text, query }: { text: string; query?: string }) {
  const q = (query ?? "").trim();
  if (!q) return <>{text}</>;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="rounded bg-warning/30 px-0.5">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function sourceTone(s: string): "accent" | "neutral" {
  return s === "Equinor" || s === "Chevron" ? "accent" : "neutral";
}

// Classify a finding's deadline into a coloured tag (null once CLOSED).
type Deadline = { kind: "overdue" | "soon" | "later" | "nodate"; label: string; cls: string };
function deadlineTag(target: string, status: string): Deadline | null {
  if (status === "CLOSED") return null;
  const days = daysUntil(target);
  if (days === null) return { kind: "nodate", label: "no target date", cls: "bg-muted text-muted-foreground" };
  if (days < 0) return { kind: "overdue", label: `${Math.abs(days)}d overdue`, cls: "bg-danger/10 text-danger" };
  if (days <= 90) return { kind: "soon", label: `${days}d left`, cls: "bg-warning/10 text-warning" };
  return { kind: "later", label: `${days}d left`, cls: "bg-success/10 text-success" };
}

function toggleHref(sp: SP, key: keyof SP, value: string) {
  const next: Record<string, string> = { ...sp };
  if (next[key] === value) delete next[key];
  else next[key] = value;
  const qs = new URLSearchParams(next).toString();
  return `/tmsa/cap${qs ? `?${qs}` : ""}`;
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition-colors ${
        active ? "bg-primary text-primary-foreground ring-primary" : "bg-card text-muted-foreground ring-border hover:bg-muted"
      }`}
    >
      {children}
    </Link>
  );
}

export default async function CapPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requirePermission("tmsa:read");
  const canManage = can(user, "tmsa:manage-cap");
  const sp = await searchParams;

  const q = (sp.q ?? "").trim();

  const [fetched, all, elements] = await Promise.all([
    listFindings(user.companyId, { status: sp.status, source: sp.source, elementCode: sp.element, q }),
    listAllFindingsLight(user.companyId),
    listFindingElementCodes(user.companyId),
  ]);

  const filtered = sp.due ? fetched.filter((f) => deadlineTag(f.target, f.status)?.kind === sp.due) : fetched;

  const findings = [...filtered].sort((a, b) => {
    const la = /[A-Za-z]/.test(a.elementCode) ? 1 : 0;
    const lb = /[A-Za-z]/.test(b.elementCode) ? 1 : 0;
    return a.elementBase - b.elementBase || la - lb || a.stage - b.stage || a.questionNo - b.questionNo || a.seq - b.seq;
  });

  const total = all.length;
  const closed = all.filter((f) => f.status === "CLOSED").length;
  const inProg = all.filter((f) => f.status === "IN_PROGRESS").length;
  const open = all.filter((f) => f.status === "OPEN").length;
  const pct = total ? Math.round((closed / total) * 100) : 0;

  const overdueCount = all.filter((f) => deadlineTag(f.target, f.status)?.kind === "overdue").length;
  const soonCount = all.filter((f) => deadlineTag(f.target, f.status)?.kind === "soon").length;
  const noDateCount = all.filter((f) => deadlineTag(f.target, f.status)?.kind === "nodate").length;

  const cards = [
    { label: "Total Findings", value: total, cls: "" },
    { label: "Closed", value: closed, cls: "text-success" },
    { label: "Open / In Prog.", value: open + inProg, cls: "text-warning" },
    { label: "Overdue", value: overdueCount, cls: "text-danger" },
    { label: "Due ≤90d", value: soonCount, cls: "text-warning" },
    { label: "% Closure", value: `${pct}%`, cls: "text-accent" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader title="TMSA Hub" description="Audit findings & corrective action plan (CAP)." />
      <TmsaTabs active="cap" />

      {sp.from && (
        <Link
          href={`/tmsa/element/${encodeURIComponent(sp.from)}`}
          className="mb-4 inline-flex items-center gap-1 rounded-md bg-foreground px-3 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          ← Back to Element {sp.from}
        </Link>
      )}

      {canManage && <NewObservationForm />}
      <CapSearch />

      <div className="mb-3 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-4">
              <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
              <p className={`mt-1 text-2xl font-semibold tabular-nums ${c.cls}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mb-5 h-2 w-full overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-success" style={{ width: `${pct}%` }} />
      </div>

      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs font-medium text-muted-foreground">Status</span>
          {TMSA_FINDING_STATUSES.map((s) => (
            <Chip key={s} href={toggleHref(sp, "status", s)} active={sp.status === s}>
              {TMSA_FINDING_STATUS_LABELS[s]}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs font-medium text-muted-foreground">Source</span>
          {["Equinor", "Chevron", "Internal"].map((s) => (
            <Chip key={s} href={toggleHref(sp, "source", s)} active={sp.source === s}>
              {s}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs font-medium text-muted-foreground">Element</span>
          {elements.map((e) => (
            <Chip key={e} href={toggleHref(sp, "element", e)} active={sp.element === e}>
              {e}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-16 text-xs font-medium text-muted-foreground">Deadline</span>
          {[
            { v: "overdue", label: `Overdue (${overdueCount})` },
            { v: "soon", label: `Due ≤90d (${soonCount})` },
            { v: "nodate", label: `No target (${noDateCount})` },
          ].map((d) => (
            <Chip key={d.v} href={toggleHref(sp, "due", d.v)} active={sp.due === d.v}>
              {d.label}
            </Chip>
          ))}
        </div>
      </div>

      <p className="mb-2 text-sm text-muted-foreground">
        Showing <strong>{findings.length}</strong> of {total} findings.
      </p>

      <div className="max-h-[74vh] overflow-auto rounded-md border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-3 font-medium">Ref</th>
              <th className="px-3 py-3 font-medium">TMSA #</th>
              <th className="px-3 py-3 font-medium">Src</th>
              <th className="px-3 py-3 font-medium">Observation</th>
              <th className="px-3 py-3 font-medium">Corrective Action</th>
              <th className="px-3 py-3 font-medium">Responsible</th>
              <th className="px-3 py-3 font-medium">Target</th>
              <th className="px-3 py-3 font-medium">Status</th>
              <th className="px-3 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border align-top">
            {findings.map((f) => (
              <tr key={f.id} className="hover:bg-muted/30">
                <td className="whitespace-nowrap px-3 py-3">
                  <Link href={`/tmsa/cap/${f.id}`} className="font-mono text-xs text-accent hover:underline">
                    {f.code}
                  </Link>
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  <span
                    className={`font-mono text-sm font-semibold ${f.questionNo > 0 ? "" : "text-muted-foreground"}`}
                    title={f.questionNo > 0 ? "Mapped to a specific TMSA KPI" : "Element + stage only (no KPI question number in the report)"}
                  >
                    {f.kpiRef || f.elementCode}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <Badge tone={sourceTone(f.source)}>{f.source}</Badge>
                </td>
                <td className="w-80 min-w-[18rem] whitespace-pre-line px-3 py-3 text-muted-foreground">
                  <Highlight text={f.observation} query={q} />
                </td>
                <td className="w-96 min-w-[20rem] px-3 py-3 text-sm">
                  {canManage ? (
                    <CorrectiveActionEdit id={f.id} value={f.correctiveAction} />
                  ) : f.correctiveAction ? (
                    <p className="whitespace-pre-line text-muted-foreground">{f.correctiveAction}</p>
                  ) : (
                    <p className="text-sm italic text-muted-foreground">No corrective action yet.</p>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                  {canManage ? <ResponsibleEdit id={f.id} value={f.responsible} /> : f.responsible || "—"}
                </td>
                <td className="whitespace-nowrap px-3 py-3">
                  {(() => {
                    const dl = deadlineTag(f.target, f.status);
                    return (
                      <div className="flex flex-col gap-1">
                        {canManage ? (
                          <TargetDateEdit id={f.id} isoDate={formatTargetDate(f.target)} />
                        ) : (
                          <span className="text-xs text-muted-foreground">{formatTargetDate(f.target) || f.target || "—"}</span>
                        )}
                        {dl && dl.kind !== "later" && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${dl.cls}`}>{dl.label}</span>}
                      </div>
                    );
                  })()}
                </td>
                <td className="px-3 py-3">
                  {canManage ? (
                    <StatusSelect id={f.id} status={f.status} />
                  ) : (
                    <Badge tone={f.status === "CLOSED" ? "success" : f.status === "IN_PROGRESS" ? "warning" : "danger"}>{TMSA_FINDING_STATUS_LABELS[f.status]}</Badge>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-3">{canManage && <DeleteFindingButton id={f.id} code={f.code} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
