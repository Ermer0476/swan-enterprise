"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";

// Same "uncontrolled + key reset" jump-navigation pattern as CategorySelect
// on the Inventory Ledger page — narrows the grid to one Sub Category at a
// time instead of scrolling past every group card (IMO Stickers alone runs
// to 13 sub-categories, well over a hundred items combined).
export function SubGroupFilterSelect({
  vesselId,
  department,
  category,
  current,
  subGroups,
}: {
  vesselId: string;
  department: string;
  category: string | null;
  current: string | null;
  subGroups: string[];
}) {
  const router = useRouter();
  const base = `/procurement/${vesselId}/inventory/update?department=${department}${category ? `&category=${category}` : ""}`;

  return (
    <Select
      key={current ?? "ALL"}
      defaultValue={current ?? "ALL"}
      onChange={(e) => router.push(e.target.value === "ALL" ? base : `${base}&subGroup=${encodeURIComponent(e.target.value)}`)}
      className="w-64"
      aria-label="Filter by sub category"
    >
      <option value="ALL">All Sub Category</option>
      {subGroups.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </Select>
  );
}
