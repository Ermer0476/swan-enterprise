import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermission, can } from "@/lib/rbac";
import { getElementKpis, getElementScore, getElementFindingsLight, listElementJumpTargets } from "@/features/tmsa/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { KpiStatusToggle } from "../kpi-status-toggle";
import { KpiNarrative } from "../kpi-narrative";
import { ResponseRevision } from "../response-revision";
import { ElementSelect } from "./element-select";

export default async function ElementKpiPage({
  params,
  searchParams,
}: {
  params: Promise<{ elementCode: string }>;
  searchParams: Promise<{ gaps?: string }>;
}) {
  const user = await requirePermission("tmsa:read");
  const canEdit = can(user, "tmsa:update-kpi");
  const { elementCode: raw } = await params;
  const elementCode = decodeURIComponent(raw);
  const { gaps } = await searchParams;
  const gapsOnly = gaps === "1";

  const [kpisAll, score, findings, elementList] = await Promise.all([
    getElementKpis(user.companyId, elementCode),
    getElementScore(user.companyId, elementCode),
    getElementFindingsLight(user.companyId, elementCode),
    listElementJumpTargets(user.companyId),
  ]);

  if (kpisAll.length === 0) notFound();

  const findingsByCode = new Map<string, { total: number; open: number }>();
  for (const f of findings) {
    if (!f.kpiRef) continue;
    const cur = findingsByCode.get(f.kpiRef) ?? { total: 0, open: 0 };
    cur.total += 1;
    if (f.status !== "CLOSED") cur.open += 1;
    findingsByCode.set(f.kpiRef, cur);
  }
  const elementObsTotal = findings.length;

  const gapCount = kpisAll.filter((k) => k.complianceStatus === "NO").length;
  const kpis = gapsOnly ? kpisAll.filter((k) => k.complianceStatus === "NO") : kpisAll;

  const byStage = new Map<number, typeof kpis>();
  for (const k of kpis) {
    if (!byStage.has(k.stage)) byStage.set(k.stage, []);
    byStage.get(k.stage)!.push(k);
  }
  const stages = [...byStage.keys()].sort((a, b) => a - b);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="TMSA Questionnaire"
        description={`Element ${elementCode} — ${score?.title ?? "TMSA self-assessment KPIs & responses"}`}
      />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">Jump to element:</span>
        {elementList.length > 0 && <ElementSelect current={elementCode} items={elementList} />}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/tmsa" className="text-sm text-accent hover:underline">
          ← Back to Score Matrix
        </Link>
        <span className="text-border">|</span>
        <span className="text-sm text-muted-foreground">
          {kpisAll.length} KPIs · <span className="font-medium text-danger">{gapCount} gaps</span>
          {elementObsTotal > 0 && (
            <>
              {" · "}
              <Link href={`/tmsa/cap?element=${encodeURIComponent(elementCode)}&from=${encodeURIComponent(elementCode)}`} className="font-medium text-warning hover:underline">
                ⚑ {elementObsTotal} audit observation{elementObsTotal > 1 ? "s" : ""}
              </Link>
            </>
          )}
        </span>
        <div className="ml-auto flex gap-1">
          <Link href={`/tmsa/element/${encodeURIComponent(elementCode)}`}>
            <Button type="button" size="sm" variant={!gapsOnly ? "default" : "outline"}>
              All
            </Button>
          </Link>
          <Link href={`/tmsa/element/${encodeURIComponent(elementCode)}?gaps=1`}>
            <Button type="button" size="sm" variant={gapsOnly ? "danger" : "outline"}>
              Gaps only ({gapCount})
            </Button>
          </Link>
        </div>
      </div>

      {stages.map((s) => (
        <section key={s} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">Stage {s}</h2>
          <div className="space-y-3">
            {byStage.get(s)!.map((k) => {
              const gap = k.complianceStatus === "NO";
              const obs = findingsByCode.get(k.code);
              return (
                <Card key={k.id} className={obs ? "border-warning/40" : gap ? "border-danger/30" : undefined}>
                  <CardContent className="pt-4">
                    <div className="mb-2 flex items-start justify-between gap-3">
                      <div>
                        <span className="mr-2 font-mono text-sm font-bold">{k.code}</span>
                        <span className="text-sm font-medium">{k.kpiDescription}</span>
                        {obs && (
                          <Link
                            href={`/tmsa/cap?q=${encodeURIComponent(k.code)}&from=${encodeURIComponent(elementCode)}`}
                            title="This KPI has audit observation(s) — click to view in the CAP tracker"
                            className={`ml-2 inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${
                              obs.open > 0 ? "bg-warning/10 text-warning hover:bg-warning/20" : "bg-success/10 text-success hover:bg-success/20"
                            }`}
                          >
                            ⚑ {obs.total} observation{obs.total > 1 ? "s" : ""}
                            {obs.open > 0 ? ` · ${obs.open} open` : " · closed"}
                          </Link>
                        )}
                      </div>
                      {canEdit ? (
                        <KpiStatusToggle id={k.id} status={k.complianceStatus} />
                      ) : (
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${gap ? "bg-danger/10 text-danger" : "bg-success/10 text-success"}`}>
                          {gap ? "No" : "Yes"}
                        </span>
                      )}
                    </div>

                    {k.bpg && (
                      <div className="mb-3 rounded-md border border-accent/20 bg-accent/5 p-3">
                        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-accent">Best Practice Guidance</p>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{k.bpg}</p>
                      </div>
                    )}

                    <div className="rounded-md border border-border bg-muted/30 p-3">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Company Response</p>
                        {canEdit && <ResponseRevision id={k.id} revision={k.revision} responseState={k.responseState} />}
                      </div>
                      {canEdit ? (
                        <KpiNarrative id={k.id} remarks={k.remarks} gap={gap} />
                      ) : k.remarks ? (
                        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{k.remarks}</p>
                      ) : (
                        <p className="text-sm italic text-muted-foreground">No narrative response recorded{gap ? " — open gap." : "."}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
