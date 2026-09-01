import Link from "next/link";
import { requirePermission } from "@/lib/rbac";
import { getLiveMatrix, listScoreYears, getMatrixForYear, type MatrixRow } from "@/features/tmsa/queries";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TmsaTabs } from "./tmsa-tabs";

// Rating out of 4 → traffic light tone.
function ratingCls(r: number) {
  if (r >= 3) return "bg-success/10 text-success";
  if (r >= 2) return "bg-warning/10 text-warning";
  return "bg-danger/10 text-danger";
}
// Per-stage cell: cleared (yes≥req) green, partial amber, none red.
function stageCls(yes: number, req: number) {
  if (req === 0) return "text-muted-foreground";
  if (yes >= req) return "bg-success/10 text-success";
  if (yes > 0) return "bg-warning/10 text-warning";
  return "bg-danger/10 text-danger";
}

export default async function TmsaHubPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const user = await requirePermission("tmsa:read");
  const sp = await searchParams;

  const years = await listScoreYears(user.companyId);
  const isLive = !sp.year || sp.year === "live" || !years.includes(Number(sp.year));
  const selectedYear = isLive ? null : Number(sp.year);

  const rows: MatrixRow[] = isLive ? await getLiveMatrix(user.companyId) : await getMatrixForYear(user.companyId, selectedYear!);

  if (rows.length === 0) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader title="TMSA Hub" description="TMSA 3 self-assessment score tracker." />
        <TmsaTabs active="matrix" />
        <Card>
          <CardContent className="pt-8 pb-8 text-center text-sm text-muted-foreground">No TMSA data yet.</CardContent>
        </Card>
      </div>
    );
  }

  const sum = (f: (r: MatrixRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  const totalYes = sum((r) => r.s1Yes + r.s2Yes + r.s3Yes + r.s4Yes);
  const totalReq = sum((r) => r.reqTotal);
  const overallRating = totalReq ? (totalYes / totalReq) * 4 : 0;
  const tmsaScore = rows.length ? sum((r) => r.stageCleared) / rows.length : 0;

  const StageHead = ({ n }: { n: number }) => (
    <th colSpan={2} className="border-l border-border px-2 py-2 text-center font-medium">
      Stage {n}
    </th>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="TMSA Hub" description="TMSA 3 self-assessment score tracker — per element & stage." />
      <TmsaTabs active="matrix" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">View:</span>
        <Link href="/tmsa">
          <Button type="button" variant={isLive ? "default" : "outline"} size="sm">
            ● Live
          </Button>
        </Link>
        {years.map((y) => (
          <Link key={y} href={`/tmsa?year=${y}`}>
            <Button type="button" variant={y === selectedYear ? "default" : "outline"} size="sm">
              {y}
            </Button>
          </Link>
        ))}
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-muted-foreground">Overall Rating</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {overallRating.toFixed(2)}
              <span className="text-base font-normal text-muted-foreground"> / 4</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-muted-foreground">Elements Tracked</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-muted-foreground">TMSA Score</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {tmsaScore.toFixed(2)}
              <span className="text-base font-normal text-muted-foreground"> / 4</span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-muted-foreground">Total KPIs (Yes / Req)</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {totalYes}
              <span className="text-base font-normal text-muted-foreground"> / {totalReq}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-md border border-border bg-card">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th rowSpan={2} className="px-3 py-2 font-medium">
                El.
              </th>
              <th rowSpan={2} className="px-3 py-2 font-medium">
                Element
              </th>
              <StageHead n={1} />
              <StageHead n={2} />
              <StageHead n={3} />
              <StageHead n={4} />
              <th rowSpan={2} className="border-l border-border px-3 py-2 text-center font-medium">
                Rating
              </th>
              <th rowSpan={2} className="px-3 py-2 text-center font-medium">
                Cleared
              </th>
            </tr>
            <tr className="border-b border-border text-[11px] uppercase">
              {[1, 2, 3, 4].flatMap((n) => [
                <th key={`y${n}`} className="border-l border-border px-2 py-1 text-center font-normal">
                  Yes
                </th>,
                <th key={`r${n}`} className="px-2 py-1 text-center font-normal">
                  Req
                </th>,
              ])}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => {
              const stages: [number, number][] = [
                [r.s1Yes, r.s1Req],
                [r.s2Yes, r.s2Req],
                [r.s3Yes, r.s3Req],
                [r.s4Yes, r.s4Req],
              ];
              return (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-semibold">
                    <Link href={`/tmsa/element/${r.elementCode}`} className="text-accent hover:underline">
                      {r.elementCode}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/tmsa/element/${r.elementCode}`} className="text-muted-foreground hover:text-accent hover:underline">
                      {r.title}
                    </Link>
                  </td>
                  {stages.map(([yes, req], i) => (
                    <td key={i} colSpan={2} className={`border-l border-border px-2 py-2 text-center font-medium ${stageCls(yes, req)}`}>
                      {yes} / {req}
                    </td>
                  ))}
                  <td className="border-l border-border px-3 py-2 text-center">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ratingCls(r.rating)}`}>{r.rating.toFixed(2)}</span>
                  </td>
                  <td className="px-3 py-2 text-center font-semibold">{r.stageCleared}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Green = stage cleared (Yes ≥ Req) · Amber = partial · Red = none. Rating = total Yes ÷ total Req × 4.{" "}
        {isLive
          ? "Live view — computed from the current per-KPI Yes/No answers; toggling a KPI updates this instantly."
          : `Source: imported TMSA 3 Score (${selectedYear}) snapshot.`}
      </p>
    </div>
  );
}
