"use client";

import { useActionState, useMemo, useState } from "react";
import { receiveRequisitionLinesAction, type ActionResult } from "@/features/procurement/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const INITIAL: ActionResult = { ok: false, error: null };

type ReceivableLine = {
  id: string;
  label: string;
  unit: string | null;
  qtyExpected: number; // qtyApproved ?? qtyRequested
  qtyReceived: number; // already received so far, across prior deliveries
};

export function ReceiveDeliveryForm({ requisitionId, lines }: { requisitionId: string; lines: ReceivableLine[] }) {
  const [state, action, pending] = useActionState(receiveRequisitionLinesAction, INITIAL);
  const [values, setValues] = useState<Record<string, string>>({});

  const outstanding = useMemo(() => lines.filter((l) => l.qtyReceived < l.qtyExpected), [lines]);

  function setQty(lineId: string, value: string) {
    setValues((prev) => ({ ...prev, [lineId]: value }));
  }

  function submit(formData: FormData) {
    const receivedQtys: Record<string, number> = {};
    for (const l of lines) {
      const raw = values[l.id];
      const qty = raw ? Number(raw) : 0;
      if (qty > 0) receivedQtys[l.id] = qty;
    }
    formData.set("requisitionId", requisitionId);
    formData.set("receivedQtys", JSON.stringify(receivedQtys));
    action(formData);
  }

  if (outstanding.length === 0) {
    return <p className="text-sm text-muted-foreground">Everything on this requisition has already been received.</p>;
  }

  return (
    <form action={submit} className="space-y-3">
      <div className="overflow-x-auto rounded-md border border-border">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">Unit</th>
              <th className="px-3 py-2 font-medium text-right">Expected</th>
              <th className="px-3 py-2 font-medium text-right">Already Received</th>
              <th className="w-32 px-3 py-2 font-medium">Receiving Now</th>
            </tr>
          </thead>
          <tbody>
            {outstanding.map((l) => (
              <tr key={l.id} className="border-b border-border last:border-0">
                <td className="px-3 py-2">{l.label}</td>
                <td className="px-3 py-2 text-muted-foreground">{l.unit ?? "—"}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{l.qtyExpected}</td>
                <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{l.qtyReceived}</td>
                <td className="px-3 py-2">
                  <Input
                    type="number"
                    min={0}
                    max={l.qtyExpected - l.qtyReceived}
                    step="any"
                    value={values[l.id] ?? ""}
                    onChange={(e) => setQty(l.id, e.target.value)}
                    placeholder="0"
                    className="h-8 w-full"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Only fill in what actually arrived this delivery — leave the rest blank if some items are still outstanding. Received quantities post
        straight to inventory.
      </p>
      <Button type="submit" disabled={pending}>
        {pending ? "Recording…" : "Record Receipt"}
      </Button>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
    </form>
  );
}
