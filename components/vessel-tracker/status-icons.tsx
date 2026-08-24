import { Ship, Waves, Umbrella, Anchor, Warehouse, Droplet } from "lucide-react";
import type {
  VesselTrackerStatusValue,
  LadenStateValue,
  EngineOrderValue,
} from "@/features/vessel-tracker/schema";
import {
  VESSEL_TRACKER_STATUS_LABELS,
  LADEN_STATE_LABELS,
  ENGINE_ORDER_LABELS,
} from "@/features/vessel-tracker/schema";
import { cn } from "@/lib/utils";

// Solid, distinct colors per status/state — deliberately not relying on
// emoji glyphs (render tiny/faint and inconsistently across platforms,
// and "Sailing"/"Sheltering" previously shared the same glyph, making them
// indistinguishable at calendar-grid size). Each hue below is chosen to
// stay distinguishable at a glance, including for common color-blindness
// types — paired with a different icon shape as a second cue, not color
// alone.
const VESSEL_STATUS_CONFIG: Record<VesselTrackerStatusValue, { icon: typeof Ship; className: string }> = {
  SAILING: { icon: Ship, className: "bg-blue-600" },
  DRIFTING: { icon: Waves, className: "bg-cyan-600" },
  SHELTERING: { icon: Umbrella, className: "bg-purple-600" },
  ANCHORING: { icon: Anchor, className: "bg-slate-600" },
  IN_PORT: { icon: Warehouse, className: "bg-teal-700" },
};

const LADEN_STATE_CONFIG: Record<LadenStateValue, { className: string }> = {
  LADEN: { className: "bg-red-600" },
  BALLAST: { className: "bg-slate-400" },
};

// Same red/amber/orange/green convention as the office's existing Vessel
// Tracker dashboard legend (Normal/Slow/Super Slow/Fast Steaming).
export const ENGINE_ORDER_DOT_CLASS: Record<EngineOrderValue, string> = {
  NORMAL_STEAMING: "bg-red-500",
  SLOW_STEAMING: "bg-amber-400",
  SUPER_SLOW_STEAMING: "bg-orange-500",
  FAST_STEAMING: "bg-green-500",
};

function IconBadge({ icon: Icon, className, size, label }: { icon: typeof Ship; className: string; size: number; label: string }) {
  return (
    <span
      title={label}
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full text-white", className)}
      style={{ width: size, height: size }}
    >
      <Icon style={{ width: size * 0.6, height: size * 0.6 }} strokeWidth={2.5} />
    </span>
  );
}

export function VesselStatusBadge({ status, size = 20 }: { status: VesselTrackerStatusValue; size?: number }) {
  const cfg = VESSEL_STATUS_CONFIG[status];
  return <IconBadge icon={cfg.icon} className={cfg.className} size={size} label={VESSEL_TRACKER_STATUS_LABELS[status]} />;
}

export function LadenStateBadge({ state, size = 20 }: { state: LadenStateValue; size?: number }) {
  const cfg = LADEN_STATE_CONFIG[state];
  return <IconBadge icon={Droplet} className={cfg.className} size={size} label={LADEN_STATE_LABELS[state]} />;
}

export function EngineOrderDot({ order, size = 14 }: { order: EngineOrderValue; size?: number }) {
  return (
    <span
      title={ENGINE_ORDER_LABELS[order]}
      className={cn("inline-block shrink-0 rounded-full ring-2 ring-white dark:ring-background", ENGINE_ORDER_DOT_CLASS[order])}
      style={{ width: size, height: size }}
    />
  );
}

export function VesselStatusLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
      {(Object.keys(VESSEL_STATUS_CONFIG) as VesselTrackerStatusValue[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <VesselStatusBadge status={s} size={16} /> {VESSEL_TRACKER_STATUS_LABELS[s]}
        </span>
      ))}
      {(Object.keys(LADEN_STATE_CONFIG) as LadenStateValue[]).map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5">
          <LadenStateBadge state={s} size={16} /> {LADEN_STATE_LABELS[s]}
        </span>
      ))}
      {(Object.keys(ENGINE_ORDER_DOT_CLASS) as EngineOrderValue[]).map((o) => (
        <span key={o} className="inline-flex items-center gap-1.5">
          <EngineOrderDot order={o} size={12} /> {ENGINE_ORDER_LABELS[o]}
        </span>
      ))}
    </div>
  );
}
