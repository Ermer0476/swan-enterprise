"use client";

import { useState, useTransition } from "react";
import { setDocumentExpiryWarningMonthsAction } from "@/features/vessel-documents/actions";
import { Input } from "@/components/ui/input";

/** Inline "Expiring documents is set to N month(s)" editor — Administrator
 * only (schedule:manage). Read-only text for everyone else. */
export function ExpiryWarningEditor({ months, canEdit }: { months: number; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(months));
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!canEdit) {
    return <span className="font-medium text-accent">{months} month(s)</span>;
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="font-medium text-accent hover:underline"
      >
        {months} month(s)
      </button>
    );
  }

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("months", value);
    startTransition(async () => {
      const res = await setDocumentExpiryWarningMonthsAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Failed to save");
        return;
      }
      setEditing(false);
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <Input
        type="number"
        min={1}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={isPending}
        className="h-7 w-16 text-xs"
      />
      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="text-xs font-medium text-accent hover:underline disabled:opacity-50"
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => {
          setValue(String(months));
          setError(null);
          setEditing(false);
        }}
        disabled={isPending}
        className="text-xs text-muted-foreground hover:underline disabled:opacity-50"
      >
        Cancel
      </button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </span>
  );
}
