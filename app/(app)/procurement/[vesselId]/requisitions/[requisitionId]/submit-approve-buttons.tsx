"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitForMasterApprovalAction, masterApproveRequisitionAction } from "@/features/procurement/actions";
import { Button } from "@/components/ui/button";

export function SubmitForApprovalButton({ requisitionId }: { requisitionId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await submitForMasterApprovalAction(requisitionId);
          router.refresh();
        })
      }
    >
      {pending ? "Submitting…" : "Submit for Master Approval"}
    </Button>
  );
}

export function MasterApproveButton({ requisitionId }: { requisitionId: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setErrorState] = useState<string | null>(null);

  return (
    <div>
      <Button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await masterApproveRequisitionAction(requisitionId);
            if (!result.ok) {
              setErrorState(result.error);
              return;
            }
            router.refresh();
          })
        }
      >
        {pending ? "Approving…" : "Approve as Master"}
      </Button>
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
    </div>
  );
}
