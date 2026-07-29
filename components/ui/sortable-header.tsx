"use client";

import { ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SortDir } from "@/lib/use-sortable-rows";

/**
 * Clickable <th> with a sort-direction arrow — used by every sortable list
 * table (paired with useSortableRows). Reusable as new modules adopt sorting.
 */
export function SortableHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onSort,
  className,
}: {
  label: string;
  sortKey: string;
  activeKey: string | null;
  dir: SortDir;
  onSort: (key: string) => void;
  className?: string;
}) {
  const active = activeKey === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      className={cn(
        "cursor-pointer select-none px-4 py-2.5 font-medium hover:text-foreground",
        active && "text-foreground",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {active &&
          (dir === 1 ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          ))}
      </span>
    </th>
  );
}
