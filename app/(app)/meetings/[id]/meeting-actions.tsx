"use client";

import { useState, useTransition } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import {
  reportMeetingAction,
  revertMeetingToDraftAction,
  type ActionResult,
} from "@/features/committee-meetings/actions";
import { Button } from "@/components/ui/button";

function run(
  meetingId: string,
  action: (fd: FormData) => Promise<ActionResult>,
  startTransition: (fn: () => void | Promise<void>) => void,
  setError: (e: string | null) => void,
) {
  setError(null);
  const fd = new FormData();
  fd.set("meetingId", meetingId);
  startTransition(async () => {
    const res = await action(fd);
    if (!res.ok) setError(res.error);
  });
}

/** Vessel-only: submits a Draft (or a reverted, revised meeting) for office review. */
export function ReportMeetingButton({ meetingId }: { meetingId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" onClick={() => run(meetingId, reportMeetingAction, startTransition, setError)} disabled={pending}>
        {pending ? "Reporting…" : "Report Meeting"} <ArrowRight className="h-4 w-4" />
      </Button>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}

/** Vessel-only: pulls a Reported/Closed meeting back into full edit — refNo and office comments stay untouched. */
export function RevertMeetingButton({ meetingId }: { meetingId: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function submit() {
    if (!confirm("Revert this meeting to Draft so you can edit it? You'll need to Report it again for the office to see your changes.")) return;
    run(meetingId, revertMeetingToDraftAction, startTransition, setError);
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" onClick={submit} disabled={pending}>
        <RotateCcw className="h-4 w-4" /> {pending ? "Reverting…" : "Revert to Draft"}
      </Button>
      {error && <p className="text-sm text-danger" role="alert">{error}</p>}
    </div>
  );
}
