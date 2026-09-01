"use client";

import { useMemo, useState } from "react";
import { Select } from "@/components/ui/input";
import { SpeedPerVoyageChart, type VoyageSpeedPoint } from "@/components/vessel-tracker/speed-voyage-chart";

type LadenFilter = "all" | "LADEN" | "BALLAST";

/** Laden/Ballast toggle for the Average Speed per Voyage chart — a laden
 * leg and a ballast leg run at genuinely different speeds for the same
 * vessel, so mixing both in one line makes neither trend readable once a
 * voyage list has more than a couple of each. Filtering client-side here
 * (the full point set is already on the page) rather than a server round
 * trip, since it's just hiding points already fetched, not a new query. */
export function SpeedVoyageFilter({ points }: { points: VoyageSpeedPoint[] }) {
  const [filter, setFilter] = useState<LadenFilter>("all");

  const filtered = useMemo(() => (filter === "all" ? points : points.filter((p) => p.ladenState === filter)), [points, filter]);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Select value={filter} onChange={(e) => setFilter(e.target.value as LadenFilter)} className="w-32" aria-label="Filter by laden state">
          <option value="all">All</option>
          <option value="LADEN">Laden</option>
          <option value="BALLAST">Ballast</option>
        </Select>
      </div>
      <SpeedPerVoyageChart points={filtered} />
    </div>
  );
}
