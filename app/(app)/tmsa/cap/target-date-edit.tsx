"use client";

import { useState, useTransition } from "react";
import { updateFindingTargetAction } from "@/features/tmsa/actions";
import { Input } from "@/components/ui/input";

/** Inline date box for a finding's target. Empty when there is no real date. */
export function TargetDateEdit({ id, isoDate }: { id: string; isoDate: string }) {
  const [val, setVal] = useState(isoDate);
  const [pending, start] = useTransition();

  const onChange = (next: string) => {
    setVal(next);
    const fd = new FormData();
    fd.set("id", id);
    fd.set("target", next);
    start(() => updateFindingTargetAction(fd));
  };

  return <Input type="date" value={val} disabled={pending} onChange={(e) => onChange(e.target.value)} className={`h-8 w-36 text-xs ${pending ? "opacity-50" : ""}`} />;
}
