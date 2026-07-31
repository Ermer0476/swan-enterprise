import {
  BarChart3,
  HeartPulse,
  ClipboardList,
  AlertOctagon,
  FolderOpen,
  Clock,
  CheckCircle2,
  Timer,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { IncidentKpis } from "@/features/incidents/queries";

function toneClasses(tone: "neutral" | "success" | "warning" | "danger") {
  switch (tone) {
    case "success":
      return "bg-success/10 text-success";
    case "warning":
      return "bg-warning/10 text-warning";
    case "danger":
      return "bg-danger/10 text-danger";
    default:
      return "bg-muted text-accent";
  }
}

function KpiCard({
  label,
  value,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  icon: typeof BarChart3;
  tone?: "neutral" | "success" | "warning" | "danger";
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between pt-5">
        <div>
          <div className="text-2xl font-semibold tabular-nums">{value}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{label}</div>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toneClasses(tone)}`}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

// TMSA Element 6 (Incident Investigation & Analysis) looks for exactly this
// shape of evidence: injury counts by OCIMF classification, an investigation
// backlog that isn't growing stale, and corrective actions tracked to
// close-out — not just a raw incident count.
export function IncidentKpiStrip({ kpis }: { kpis: IncidentKpis }) {
  const year = new Date().getFullYear();
  const capaLabel = kpis.capaClosureRate === null ? "—" : `${kpis.capaClosureRate}%`;
  const capaTone = kpis.capaClosureRate === null ? "neutral" : kpis.capaClosureRate >= 80 ? "success" : kpis.capaClosureRate >= 50 ? "warning" : "danger";
  const avgDaysLabel = kpis.avgDaysToClose === null ? "—" : `${kpis.avgDaysToClose}d`;

  return (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
      <KpiCard label={`Total Incidents (${year})`} value={kpis.totalYtd} icon={BarChart3} />
      <KpiCard label={`Lost Time Injuries (${year})`} value={kpis.lti} icon={HeartPulse} tone={kpis.lti > 0 ? "warning" : "success"} />
      <KpiCard label={`Total Recordable Cases (${year})`} value={kpis.trc} icon={ClipboardList} />
      <KpiCard label={`Fatalities (${year})`} value={kpis.fatalities} icon={AlertOctagon} tone={kpis.fatalities > 0 ? "danger" : "success"} />
      <KpiCard label="Open Investigations" value={kpis.openCount} icon={FolderOpen} />
      <KpiCard
        label={`Overdue (>${30}d open)`}
        value={kpis.overdueCount}
        icon={Clock}
        tone={kpis.overdueCount > 0 ? "danger" : "success"}
      />
      <KpiCard label="CAPA Closure Rate" value={capaLabel} icon={CheckCircle2} tone={capaTone} />
      <KpiCard label={`Avg. Days to Close (${year})`} value={avgDaysLabel} icon={Timer} />
    </div>
  );
}
