"use client";

import { useState, useTransition } from "react";
import { deleteFindingAction } from "@/features/tmsa/actions";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/** Delete an audit observation/finding, with a confirm dialog. */
export function DeleteFindingButton({ id, code }: { id: string; code: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title={`Delete ${code}`} className="text-sm font-medium text-danger hover:underline">
        Delete
      </button>
      <ConfirmDialog
        open={open}
        title={`Delete ${code}?`}
        description="This audit finding will be removed from the CAP tracker."
        confirming={pending}
        onConfirm={() => start(async () => {
          await deleteFindingAction(id);
          setOpen(false);
        })}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
