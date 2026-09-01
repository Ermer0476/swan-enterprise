"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markForQuotationAction, markForDeliveryAction, closeRequisitionAction, type ActionResult } from "@/features/procurement/actions";
import { Input, Label, AutoGrowInput } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const INITIAL: ActionResult = { ok: false, error: null };

export function MarkForQuotationButton({ requisitionId }: { requisitionId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await markForQuotationAction(requisitionId);
            if (!result.ok) {
              setError(result.error);
              return;
            }
            router.refresh();
          })
        }
      >
        {pending ? "Marking…" : "Mark for Quotation"}
      </Button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}

export function MarkForDeliveryForm({ requisitionId }: { requisitionId: string }) {
  const [state, action, pending] = useActionState(markForDeliveryAction, INITIAL);

  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="requisitionId" value={requisitionId} />
      <div className="space-y-1.5">
        <Label htmlFor="deliveryPort">Delivery Port</Label>
        <Input id="deliveryPort" name="deliveryPort" required placeholder="e.g. Batangas" className="w-56" />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Marking…" : "Mark for Delivery"}
      </Button>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}

/** Closes out a requisition stuck at FOR_QUOTATION or FOR_DELIVERY — the
 * supplier never quoted/shipped, or the office is cancelling it outright.
 * Collapsed behind a trigger (matching the rest of this app's "+ Add…"
 * pattern) since it's a final, not-everyday action that deserves a reason
 * rather than a bare confirm click. */
export function CloseRequisitionForm({ requisitionId }: { requisitionId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [state, action, pending] = useActionState(closeRequisitionAction, INITIAL);

  if (!expanded) {
    return (
      <button type="button" onClick={() => setExpanded(true)} className="text-sm text-danger hover:underline">
        Close requisition — not everything is coming
      </button>
    );
  }

  return (
    <form action={action} className="space-y-2 rounded-md border border-danger/30 bg-danger/5 p-3">
      <input type="hidden" name="requisitionId" value={requisitionId} />
      <Label htmlFor="closeReason">Why is this closing?</Label>
      <AutoGrowInput id="closeReason" name="closeReason" required placeholder="e.g. Supplier never sent a quotation for this item" className="w-full" />
      <p className="text-xs text-muted-foreground">
        Whatever&apos;s already been received stays in inventory. If the vessel still needs the rest, they&apos;ll raise a new requisition.
      </p>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="danger" size="sm" disabled={pending}>
          {pending ? "Closing…" : "Close Requisition"}
        </Button>
        <button type="button" onClick={() => setExpanded(false)} className="text-xs text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
      {state.error && <p className="text-xs text-danger">{state.error}</p>}
    </form>
  );
}
