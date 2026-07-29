"use client";

import { useState, useTransition } from "react";
import { Send, Check, X, Archive } from "lucide-react";
import {
  submitAction,
  decideAction,
  archiveAction,
  type ActionResult,
} from "@/features/sms-manual/actions";
import { Button } from "@/components/ui/button";

type Caps = {
  canSubmit: boolean;
  canDecide: boolean;
  canArchive: boolean;
};

export function DocumentActions({
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
  const [comment, setComment] = useState("");

  function handle(fn: () => Promise<ActionResult>, clear = false) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error);
      else if (clear) setComment("");
    });
  }

  function submit() {
    const fd = new FormData();
    fd.set("documentId", documentId);
    handle(() => submitAction(fd));
  }
  function archive() {
    const fd = new FormData();
    fd.set("documentId", documentId);
    handle(() => archiveAction(fd));
  }
  function decide(decision: "APPROVE" | "REJECT") {
    handle(() => decideAction(documentId, decision, comment), true);
  }

  const showDecision = status === "IN_REVIEW" && caps.canDecide;
  const nothingToDo =
    !(status === "DRAFT" && caps.canSubmit) &&
    !showDecision &&
    !(status !== "ARCHIVED" && caps.canArchive);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {status === "DRAFT" && caps.canSubmit && (
          <Button onClick={submit} disabled={pending}>
            <Send className="h-4 w-4" /> Submit for approval
          </Button>
        )}
        {showDecision && (
          <>
            <Button
              variant="success"
              onClick={() => decide("APPROVE")}
              disabled={pending}
            >
              <Check className="h-4 w-4" /> Approve
            </Button>
            <Button
              variant="danger"
              onClick={() => decide("REJECT")}
              disabled={pending}
            >
              <X className="h-4 w-4" /> Reject
            </Button>
          </>
        )}
        {status !== "ARCHIVED" && caps.canArchive && (
          <Button variant="outline" onClick={archive} disabled={pending}>
            <Archive className="h-4 w-4" /> Archive
          </Button>
        )}
      </div>

      {showDecision && (
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional approval / rejection comment"
          className="h-9 w-full max-w-md rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      )}

      {nothingToDo && (
        <p className="text-sm text-muted-foreground">
          {status === "IN_REVIEW"
            ? "Awaiting approval — you are not the approver for the current step."
            : "No actions available to you for this document."}
        </p>
      )}

      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
