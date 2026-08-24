"use client";

import { useState, useTransition } from "react";
import { updateFindingStatusAction } from "@/features/tmsa/actions";
import { TMSA_FINDING_STATUSES, TMSA_FINDING_STATUS_LABELS, type TmsaFindingStatusValue } from "@/features/tmsa/schema";

const cls: Record<TmsaFindingStatusValue, string> = {
  CLOSED: "bg-success/10 text-success ring-success/20",
  IN_PROGRESS: "bg-warning/10 text-warning ring-warning/20",
  OPEN: "bg-danger/10 text-danger ring-danger/20",
};

/** Inline, save-on-change status editor used in the CAP table. */
export function StatusSelect({ id, status }: { id: string; status: TmsaFindingStatusValue }) {
  const [val, setVal] = useState(status);
  const [pending, start] = useTransition();

  return (
    <select
      value={val}
      disabled={pending}
      aria-label="Status"
      onChange={(e) => {
        const next = e.target.value as TmsaFindingStatusValue;
        setVal(next);
        const fd = new FormData();
        fd.set("id", id);
        fd.set("status", next);
        start(() => updateFindingStatusAction(fd));
      }}
      className={`cursor-pointer rounded-full border-0 px-2 py-1 text-xs font-semibold ring-1 focus:outline-none focus:ring-2 ${cls[val]} ${pending ? "opacity-50" : ""}`}
    >
      {TMSA_FINDING_STATUSES.map((s) => (
        <option key={s} value={s}>
          {TMSA_FINDING_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
