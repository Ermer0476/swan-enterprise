"use client";

import { useRouter } from "next/navigation";
import { Label, Select } from "@/components/ui/input";

/** Picks which vessel's records to overlay on the reference matrix. Choosing a
 * vessel reloads the matrix with that vessel's current-cycle completion dates;
 * "Reference schedule only" clears back to the blank WK1–WK8 grid. */
export function MatrixVesselPicker({
  vessels,
  selected,
}: {
  vessels: { id: string; name: string }[];
  selected: string;
}) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="matrix-vessel" className="shrink-0 text-sm">
        Show records for
      </Label>
      <Select
        id="matrix-vessel"
        value={selected}
        onChange={(e) => {
          const v = e.target.value;
          router.push(
            v
              ? `/drills/crew-familiarization/matrix?vesselId=${v}`
              : "/drills/crew-familiarization/matrix",
          );
        }}
        className="w-64"
      >
        <option value="">Reference schedule only</option>
        {vessels.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
