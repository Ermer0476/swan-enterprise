"use client";

import { useState, useTransition } from "react";
import { saveDefectRemarksAction, type ActionResult } from "@/features/defects/actions";
import { AutoGrowInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function DefectRemarksForm({
  defectId,
  kind,
  value,
  editable,
  placeholder,
}: {
  defectId: string;
  kind: "vessel" | "office";
  value: string;
  editable: boolean;
  placeholder: string;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [remarks, setRemarks] = useState(value);

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("defectId", defectId);
    fd.set("kind", kind);
    fd.set("value", remarks);
    startTransition(async () => {
      const res: ActionResult = await saveDefectRemarksAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  if (!editable) {
    return <p className="whitespace-pre-wrap text-sm">{value || "—"}</p>;
  }

  return (
    <div className="space-y-2">
      <AutoGrowInput value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder={placeholder} />
      <Button variant="outline" onClick={save} disabled={pending}>
        {pending ? "Saving…" : "Save remarks"}
      </Button>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
