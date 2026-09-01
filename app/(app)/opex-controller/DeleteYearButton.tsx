"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteVesselYear } from "./actions";

export default function DeleteYearButton({ vesselId, monthYear, label }: {
  vesselId: string; monthYear: string; label: string;
}) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (confirm(`Delete all OPEX data for ${label}? This cannot be undone.`)) {
          start(() => deleteVesselYear(vesselId, monthYear));
        }
      }}
      className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 disabled:opacity-50"
    >
      <Trash2 className="h-3.5 w-3.5" /> {pending ? "…" : "Delete"}
    </button>
  );
}
