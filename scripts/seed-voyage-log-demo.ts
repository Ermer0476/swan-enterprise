/**
 * One-off: loads the last ~3 months (Oct-Dec 2025) of real voyage data from
 * the fleet's own Voyage Analysis BTsolve Excel workbook (Bwek Beauty) into
 * VoyageLog rows, so the Vessel Tracker UI can be demoed against real
 * numbers instead of synthetic data. Reads a pre-extracted JSON dump
 * (/tmp/voyage_rows.json, produced from the source .xlsx via openpyxl —
 * not committed, not depended on by `npm run db:seed`) rather than parsing
 * the Excel directly, since this script only ever needs to run once.
 *
 * Column order (0-indexed), from the "Voyage Input Data" sheet:
 * 0 Date, 1 Voy No., 2 Route/Port Name, 3 Vessel Movement, 4 Ballast/Ladden,
 * 5 Speed instruction, 6 From, 7 To, 8 Steaming Time(Hr), 9 Steaming
 * Distance, 10 Obs Speed, 11 M/E Speed, 12 R.P.M., 13 SLIP, 14 Beaufort
 * Scale, 15 Port Stay (hrs), 16 Off hire Duration, 17 F.O BOIL, 18 F.O. M/E,
 * 19 F.O Total, 20 D.O BLR, 21 D.O. M/E, 22 D.O. A/E, 23 D.O Total.
 *
 * Rerun: `npx tsx scripts/seed-voyage-log-demo.ts` — idempotent, deletes any
 * previously-seeded rows for this vessel/date-range first.
 */
import fs from "fs";
import { prisma } from "../lib/prisma";
import type { VoyageReportType, VesselTrackerStatus, VesselLadenState, EngineOrder } from "../lib/generated/prisma";

type Dump = { headers: string[]; rows: (string | number | null)[][] };

// "Full Speed" > "Eco Speed" > "Slow steaming" in descending order of
// planned sea speed — the closest fit onto the app's 4-tier Engine Order,
// which this specific workbook's simpler 3-value column doesn't spell out
// as granularly. A judgment call, not a value taken from the file.
const ENGINE_ORDER_MAP: Record<string, EngineOrder> = {
  "Full Speed": "NORMAL_STEAMING",
  "Eco Speed": "SLOW_STEAMING",
  "Slow steaming": "SUPER_SLOW_STEAMING",
};

// The Python dump's timestamps are naive ISO strings ("2025-10-01T00:00:00",
// no "Z"/offset) — plain `new Date(iso)` parses those as LOCAL time, which
// silently shifts every date by the runner's UTC offset (a full day earlier
// in Manila, UTC+8). Parsing the components directly and building via
// Date.UTC keeps every stored date/time exactly what the sheet said,
// independent of whatever timezone this script happens to run under.
function parseNaiveIsoAsUtc(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(iso);
  if (!m) throw new Error(`Unparseable timestamp: ${iso}`);
  const [, y, mo, d, h, mi, s] = m;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)));
}

function num(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const dump: Dump = JSON.parse(fs.readFileSync("/tmp/voyage_rows.json", "utf-8"));

  const company = await prisma.company.findFirstOrThrow();
  const vessel = await prisma.vessel.findFirstOrThrow({ where: { name: "Bwek Beauty" } });
  const officeUser = await prisma.user.findFirstOrThrow({ where: { email: "marine@swanshipping.com" } });

  const dates = dump.rows.map((r) => parseNaiveIsoAsUtc(String(r[0])));
  const from = new Date(Math.min(...dates.map((d) => d.getTime())));
  const to = new Date(Math.max(...dates.map((d) => d.getTime())));

  const deleted = await prisma.voyageLog.deleteMany({
    where: { companyId: company.id, vesselId: vessel.id, date: { gte: from, lte: to } },
  });
  console.log(`Cleared ${deleted.count} previously-seeded rows for ${vessel.name} in range.`);

  let underwayStreak = 0;
  const data = dump.rows.map((row, i) => {
    const movement = String(row[3]);
    const isUnderway = movement === "Underway";
    const prevMovement = i > 0 ? String(dump.rows[i - 1]![3]) : null;
    const nextMovement = i < dump.rows.length - 1 ? String(dump.rows[i + 1]![3]) : null;

    let reportType: VoyageReportType;
    if (!isUnderway) {
      reportType = "IN_PORT";
      underwayStreak = 0;
    } else {
      underwayStreak++;
      if (prevMovement !== "Underway") reportType = "DEPARTURE";
      else if (nextMovement !== "Underway") reportType = "ARRIVAL";
      else reportType = "NOON_AT_SEA";
    }

    const speedInstruction = row[5] ? String(row[5]).trim() : null;
    const vesselStatus: VesselTrackerStatus = isUnderway ? "SAILING" : "IN_PORT";
    const ladenState: VesselLadenState = String(row[4]).trim().toUpperCase().startsWith("LAD") ? "LADEN" : "BALLAST";

    return {
      companyId: company.id,
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
      doBoilerMt: num(row[20]),
      doMainEngineMt: num(row[21]),
      doAuxEngineMt: num(row[22]),
      doTotalMt: num(row[23]),
      remarks: null,
      createdBy: officeUser.id,
      updatedBy: officeUser.id,
    };
  });

  const result = await prisma.voyageLog.createMany({ data });
  console.log(`Inserted ${result.count} voyage log rows for ${vessel.name} (${from.toISOString().slice(0, 10)} to ${to.toISOString().slice(0, 10)}).`);
}

main().finally(() => prisma.$disconnect());
