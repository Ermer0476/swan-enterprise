"use client";

import { useState, useTransition } from "react";
import { updateKpiStatusAction } from "@/features/tmsa/actions";
import type { TmsaComplianceStatusValue } from "@/features/tmsa/schema";

/** Segmented Yes/No control that saves on click. */
export function KpiStatusToggle({ id, status }: { id: string; status: TmsaComplianceStatusValue }) {
  const [val, setVal] = useState<TmsaComplianceStatusValue>(status === "NO" ? "NO" : "YES");
  const [pending, start] = useTransition();

  const set = (next: TmsaComplianceStatusValue) => {
    if (next === val || pending) return;
    setVal(next);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("status", next);
    start(() => updateKpiStatusAction(fd));
  };

  const base = "px-3 py-1 text-xs font-semibold transition-colors focus:outline-none";
  return (
    <div className={`inline-flex shrink-0 overflow-hidden rounded-full ring-1 ring-border ${pending ? "opacity-50" : ""}`}>
      <button type="button" onClick={() => set("YES")} className={`${base} ${val === "YES" ? "bg-success text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}>
        Yes
      </button>
      <button type="button" onClick={() => set("NO")} className={`${base} ${val === "NO" ? "bg-danger text-white" : "bg-card text-muted-foreground hover:bg-muted"}`}>
        No
      </button>
    </div>
  );
}
