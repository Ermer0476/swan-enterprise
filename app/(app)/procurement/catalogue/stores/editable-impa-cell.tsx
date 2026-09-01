"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateStoresItemImpaCodeAction, type ActionResult } from "@/features/procurement/actions";
import { Input } from "@/components/ui/input";

const initial: ActionResult = { ok: false, error: null };

// IMPA numbers get reassigned/corrected from time to time in real fleet
// practice, so this needs to stay editable even after the item's already in
// the catalogue — not just at creation time.
export function EditableImpaCell({ itemId, impaCode }: { itemId: string; impaCode: string | null }) {
  const [state, action, pending] = useActionState(updateStoresItemImpaCodeAction, initial);
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) setEditing(false);
  }, [state.ok]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="rounded px-1 py-0.5 font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
        title="Click to edit IMPA code"
      >
        {impaCode ?? "—"}
      </button>
    );
  }

  return (
    <form action={action} className="flex items-center gap-1">
      <input type="hidden" name="itemId" value={itemId} />
      <Input
        ref={inputRef}
        name="impaCode"
        defaultValue={impaCode ?? ""}
        autoFocus
        placeholder="IMPA"
        className="h-7 w-24 font-mono text-xs"
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={(e) => {
          // Let a Save-button click still register before the field blurs away.
          if (!e.relatedTarget?.closest("form")) setEditing(false);
        }}
      />
      <button type="submit" disabled={pending} className="text-xs text-accent hover:underline disabled:opacity-50">
        {pending ? "…" : "Save"}
      </button>
      {state.error && <span className="text-xs text-danger">{state.error}</span>}
    </form>
  );
}
