import { Label, Select } from "./input";

/**
 * A shipboard login represents one specific vessel (User.vesselId) — letting
 * that account still pick from a free "Vessel" dropdown on every report risks
 * simply choosing the wrong ship. So: shipboard sees their own vessel name as
 * a locked, non-editable field (still submits via a hidden input); everyone
 * else (office) keeps the normal dropdown, since office reports may be about
 * any vessel or none (shore-originated).
 */
export function VesselField({
  vessels,
  isShipboard,
  ownVesselId,
  ownVesselName,
  blankLabel = "— Shore / N/A —",
  required = false,
  label = "Vessel",
}: {
  vessels: { id: string; name: string }[];
  isShipboard: boolean;
  ownVesselId?: string | null;
  ownVesselName?: string | null;
  /** Office dropdown's placeholder option text (disabled+unselectable when `required`, a real blank choice otherwise). */
  blankLabel?: string;
  required?: boolean;
  label?: string;
}) {
  if (isShipboard) {
    return (
      <div className="space-y-1.5">
        <Label>{label}</Label>
        <input type="hidden" name="vesselId" value={ownVesselId ?? ""} />
        <div className="flex h-9 w-full items-center rounded-md border border-input bg-muted px-3 text-sm text-muted-foreground">
          {ownVesselName ?? "— No vessel assigned —"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="vesselId">{label}</Label>
      <Select id="vesselId" name="vesselId" defaultValue="" required={required}>
        <option value="" disabled={required}>{blankLabel}</option>
        {vessels.map((v) => (
          <option key={v.id} value={v.id}>{v.name}</option>
        ))}
      </Select>
    </div>
  );
}
