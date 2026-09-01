import type { LucideIcon } from "lucide-react";
import {
  Skull,
  Accessibility,
  UserRound,
  CalendarX,
  UserCog,
  Stethoscope,
  ShieldAlert,
  ShieldCheck,
  Clock3,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type ExposureTotals = {
  fat: number;
  ptd: number;
  ppd: number;
  lwc: number;
  rwc: number;
  mtc: number;
  lti: number;
  trc: number;
  totalHours: number;
  ltif: number;
  trcf: number;
};

const COUNT_TILES: {
  key: keyof Pick<ExposureTotals, "fat" | "ptd" | "ppd" | "lwc" | "rwc" | "mtc">;
  code: string;
  caption: string;
  icon: LucideIcon;
  color: string;
  bg: string;
}[] = [
  { key: "fat", code: "FAT", caption: "Fatalities", icon: Skull, color: "text-danger", bg: "bg-danger/10" },
  { key: "ptd", code: "PTD", caption: "Permanent Total Disability", icon: Accessibility, color: "text-warning", bg: "bg-warning/10" },
  { key: "ppd", code: "PPD", caption: "Permanent Partial Disability", icon: UserRound, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" },
  { key: "lwc", code: "LWC", caption: "Lost Workday Case", icon: CalendarX, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-500/10" },
  { key: "rwc", code: "RWC", caption: "Restricted Work Case", icon: UserCog, color: "text-success", bg: "bg-success/10" },
  { key: "mtc", code: "MTC", caption: "Medical Treatment Case", icon: Stethoscope, color: "text-accent", bg: "bg-accent/10" },
];

function fmtFreq(n: number): string {
  return n.toFixed(2);
}

function Tile({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 min-w-[7rem] flex-col gap-0.5 rounded-lg border border-border p-2.5">{children}</div>;
}

function TileHeader({ icon: Icon, code, color, bg }: { icon: LucideIcon; code: string; color: string; bg: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("flex h-5 w-5 items-center justify-center rounded-full", bg)}>
        <Icon className={cn("h-3 w-3", color)} />
      </span>
      <span className="text-[0.65rem] font-semibold tracking-wide text-muted-foreground">{code}</span>
    </div>
  );
}

export function ExposureSummaryTiles({ totals, actions }: { totals: ExposureTotals; actions?: React.ReactNode }) {
  return (
    <Card className="p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Exposure Summary Overview</h3>
        {actions}
      </div>
      <div className="flex flex-wrap gap-2">
        {COUNT_TILES.map((t) => (
          <Tile key={t.key}>
            <TileHeader icon={t.icon} code={t.code} color={t.color} bg={t.bg} />
            <div className={cn("text-lg font-bold tabular-nums", t.color)}>{totals[t.key]}</div>
            <div className="text-[0.65rem] text-muted-foreground">{t.caption}</div>
          </Tile>
        ))}
        <Tile>
          <TileHeader icon={ShieldAlert} code="LTI" color="text-accent" bg="bg-accent/10" />
          <div className="text-lg font-bold tabular-nums text-accent">{totals.lti}</div>
          <div className="text-[0.65rem] text-muted-foreground">Lost Time Injuries</div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums text-accent">{fmtFreq(totals.ltif)}</div>
          <div className="text-[0.65rem] text-muted-foreground">LTIF</div>
        </Tile>
        <Tile>
          <TileHeader icon={ShieldCheck} code="TRC" color="text-accent" bg="bg-accent/10" />
          <div className="text-lg font-bold tabular-nums text-accent">{totals.trc}</div>
          <div className="text-[0.65rem] text-muted-foreground">Total Recordable Cases</div>
          <div className="mt-0.5 text-sm font-semibold tabular-nums text-accent">{fmtFreq(totals.trcf)}</div>
          <div className="text-[0.65rem] text-muted-foreground">TRCF</div>
        </Tile>
        <Tile>
          <TileHeader icon={Clock3} code="TOTAL HOURS" color="text-foreground" bg="bg-muted" />
          <div className="text-lg font-bold tabular-nums">{totals.totalHours.toLocaleString()}</div>
          <div className="text-[0.65rem] text-muted-foreground">Total Exposure Hours</div>
        </Tile>
      </div>
    </Card>
  );
}
