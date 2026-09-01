"use client";

import { useRouter } from "next/navigation";
import { Select } from "@/components/ui/input";

/** Jumps straight to another vessel's Voyage Log without going back through
 * the fleet Vessel Tracker page first — the crew/office otherwise had to
 * leave this page, find the vessel again in the calendar or fleet table,
 * then click back in. */
export function VesselSwitcher({ vessels, currentVesselId }: { vessels: { id: string; name: string }[]; currentVesselId: string }) {
  const router = useRouter();

  return (
    <Select
      value={currentVesselId}
      onChange={(e) => router.push(`/vessel-tracker/${e.target.value}`)}
      className="w-56"
      aria-label="Switch vessel"
    >
      {vessels.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name}
        </option>
      ))}
    </Select>
  );
}
