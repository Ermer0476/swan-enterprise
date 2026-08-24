"use client";

import { useRouter } from "next/navigation";
import { VoyageEntryForm, type VoyageEntryDefaults, type BunkerRobSnapshot, type VoyageCumulativeTotals } from "../voyage-entry-form";
import type { BunkerGradeValue } from "@/features/vessel-tracker/schema";

export function NewEntryClient({
  vesselId,
  defaults,
  carryForward,
  previousRob,
  avgConsumed,
  robHistory,
  voyageCumulative,
  previousSailingReportDtg,
}: {
  vesselId: string;
  defaults: VoyageEntryDefaults;
  carryForward?: Partial<VoyageEntryDefaults>;
  previousRob?: Partial<Record<BunkerGradeValue, number>>;
  avgConsumed?: Partial<Record<BunkerGradeValue, number>>;
  robHistory?: BunkerRobSnapshot[];
  voyageCumulative?: VoyageCumulativeTotals;
  previousSailingReportDtg?: number | null;
}) {
  const router = useRouter();
  const backToLog = () => router.push(`/vessel-tracker/${vesselId}`);

  return (
    <VoyageEntryForm
      vesselId={vesselId}
      defaults={defaults}
      carryForward={carryForward}
      previousRob={previousRob}
      avgConsumed={avgConsumed}
      robHistory={robHistory}
      voyageCumulative={voyageCumulative}
      previousSailingReportDtg={previousSailingReportDtg}
      onSuccess={backToLog}
      onCancel={backToLog}
    />
  );
}
