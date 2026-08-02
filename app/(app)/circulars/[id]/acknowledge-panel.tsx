"use client";

import { useTransition, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { acknowledgeCircularAction } from "@/features/circulars/actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export type AcknowledgementRow = {
  id: string;
  recipientLabel: string;
  acknowledgedAt: string | null; // ISO
  acknowledgedByName: string | null;
};

export function AcknowledgePanel({
  circularId,
  rows,
  myRowId,
}: {
  circularId: string;
  rows: AcknowledgementRow[];
  myRowId: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const myRow = rows.find((r) => r.id === myRowId);

  function acknowledge() {
    setError(null);
    const fd = new FormData();
    fd.set("circularId", circularId);
    startTransition(async () => {
      const res = await acknowledgeCircularAction(fd);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-3">
      {myRow && !myRow.acknowledgedAt && (
        <div className="flex items-center justify-between rounded-md border border-dashed border-border p-3">
          <p className="text-sm">This circular is on your distribution list — has it been read?</p>
          <Button size="sm" onClick={acknowledge} disabled={pending}>
            {pending ? "Saving…" : "Acknowledge"}
          </Button>
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No distribution recipients recorded.</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                {r.acknowledgedAt ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground" />
                )}
                <span>{r.recipientLabel}</span>
              </div>
              {r.acknowledgedAt ? (
                <Badge tone="success">Acknowledged {formatDate(r.acknowledgedAt)}</Badge>
              ) : (
                <Badge tone="warning">Pending</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
