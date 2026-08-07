"use client";

import { useTransition } from "react";
import { setScheduleApplicabilityAction } from "@/features/schedule/actions";

export function NaToggle({
  vesselId,
  scheduleItemId,
  checked,
}: {
  vesselId: string;
  scheduleItemId: string;
  checked: boolean;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <input
      type="checkbox"
      className="h-3.5 w-3.5 accent-muted-foreground disabled:opacity-50"
      defaultChecked={checked}
      disabled={isPending}
      title="Not applicable to this vessel"
      onChange={(e) => {
        const notApplicable = e.currentTarget.checked;
        const fd = new FormData();
        fd.set("vesselId", vesselId);
        fd.set("scheduleItemId", scheduleItemId);
        fd.set("notApplicable", String(notApplicable));
        startTransition(async () => {
          await setScheduleApplicabilityAction(fd);
        });
      }}
    />
  );
}
