"use client";

import { useState, useTransition } from "react";
import { updateKpiRemarksAction } from "@/features/tmsa/actions";
import { AutoGrowInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Bold SMS procedure / form codes (e.g. ADM-27, REG-03, CRW-08, R-AS-011).
const PROC_RE = /\b[A-Z]{1,4}(?:-[A-Z]{1,4})?-\d{1,3}\b/g;
function withBoldProcedures(text: string) {
  const parts = text.split(PROC_RE);
  const codes = text.match(PROC_RE) ?? [];
  const out: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    out.push(<span key={`t${i}`}>{p}</span>);
    if (i < codes.length)
      out.push(
        <strong key={`c${i}`} className="font-semibold">
          {codes[i]}
        </strong>,
      );
  });
  return out;
}

/** Editable narrative response for a single KPI. */
export function KpiNarrative({ id, remarks, gap }: { id: string; remarks: string | null; gap: boolean }) {
  const [saved, setSaved] = useState(remarks ?? "");
  const [val, setVal] = useState(remarks ?? "");
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();

  const save = () => {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("remarks", val);
    start(async () => {
      await updateKpiRemarksAction(fd);
      setSaved(val.trim());
      setEditing(false);
    });
  };

  if (editing) {
    return (
      <div>
        <AutoGrowInput value={val} onChange={(e) => setVal(e.target.value)} autoFocus placeholder="Enter your response / narrative for this KPI…" />
        <div className="mt-2 flex items-center gap-2">
          <Button type="button" size="sm" onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={pending}
            onClick={() => {
              setVal(saved);
              setEditing(false);
            }}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {saved ? (
        <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{withBoldProcedures(saved)}</p>
      ) : (
        <p className="text-sm italic text-muted-foreground">No narrative response recorded{gap ? " — open gap." : "."}</p>
      )}
      <button type="button" onClick={() => setEditing(true)} className="mt-2 text-xs font-medium text-accent hover:underline">
        {saved ? "Edit response" : "Add response"}
      </button>
    </div>
  );
}
