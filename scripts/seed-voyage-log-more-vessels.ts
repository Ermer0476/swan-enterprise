/**
 * Same pattern as seed-voyage-log-demo.ts (see that file for column-order
 * notes), extended to loop over multiple vessels — Amaury Neyrand,
 * Esmeralda, Joseph — each from their own real Voyage Analysis BTsolve
 * workbook, last ~3 months of data present in that particular file.
 * Reads /tmp/voyage_rows_multi.json (pre-extracted via openpyxl, not
 * committed). Rerun: `npx tsx scripts/seed-voyage-log-more-vessels.ts`.
 */
import fs from "fs";
import { prisma } from "../lib/prisma";
import type { VoyageReportType, VesselTrackerStatus, VesselLadenState, EngineOrder } from "../lib/generated/prisma";

type Dump = Record<string, (string | number | null)[][]>;

const ENGINE_ORDER_MAP: Record<string, EngineOrder> = {
  "Full Speed": "NORMAL_STEAMING",
  "Eco Speed": "SLOW_STEAMING",
  "Slow steaming": "SUPER_SLOW_STEAMING",
};

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseNaiveIsoAsUtc(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(iso);
  if (!m) throw new Error(`Unparseable timestamp: ${iso}`);
  const [, y, mo, d, h, mi, s] = m;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
}

async function seedVessel(vesselName: string, rows: (string | number | null)[][], companyId: string, officeUserId: string) {
  if (rows.length === 0) {
    console.log(`Skipping ${vesselName} — no rows`);
    return;
  }
  const vessel = await prisma.vessel.findFirstOrThrow({ where: { name: vesselName } });

  const dates = rows.map((r) => parseNaiveIsoAsUtc(String(r[0])));
  const from = new Date(Math.min(...dates.map((d) => d.getTime())));
  const to = new Date(Math.max(...dates.map((d) => d.getTime())));

  const deleted = await prisma.voyageLog.deleteMany({
    where: { companyId, vesselId: vessel.id, date: { gte: from, lte: to } },
  });
  console.log(`${vesselName}: cleared ${deleted.count} previously-seeded rows in range.`);

  const data = rows.map((row, i) => {
    const movement = String(row[3]);
    const isUnderway = movement === "Underway";
    const prevMovement = i > 0 ? String(rows[i - 1]![3]) : null;
    const nextMovement = i < rows.length - 1 ? String(rows[i + 1]![3]) : null;

    let reportType: VoyageReportType;
    if (!isUnderway) {
      reportType = "IN_PORT";
    } else if (prevMovement !== "Underway") {
      reportType = "DEPARTURE";
    } else if (nextMovement !== "Underway") {
      reportType = "ARRIVAL";
    } else {
      reportType = "NOON_AT_SEA";
    }

    const speedInstruction = row[5] ? String(row[5]).trim() : null;
    const vesselStatus: VesselTrackerStatus = isUnderway ? "SAILING" : "IN_PORT";
    const ladenState: VesselLadenState = String(row[4]).trim().toUpperCase().startsWith("LAD") ? "LADEN" : "BALLAST";

    return {
      companyId,
      vesselId: vessel.id,
      date: parseNaiveIsoAsUtc(String(row[0])),
      voyageNo: row[1] != null ? String(row[1]) : null,
      fromPort: String(row[2] ?? "").trim() || null,
      reportType,
      vesselStatus,
      ladenState,
      engineOrder: speedInstruction ? (ENGINE_ORDER_MAP[speedInstruction] ?? null) : null,
      periodFrom: row[6] ? parseNaiveIsoAsUtc(String(row[6])) : null,
      periodTo: row[7] ? parseNaiveIsoAsUtc(String(row[7])) : null,
      steamingTimeHrs: num(row[8]),
      steamingDistanceNm: num(row[9]),
      obsSpeedKn: num(row[10]),
      meSpeedKn: num(row[11]),
      rpm: num(row[12]),
      slipPct: num(row[13]),
      beaufortScale: null, // source column is free text ("< 4"), not numeric
      portStayHrs: num(row[15]),
      offHireHrs: num(row[16]),
      foBoilerMt: num(row[17]),
      foMainEngineMt: num(row[18]),
      foTotalMt: num(row[19]),
      foRobMt: null,
      doBoilerMt: num(row[20]),
      doMainEngineMt: num(row[21]),
      doAuxEngineMt: num(row[22]),
      doTotalMt: num(row[23]),
      doRobMt: null,
      remarks: null,
      createdBy: officeUserId,
      updatedBy: officeUserId,
    };
  });

  const result = await prisma.voyageLog.createMany({ data });
  console.log(`${vesselName}: inserted ${result.count} rows (${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}).`);
}

async function main() {
  const dump: Dump = JSON.parse(fs.readFileSync("/tmp/voyage_rows_multi.json", "utf-8"));
  const company = await prisma.company.findFirstOrThrow();
  const officeUser = await prisma.user.findFirstOrThrow({ where: { email: "marine@swanshipping.com" } });

  for (const [vesselName, rows] of Object.entries(dump)) {
    await seedVessel(vesselName, rows, company.id, officeUser.id);
  }
}

main().finally(() => prisma.$disconnect());
