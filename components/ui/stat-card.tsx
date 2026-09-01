import type { LucideIcon } from "lucide-react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type StatDelta = { percent: number; tone: "good" | "bad" | "neutral" };

export function StatCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  unit,
  delta,
  deltaCaption = "vs prev.",
  deltaTitle = "vs previous period",
}: {
  icon: LucideIcon;
  iconClassName?: string;
  label: string;
  value: string;
  unit?: string;
  delta?: StatDelta;
  deltaCaption?: string;
  deltaTitle?: string;
}) {
  const up = (delta?.percent ?? 0) >= 0;
  return (
    <Card className="min-w-[10rem] flex-1 p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 text-xs font-medium uppercase tracking-wide text-muted-foreground" title={label}>
          {label}
        </div>
        <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", iconClassName)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums">{value}</span>
        {unit && <span className="whitespace-nowrap text-[0.65rem] text-muted-foreground">{unit}</span>}
      </div>
      {delta && (
        <div
          className={cn(
            "mt-1 flex items-center gap-1 whitespace-nowrap text-xs font-medium",
            delta.tone === "good" && "text-success",
            delta.tone === "bad" && "text-danger",
            delta.tone === "neutral" && "text-muted-foreground",
          )}
          title={`${Math.abs(delta.percent).toFixed(1)}% ${deltaTitle}`}
        >
          {up ? <ArrowUp className="h-3 w-3 shrink-0" /> : <ArrowDown className="h-3 w-3 shrink-0" />}
          {Math.abs(delta.percent).toFixed(1)}% {deltaCaption}
        </div>
      )}
    </Card>
  );
}
