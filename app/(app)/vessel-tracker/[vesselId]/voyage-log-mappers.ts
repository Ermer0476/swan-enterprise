import type { VoyageLogRow, EntryDiscrepancy } from "@/features/vessel-tracker/queries";
import type { VoyageLogRowView } from "./voyage-log-table";
import type { VoyageEntryDefaults } from "./voyage-entry-form";

/** Raw DB row → the table's display shape. Shared by the list page (one
 * call per row) and the dedicated Edit page (one call for the single entry
 * being edited), so both stay in sync with whatever fields the table
 * actually needs instead of drifting apart. */
export function toRowView(r: VoyageLogRow, discrepancy: EntryDiscrepancy | null): VoyageLogRowView {
  return {
    id: r.id,
    discrepancy,
    date: r.date.toISOString().slice(0, 10),
    voyageNo: r.voyageNo,
    reportType: r.reportType,
    vesselStatus: r.vesselStatus,
    ladenState: r.ladenState,
    engineOrder: r.engineOrder,
    steamingTimeHrs: r.steamingTimeHrs,
    obsSpeedKn: r.obsSpeedKn,
    meSpeedKn: r.meSpeedKn,
    rpm: r.rpm,
    slipPct: r.slipPct,
    beaufortScale: r.beaufortScale,
    portStayHrs: r.portStayHrs,
    totalPortStayHrs: r.totalPortStayHrs,
    offHireHrs: r.offHireHrs,

    fromPort: r.fromPort,
    nextPort: r.nextPort,
    course: r.course,
    zoneDescription: r.zoneDescription,
    reportTimeLocal: r.reportTimeLocal,
    position: r.position,
    draftFwdM: r.draftFwdM,
    draftAftM: r.draftAftM,
    draftMeanM: r.draftMeanM,

    distanceRunNm: r.distanceRunNm,
    totalDistanceRunNm: r.totalDistanceRunNm,
    dtgNextPortNm: r.dtgNextPortNm,
    totalSteamingTimeHrs: r.totalSteamingTimeHrs,
    distanceLogNm: r.distanceLogNm,
    generalAvgSpeedKn: r.generalAvgSpeedKn,
    engineDistanceNm: r.engineDistanceNm,
    totalEngineDistanceNm: r.totalEngineDistanceNm,
    generalAvgEngineSpeedKn: r.generalAvgEngineSpeedKn,
    weatherCondition: r.weatherCondition,
    generalAvgSlipPct: r.generalAvgSlipPct,
    barometer: r.barometer,
    exhaustTempUnit: r.exhaustTempUnit,
    exhaustGasTemp: r.exhaustGasTemp,

    etaNextPortDate: r.etaNextPortDate ? r.etaNextPortDate.toISOString().slice(0, 10) : null,
    etaNextPortTime: r.etaNextPortTime,
    etaNextPortZd: r.etaNextPortZd,

    cargoOnboard: r.cargoOnboard,
    cargoToDiscLoaded: r.cargoToDiscLoaded,
    blQuantity: r.blQuantity,
    cargoTemp: r.cargoTemp,
    agentName: r.agentName,
    agentTel: r.agentTel,
    agentFax: r.agentFax,
    agentEmail: r.agentEmail,
    agentAddress: r.agentAddress,
    deckDeptReport: r.deckDeptReport,
    engineDeptReport: r.engineDeptReport,
    statementOfFacts: r.statementOfFacts,
    master: r.master,
    chiefEngineer: r.chiefEngineer,

    remarks: r.remarks,
    bunkers: r.bunkers.map((b) => ({ grade: b.grade, previous: b.previous, consumed: b.consumed, received: b.received, rob: b.rob })),
  };
}

/** Table row view → the entry form's string-ified defaults, for the Edit
 * page. */
export function toEntryDefaults(r: VoyageLogRowView): VoyageEntryDefaults {
  const num = (v: number | null) => (v == null ? "" : String(v));
  const str = (v: string | null) => v ?? "";
  const bunker: VoyageEntryDefaults["bunker"] = {};
  for (const b of r.bunkers) {
    bunker[b.grade] = { previous: num(b.previous), received: num(b.received), rob: num(b.rob) };
  }
  return {
    entryId: r.id,
    date: r.date,
    voyageNo: r.voyageNo ?? "",
    reportType: r.reportType,
    vesselStatus: r.vesselStatus,
    ladenState: r.ladenState,
    engineOrder: r.engineOrder ?? "",
    steamingTimeHrs: num(r.steamingTimeHrs),
    obsSpeedKn: num(r.obsSpeedKn),
    meSpeedKn: num(r.meSpeedKn),
    rpm: num(r.rpm),
    slipPct: num(r.slipPct),
    beaufortScale: num(r.beaufortScale),
    portStayHrs: num(r.portStayHrs),
    totalPortStayHrs: num(r.totalPortStayHrs),
    offHireHrs: num(r.offHireHrs),

    fromPort: str(r.fromPort),
    nextPort: str(r.nextPort),
    course: str(r.course),
    zoneDescription: str(r.zoneDescription),
    reportTimeLocal: str(r.reportTimeLocal),
    position: str(r.position),
    draftFwdM: num(r.draftFwdM),
    draftAftM: num(r.draftAftM),
    draftMeanM: num(r.draftMeanM),

    distanceRunNm: num(r.distanceRunNm),
    totalDistanceRunNm: num(r.totalDistanceRunNm),
    dtgNextPortNm: num(r.dtgNextPortNm),
    totalSteamingTimeHrs: num(r.totalSteamingTimeHrs),
    distanceLogNm: num(r.distanceLogNm),
    generalAvgSpeedKn: num(r.generalAvgSpeedKn),
    engineDistanceNm: num(r.engineDistanceNm),
    totalEngineDistanceNm: num(r.totalEngineDistanceNm),
    generalAvgEngineSpeedKn: num(r.generalAvgEngineSpeedKn),
    weatherCondition: str(r.weatherCondition),
    generalAvgSlipPct: num(r.generalAvgSlipPct),
    barometer: num(r.barometer),
    exhaustTempUnit: str(r.exhaustTempUnit),
    exhaustGasTemp: str(r.exhaustGasTemp),

    etaNextPortDate: str(r.etaNextPortDate),
    etaNextPortTime: str(r.etaNextPortTime),
    etaNextPortZd: str(r.etaNextPortZd),

    cargoOnboard: str(r.cargoOnboard),
    cargoToDiscLoaded: str(r.cargoToDiscLoaded),
    blQuantity: num(r.blQuantity),
    cargoTemp: str(r.cargoTemp),
    agentName: str(r.agentName),
    agentTel: str(r.agentTel),
    agentFax: str(r.agentFax),
    agentEmail: str(r.agentEmail),
    agentAddress: str(r.agentAddress),
    deckDeptReport: str(r.deckDeptReport),
    engineDeptReport: str(r.engineDeptReport),
    statementOfFacts: str(r.statementOfFacts),
    master: str(r.master),
    chiefEngineer: str(r.chiefEngineer),
    bunker,

    remarks: r.remarks ?? "",
  };
}
