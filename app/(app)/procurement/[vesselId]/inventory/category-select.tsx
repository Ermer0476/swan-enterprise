"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";
import { STORES_CATEGORY_LABELS, type StoresCategoryValue } from "@/features/procurement/schema";

// Same "uncontrolled + key reset" jump-navigation pattern as ElementSelect in
// tmsa/element/[elementCode]/ — the category chip row got too wide with all
// 13 categories, so this collapses it to one dropdown.
export function CategorySelect({
  vesselId,
  department,
  current,
  categories,
}: {
  vesselId: string;
  department: string;
  current: StoresCategoryValue | null;
  categories: readonly StoresCategoryValue[];
}) {
  const router = useRouter();
  // Built here (not passed as a prop) — a function can't cross the
  // server/client boundary, so the href is composed from plain data instead.
  const base = `/procurement/${vesselId}/inventory?department=${department}`;

  return (
    <Select
      key={current ?? "ALL"}
      defaultValue={current ?? "ALL"}
      onChange={(e) => router.push(e.target.value === "ALL" ? base : `${base}&category=${e.target.value}`)}
      className="w-56"
      aria-label="Filter by category"
    >
      <option value="ALL">All Categories</option>
      {categories.map((c) => (
        <option key={c} value={c}>
          {STORES_CATEGORY_LABELS[c]}
        </option>
      ))}
    </Select>
  );
}
