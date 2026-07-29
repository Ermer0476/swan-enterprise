"use client";

import { useMemo, useState } from "react";

export type SortDir = 1 | -1;

/**
 * Generic client-side row sorting — click a column key to sort ascending,
 * click again to reverse. Reusable across every list page's table: pass a
 * `getValue` that maps (row, key) to a comparable string/number/Date for
 * whichever keys that table supports sorting on.
 */
export function useSortableRows<T>(
  rows: T[],
  getValue: (row: T, key: string) => string | number | Date,
) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(1);

  const sorted = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = getValue(a, sortKey);
      const bv = getValue(b, sortKey);
      if (av instanceof Date && bv instanceof Date) {
        return sortDir * (av.getTime() - bv.getTime());
      }
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir * (av - bv);
      }
      return (
        sortDir *
        String(av).localeCompare(String(bv), undefined, {
          numeric: true,
          sensitivity: "base",
        })
      );
    });
  }, [rows, sortKey, sortDir, getValue]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  return { sorted, sortKey, sortDir, toggleSort };
}
