"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Archive } from "lucide-react";
import {
  publishRevisionAction,
  archiveAction,
  type ActionResult,
} from "@/features/risk/actions";
import { Button } from "@/components/ui/button";

type Caps = {
  canPublish: boolean;
  canArchive: boolean;
};

/** Office authors and finalizes a Risk Assessment in one step — there's no
 * separate internal review chain, since the office editing it already is
 * the approving authority. "Publish" moves the draft revision straight to
 * APPROVED and makes it the in-force revision. */
export function RiskDocActions({
  documentId,
  status,
  caps,
}: {
  documentId: string;
  status: string;
  caps: Caps;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handle(fn: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
    });
  }

  function publish() {
    const fd = new FormData();
    fd.set("documentId", documentId);
    handle(() => publishRevisionAction(fd));
  }
  function archive() {
    const fd = new FormData();
    fd.set("documentId", documentId);
    handle(() => archiveAction(fd));
  }

  const showPublish = status === "DRAFT" && caps.canPublish;
  const showArchive = status !== "ARCHIVED" && caps.canArchive;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {showPublish && (
          <Button variant="success" onClick={publish} disabled={pending}>
            <CheckCircle2 className="h-4 w-4" /> Publish
          </Button>
        )}
        {showArchive && (
          <Button variant="outline" onClick={archive} disabled={pending}>
            <Archive className="h-4 w-4" /> Archive
          </Button>
        )}
      </div>

      {!showPublish && !showArchive && (
        <p className="text-sm text-muted-foreground">No actions available to you for this document.</p>
      )}

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
