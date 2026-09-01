"use client";

import { useState, useTransition } from "react";
import { Pencil } from "lucide-react";
import { updateScheduleItemFrequencyAction } from "@/features/schedule/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/** Office-only inline editor for a drill/familiarization item's required
 * interval — click the frequency to edit it in place. One frequency per
 * item, shared by the whole fleet (not per-vessel), so it's edited once
 * here rather than per matrix. */
export function FrequencyEditor({
  scheduleItemId,
  frequencyLabel,
  frequencyDays,
}: {
  scheduleItemId: string;
  frequencyLabel: string | null;
  frequencyDays: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(frequencyLabel ?? "");
  const [days, setDays] = useState(frequencyDays != null ? String(frequencyDays) : "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group flex items-center gap-1 text-left hover:text-foreground"
        title="Edit frequency"
      >
        <span>{frequencyLabel ?? "—"}</span>
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-60" />
      </button>
    );
  }

  function save() {
    setError(null);
    const fd = new FormData();
    fd.set("scheduleItemId", scheduleItemId);
    fd.set("frequencyLabel", label);
    fd.set("frequencyDays", days);
    startTransition(async () => {
      const res = await updateScheduleItemFrequencyAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Failed to save");
        return;
      }
      setEditing(false);
    });
  }

  return (
    <div className="flex min-w-40 flex-col gap-1">
      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="e.g. Once in a month"
        disabled={isPending}
        className="h-7 text-xs"
      />
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={1}
          value={days}
          onChange={(e) => setDays(e.target.value)}
          placeholder="Days"
          disabled={isPending}
          className="h-7 w-16 text-xs"
        />
        <Button type="button" size="sm" className="h-7 px-2 text-xs" disabled={isPending} onClick={save}>
          Save
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={isPending}
          onClick={() => {
            setLabel(frequencyLabel ?? "");
            setDays(frequencyDays != null ? String(frequencyDays) : "");
            setError(null);
            setEditing(false);
          }}
        >
          Cancel
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
