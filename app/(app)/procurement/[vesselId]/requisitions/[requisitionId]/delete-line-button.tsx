"use client";

import { useTransition } from "react";
import { deleteRequisitionLineAction } from "@/features/procurement/actions";

export function DeleteLineButton({ lineId }: { lineId: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => deleteRequisitionLineAction(lineId))}
      className="text-xs font-medium text-danger hover:underline disabled:opacity-50"
    >
      {pending ? "…" : "Remove"}
    </button>
  );
}
