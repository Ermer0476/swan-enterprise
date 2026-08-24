"use client";

import { useRouter } from "next/navigation";
import { VoyageEntryForm, type VoyageEntryDefaults, type BunkerRobSnapshot, type VoyageCumulativeTotals } from "../../../voyage-entry-form";

export function EditEntryClient({
  vesselId,
  defaults,
  robHistory,
  voyageCumulative,
  previousSailingReportDtg,
}: {
  vesselId: string;
  defaults: VoyageEntryDefaults;
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
      robHistory={robHistory}
      voyageCumulative={voyageCumulative}
      previousSailingReportDtg={previousSailingReportDtg}
      onSuccess={backToLog}
      onCancel={backToLog}
    />
  );
}
