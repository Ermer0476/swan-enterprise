import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR + 1 - i);
const QUARTERS = [
  { value: "1", label: "Q1 (Jan–Mar)" },
  { value: "2", label: "Q2 (Jan–Jun)" },
  { value: "3", label: "Q3 (Jan–Sep)" },
  { value: "4", label: "Q4 (Jan–Dec)" },
] as const;

/** Year+Quarter reporting-date picker for Quarterly-review-frequency KPI
 * dashboards (Exposure Hours, Incident, ...). Submits `year`/`quarter` as
 * plain GET search params — no year/quarter selected means "current, as of
 * today," matching each dashboard's live default view. The page resolves
 * these into a reportingDate (via lib/kpi-period.ts's quarterEndDate,
 * clamped to today) and passes it into its own KPI formula. */
export function ReportingPeriodSelect({
  defaultYear,
  defaultQuarter,
  extraFields,
}: {
  defaultYear?: string;
  defaultQuarter?: string;
  extraFields?: React.ReactNode;
}) {
  return (
    <form className="flex flex-wrap items-end gap-2">
      {extraFields}
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Year</label>
        <Select name="year" defaultValue={defaultYear ?? ""} className="w-28">
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-1">
        <label className="text-xs text-muted-foreground">Quarter</label>
        <Select name="quarter" defaultValue={defaultQuarter ?? ""} className="w-44">
          <option value="">Current (as of today)</option>
          {QUARTERS.map((q) => (
            <option key={q.value} value={q.value}>
              {q.label}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit">Apply</Button>
    </form>
  );
}
