/**
 * Seed script — bootstraps a company with the permission catalog, a set of
 * system roles, demo users, the LPG fleet, and a couple of SMS documents so the
 * app is usable immediately after `npm run db:seed`.
 *
 * Idempotent: safe to re-run. Uses upserts keyed on natural keys.
 */
import { PrismaClient, type DepartmentType } from "../lib/generated/prisma";
import bcrypt from "bcryptjs";
import { ALL_PERMISSION_KEYS, PERMISSIONS, permissionModule } from "../lib/permissions";

const prisma = new PrismaClient();

// Master drill checklist (SMS A-EMP-01LPG "Emergency Preparedness Drill
// Monitoring") and familiarization checklist (SMS CK-047(b) "Onboard
// Familiarization Monitoring") — transcribed verbatim from the company's own
// forms. frequencyDays is the parsed interval used for Last/Next-due math;
// null means "as required/applicable" (never flagged overdue).
type ScheduleItemSeed = {
  kind: "DRILL" | "FAMILIARIZATION";
  category: string | null;
  itemNo: string;
  name: string;
  smsReference: string | null;
  frequencyLabel: string | null;
  frequencyDays: number | null;
};

const SCHEDULE_ITEMS: ScheduleItemSeed[] = [
  // ── STATUTORY DRILLS (SMS A-EMP-01LPG) ──────────────────────────────────
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "1.0", name: "Abandon Ship (include the lowering of one conventional lifeboat from stowed position, training on hypothermia, test of emergency lights, closing of watertight doors)", smsReference: "EMP-37 / TRN-03", frequencyLabel: "Once in a month", frequencyDays: 30 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "1.1", name: "Liferaft transfer from port side to starboard side (only for vessel provided with one liferaft)", smsReference: "TRN-03", frequencyLabel: "Once in a month", frequencyDays: 30 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "1.2", name: "Lifeboat 1 (Lowering from stowed position)", smsReference: "TRN-03", frequencyLabel: "Once a month (at least one of the lifeboats be lowered)", frequencyDays: 30 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "1.3", name: "Lifeboat 2 (Lowering from stowed position)", smsReference: "TRN-03", frequencyLabel: "Once a month", frequencyDays: 30 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "2.1", name: "Launching and Maneuvering in the water — (a) Conventional Lifeboats (PORT & STARBOARD lifeboats should be lowered and maneuvered in the water)", smsReference: "TRN-03", frequencyLabel: "Once in 3 months", frequencyDays: 90 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "2.2", name: "(b) Free Fall Lifeboat [drill for boarding order and crane launching only, per TRN-03, 5.2(b)]", smsReference: "TRN-03", frequencyLabel: "Once in 3 months", frequencyDays: 90 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "2.3", name: "(c) Free Fall Lifeboat [simulated launching, per TRN-03, 5.2(c)]", smsReference: "TRN-03", frequencyLabel: "Once in 6 months", frequencyDays: 180 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "2.4", name: "(d) Weekly moving out of conventional lifeboat (not required for freefall lifeboat) — record in LSA Maintenance Log (LG-014)", smsReference: "TRN-03", frequencyLabel: "Weekly", frequencyDays: 7 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "2.5", name: "(e) Rescue Boats [maneuver in the water, per TRN-03, 5.4(a)]", smsReference: "TRN-03", frequencyLabel: "Once a month", frequencyDays: 30 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "2.6", name: "(f) Training in Davit-Launched Liferaft (SOLAS III/19.4.3)", smsReference: "TRN-03", frequencyLabel: "Once in 4 months", frequencyDays: 120 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "3.1", name: "Fire Fighting — (a) Fire in the Accommodation", smsReference: "EMP-30/TRN-02", frequencyLabel: "Once in a month", frequencyDays: 30 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "3.2", name: "(b) Fire in the Engine Room (including training and simulated activation of Fixed CO2 system)", smsReference: "EMP-31/TRN-02", frequencyLabel: "Once in a month", frequencyDays: 30 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "3.3", name: "(c) Fire on Deck (cargo area, paint locker, chemical locker, compressor room; including training in the fixed fire extinguishing system for the space)", smsReference: "EMP-15/21/24", frequencyLabel: "Once in a month", frequencyDays: 30 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "4.0", name: "Oil Spill Response / SMPEP equipment handling & onboard communication", smsReference: "TRN-04", frequencyLabel: "Once in a month", frequencyDays: 30 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "5.0", name: "Emergency Steering", smsReference: "EMP-11/TRN-05", frequencyLabel: "Once in 3 months", frequencyDays: 90 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "6.0", name: "Search and Rescue / MOB Drill / Recovery of Persons From the Water", smsReference: "EMP-04/13", frequencyLabel: "Once in 3 months", frequencyDays: 90 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "7.1", name: "Security — (a) Bomb Search", smsReference: "EMP-16", frequencyLabel: "Once in 3 months", frequencyDays: 90 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "7.2", name: "(b) Piracy Prevention", smsReference: "EMP-16", frequencyLabel: "Once in 3 months", frequencyDays: 90 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "7.3", name: "(c) Stowaway Search", smsReference: "EMP-16", frequencyLabel: "Once in 3 months", frequencyDays: 90 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "7.4", name: "(d) Cyber Security", smsReference: "CSP", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "STATUTORY DRILLS", itemNo: "8.0", name: "Enclosed Space Entry & Rescue", smsReference: "EMP-29/TRN-13", frequencyLabel: "Every 2 months", frequencyDays: 60 },

  // ── NON-STATUTORY DRILL (table-top or incorporated with statutory drills) ──
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "9.0", name: "Bridge Control Failure", smsReference: "EMP-43", frequencyLabel: "6 months", frequencyDays: 180 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "10.0", name: "Collision", smsReference: "EMP-02", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "11.0", name: "Grounding/Flooding", smsReference: "EMP-03", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "12.0", name: "Serious Injury, Acute First Aid (Including Death)", smsReference: "EMP-05/06/07", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "13.0", name: "Failure of Communication", smsReference: "EMP-08", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "14.0", name: "Critical Machinery Failure (M/E, Gen, etc.)", smsReference: "EMP-09/18", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "15.0", name: "Heavy Weather Damage", smsReference: "EMP-10", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "16.0", name: "Failure of Gyro Compass", smsReference: "EMP-12", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "17.0", name: "Salvage and Emergency Towing", smsReference: "EMP-14", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "18.0", name: "Asking for Assistance", smsReference: "EMP-17", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "19.0", name: "Uncontrolled Venting", smsReference: "EMP-19", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "20.0", name: "Jettison of Cargo", smsReference: "EMP-20", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "21.0", name: "Cargo Arm Fracture", smsReference: "EMP-22", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "22.0", name: "Break Away from Jetty", smsReference: "EMP-23", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "23.0", name: "Explosion on Board", smsReference: "EMP-24", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "24.0", name: "Cargo Containment Failure", smsReference: "EMP-25", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "25.0", name: "Gas or Toxic Cargo Release", smsReference: "EMP-26", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "26.0", name: "Structural Failure", smsReference: "EMP-27", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "27.0", name: "Tank Overflow (Cargo/Bunker)", smsReference: "EMP-32", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "28.0", name: "Toxic & Chemical Cargo Release at Sea/Anchor", smsReference: "EMP-33", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "29.0", name: "Hose Burst", smsReference: "EMP-34", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "30.0", name: "Helicopter Operation Training (SMS TRN-14)", smsReference: "EMP-39", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "31.0", name: "Emergency Situation in the Terminal", smsReference: "EMP-40", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "32.0", name: "Cargo Emergency Procedure", smsReference: "EMP-42", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "33.0", name: "Emergency Departure with Sloshing Restriction on Tank Levels", smsReference: "EMP-44", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "34.0", name: "Fire onboard a Nearby Vessel (underway / at anchor / at berth)", smsReference: null, frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "35.0", name: "Excessive List", smsReference: "EMP-46", frequencyLabel: "Yearly", frequencyDays: 365 },
  { kind: "DRILL", category: "NON-STATUTORY DRILL", itemNo: "36.0", name: "SMPEP Complete Plan Drill", smsReference: "SMPEP", frequencyLabel: "Every 3 Years", frequencyDays: 1095 },

  // ── Trainings as required by SMS procedure TRAINING ─────────────────────
  { kind: "DRILL", category: "TRAINING", itemNo: "37.0", name: "Use of SCBA (per TRN-06) — may be done in conjunction with monthly Fire drills", smsReference: "TRN-06", frequencyLabel: "Monthly", frequencyDays: 30 },
  { kind: "DRILL", category: "TRAINING", itemNo: "38.0", name: "Periodical GMDSS Drill (per TRN-11, 4.3) — may be in conjunction with Abandon Ship drills", smsReference: "TRN-11", frequencyLabel: "3 months", frequencyDays: 90 },
  { kind: "DRILL", category: "TRAINING", itemNo: "39.0", name: "Training/Familiarization of type-specific GMDSS Equipment (per TRN-11, 4.2) — record in the GMDSS log", smsReference: "TRN-11", frequencyLabel: "6 Months", frequencyDays: 180 },

  // ── Familiarization (SMS CK-047(b) "Onboard Familiarization Monitoring") ─
  { kind: "FAMILIARIZATION", category: null, itemNo: "1", name: "Cyber Security Plan (CSP 11)", smsReference: "CSP 11", frequencyLabel: "3 months", frequencyDays: 90 },
  { kind: "FAMILIARIZATION", category: null, itemNo: "2", name: "Ballast Water Management Plan (BWMP 13)", smsReference: "BWMP 13", frequencyLabel: "3 months", frequencyDays: 90 },
  { kind: "FAMILIARIZATION", category: null, itemNo: "3", name: "Shipboard Energy Efficiency Management Plan (SEEMP — VIQ 2.4)", smsReference: "SEEMP", frequencyLabel: "3 months", frequencyDays: 90 },
  { kind: "FAMILIARIZATION", category: null, itemNo: "4", name: "Mooring System Management Plan incl. Line Management Plan (MSMP 5.3)", smsReference: "MSMP 5.3", frequencyLabel: "3 months", frequencyDays: 90 },
  { kind: "FAMILIARIZATION", category: null, itemNo: "5", name: "Shipboard Marine Pollution Emergency Plan (SMPEP 6.3)", smsReference: "SMPEP 6.3", frequencyLabel: "3 months", frequencyDays: 90 },
  { kind: "FAMILIARIZATION", category: null, itemNo: "6", name: "Garbage Management Plan (GMP Ch. V)", smsReference: "GMP Ch. V", frequencyLabel: "3 months", frequencyDays: 90 },
  { kind: "FAMILIARIZATION", category: null, itemNo: "7", name: "Crane Operation (VIQ 8.5)", smsReference: "VIQ 8.5", frequencyLabel: "3 months", frequencyDays: 90 },
  { kind: "FAMILIARIZATION", category: null, itemNo: "8", name: "Recovery of Persons from Water", smsReference: null, frequencyLabel: "3 months", frequencyDays: 90 },
  { kind: "FAMILIARIZATION", category: null, itemNo: "9", name: "Guide for Cold Water Survival", smsReference: null, frequencyLabel: "3 months", frequencyDays: 90 },
  { kind: "FAMILIARIZATION", category: null, itemNo: "10", name: "Vessel Hardening Plan (VHP)", smsReference: "VHP", frequencyLabel: "3 months", frequencyDays: 90 },
  { kind: "FAMILIARIZATION", category: null, itemNo: "11", name: "Biofouling Plan, if applicable", smsReference: null, frequencyLabel: "6 months", frequencyDays: 180 },
  { kind: "FAMILIARIZATION", category: null, itemNo: "12", name: "VGP, if applicable", smsReference: "VGP", frequencyLabel: "6 months", frequencyDays: 180 },
  { kind: "FAMILIARIZATION", category: null, itemNo: "13", name: "NTVRP, if applicable", smsReference: "NTVRP", frequencyLabel: "6 months", frequencyDays: 180 },
  { kind: "FAMILIARIZATION", category: null, itemNo: "14", name: "EU MRV Monitoring Plan, if applicable", smsReference: null, frequencyLabel: "6 months", frequencyDays: 180 },
  { kind: "FAMILIARIZATION", category: null, itemNo: "15", name: "iSMS Training / Familiarization for Joined Crew and Ratings", smsReference: null, frequencyLabel: "Monthly", frequencyDays: 30 },
  { kind: "FAMILIARIZATION", category: null, itemNo: "16", name: "Ship to Ship Operation Training", smsReference: null, frequencyLabel: "As required/applicable", frequencyDays: null },
  { kind: "FAMILIARIZATION", category: null, itemNo: "17", name: "Resilience", smsReference: null, frequencyLabel: "Monthly", frequencyDays: 30 },
  { kind: "FAMILIARIZATION", category: null, itemNo: "18", name: "Learning Engagement Tool", smsReference: null, frequencyLabel: "Monthly", frequencyDays: 30 },
  { kind: "FAMILIARIZATION", category: null, itemNo: "19", name: "Reflective Learning", smsReference: null, frequencyLabel: "Monthly", frequencyDays: 30 },
];

// Role → permission grants. Roles are data; adjust freely.
const ROLE_GRANTS: Record<string, { desc: string; perms: string[] }> = {
  Administrator: {
    desc: "Full platform administration",
    perms: [...ALL_PERMISSION_KEYS],
  },
  "QHSE Manager": {
    desc: "Owns the SMS — approves documents; closes safety reports",
    perms: [
      "sms:read", "sms:create", "sms:update", "sms:submit", "sms:approve", "sms:delete",
      "incident:read", "incident:create", "incident:update", "incident:close", "incident:delete",
      "nm:read", "nm:create", "nm:update", "nm:close", "nm:delete",
      // ncr:close is DPA / General Manager only — NCR verification authority.
      "ncr:read", "ncr:create", "ncr:update", "ncr:delete",
      "sire:read", "sire:create", "sire:update", "sire:close", "sire:delete",
      "psc:read", "psc:create", "psc:update", "psc:close", "psc:delete",
      "cdi:read", "cdi:create", "cdi:update", "cdi:close", "cdi:delete",
      "iaudit:read", "iaudit:create", "iaudit:update", "iaudit:close", "iaudit:delete",
      "eaudit:read", "eaudit:create", "eaudit:update", "eaudit:close", "eaudit:delete",
      "meeting:read", "meeting:create", "meeting:update", "meeting:close", "meeting:delete",
      "drill:read", "drill:create", "drill:update", "drill:close", "drill:delete",
      "doc:read", "doc:create", "doc:update", "doc:delete",
      "circular:read", "circular:create", "circular:update", "circular:delete",
      "risk-doc:read", "risk-doc:create", "risk-doc:update", "risk-doc:approve", "risk-doc:archive",
      "defect:read", "defect:create", "defect:update", "defect:delete",
      "vessel:read",
    ],
  },
  "Marine Superintendent": {
    desc: "Authors/submits SMS documents; investigates safety reports & inspections",
    perms: [
      "sms:read", "sms:create", "sms:update", "sms:submit",
      "incident:read", "incident:create", "incident:update",
      "nm:read", "nm:create", "nm:update",
      "ncr:read", "ncr:create", "ncr:update",
      "sire:read", "sire:create", "sire:update",
      "psc:read", "psc:create", "psc:update",
      "cdi:read", "cdi:create", "cdi:update",
      "iaudit:read", "iaudit:create", "iaudit:update",
      "eaudit:read", "eaudit:create", "eaudit:update",
      "meeting:read", "meeting:create", "meeting:update", "meeting:close",
      "drill:read", "drill:create", "drill:update", "drill:close",
      "doc:read", "doc:create", "doc:update",
      "circular:read", "circular:create", "circular:update",
      "risk-doc:read", "risk-doc:create", "risk-doc:update", "risk-doc:approve", "risk-doc:archive",
      "defect:read", "defect:create", "defect:update",
      "vessel:read", "vessel:create", "vessel:update", "vessel:delete",
    ],
  },
  "Ship Officer": {
    desc: "Reads controlled documents; reports safety observations onboard",
    perms: [
      "sms:read",
      "incident:read", "incident:create",
      "nm:read", "nm:create",
      // ncr:create is further gated to senior ranks (Master/C.Off/C.Engr) at
      // the action level — see createNcrAction.
      "ncr:read", "ncr:create",
      "sire:read", "psc:read", "cdi:read",
      "iaudit:read", "eaudit:read",
      // Meetings/Drills/Defects/Risk are logged onboard by any officer;
      // Documents/Circulars are office-issued, so ship side is read-only.
      "meeting:read", "meeting:create", "meeting:update",
      "drill:read", "drill:create", "drill:update",
      "doc:read", "circular:read",
      "risk-doc:read", "risk-doc:execute", "risk-doc:request-revision",
      "defect:read", "defect:create", "defect:update",
      "vessel:read",
    ],
  },
  DPA: {
    desc: "Designated Person Ashore — verifies and closes out non-conformities",
    perms: ["ncr:read", "ncr:update", "ncr:close", "risk-doc:read", "risk-doc:approve", "vessel:read"],
  },
  "General Manager": {
    desc: "Top management — verifies and closes out non-conformities",
    perms: ["ncr:read", "ncr:update", "ncr:close", "risk-doc:read", "risk-doc:approve", "vessel:read"],
  },
};

// Demo users: email → { name, role, department, rank }
const USERS: {
  email: string;
  name: string;
  role: string;
  department: DepartmentType;
  rank?: string;
}[] = [
  { email: "admin@swanshipping.com", name: "System Administrator", role: "Administrator", department: "IT" },
  { email: "qhse@swanshipping.com", name: "Maria Santos", role: "QHSE Manager", department: "QHSE" },
  { email: "marine@swanshipping.com", name: "Juan Dela Cruz", role: "Marine Superintendent", department: "MARINE" },
  // Shipboard logins represent the VESSEL, not whoever currently holds the
  // rank — the Captain rotates, but the account (and everything tied to it,
  // e.g. Committee Meetings' vesselId) shouldn't. One shared login per ship.
  { email: "swanaquarius@swanshipping.com", name: "Swan Aquarius", role: "Ship Officer", department: "SHIPBOARD", rank: "Master" },
  { email: "swanorion@swanshipping.com", name: "Swan Orion", role: "Ship Officer", department: "SHIPBOARD", rank: "Master" },
  { email: "swanlyra@swanshipping.com", name: "Swan Lyra", role: "Ship Officer", department: "SHIPBOARD", rank: "Master" },
  { email: "dpa@swanshipping.com", name: "Capt. Eduardo Villanueva", role: "DPA", department: "MARINE" },
  { email: "gm@swanshipping.com", name: "Roberto Lim", role: "General Manager", department: "EXECUTIVE" },
];

const VESSELS = [
  {
    name: "Swan Aquarius",
    code: "SWA",
    imo: "9700001",
    officialNumber: "PH-2019-04471",
    callSign: "DUA7001",
    mmsi: "548123001",
    flag: "Philippines",
    classificationSociety: "ClassNK",
    yearBuilt: 2015,
    grossTonnage: 12500,
    loa: 149.9,
    breadth: 24.2,
    depth: 12.6,
  },
  {
    name: "Swan Orion",
    code: "ORI",
    imo: "9700002",
    officialNumber: "PH-2020-05512",
    callSign: "DUA7002",
    mmsi: "548123002",
    flag: "Philippines",
    classificationSociety: "Lloyd's Register",
    yearBuilt: 2017,
    grossTonnage: 14800,
    loa: 156.3,
    breadth: 25.0,
    depth: 13.1,
  },
  {
    name: "Swan Lyra",
    code: "LYR",
    imo: "9700003",
    officialNumber: "PH-2021-06033",
    callSign: "DUA7003",
    mmsi: "548123003",
    flag: "Philippines",
    classificationSociety: "DNV",
    yearBuilt: 2019,
    grossTonnage: 16200,
    loa: 161.4,
    breadth: 26.0,
    depth: 13.8,
  },
];

async function main() {
  const password = "swan1234"; // demo password for every seeded user
  const passwordHash = await bcrypt.hash(password, 10);

  // Company
  const company = await prisma.company.upsert({
    where: { code: "SWAN" },
    update: {},
    create: { code: "SWAN", name: "Swan Shipping Corporation" },
  });

  // Permissions catalog
  for (const key of ALL_PERMISSION_KEYS) {
    await prisma.permission.upsert({
      where: { key },
      update: { description: PERMISSIONS[key], module: permissionModule(key) },
      create: {
        key,
        module: permissionModule(key),
        description: PERMISSIONS[key],
      },
    });
  }

  // Roles + grants
  const roleByName: Record<string, string> = {};
  for (const [name, { desc, perms }] of Object.entries(ROLE_GRANTS)) {
    const role = await prisma.role.upsert({
      where: { companyId_name: { companyId: company.id, name } },
      update: { description: desc },
      create: {
        companyId: company.id,
        name,
        description: desc,
        isSystem: true,
      },
    });
    roleByName[name] = role.id;
    // reset + reassign grants
    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });
    const perms_ = await prisma.permission.findMany({
      where: { key: { in: perms } },
      select: { id: true },
    });
    await prisma.rolePermission.createMany({
      data: perms_.map((p) => ({ roleId: role.id, permissionId: p.id })),
    });
  }

  // Users
  let adminId = "";
  for (const u of USERS) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: { fullName: u.name, department: u.department, rank: u.rank ?? null },
      create: {
        companyId: company.id,
        email: u.email,
        fullName: u.name,
        passwordHash,
        department: u.department,
        rank: u.rank ?? null,
      },
    });
    if (u.role === "Administrator") adminId = user.id;
    const roleId = roleByName[u.role];
    if (roleId) {
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId } },
        update: {},
        create: { userId: user.id, roleId },
      });
    }
  }

  // Approval workflow for SMS documents (configurable, admin-editable).
  //   Step 1: QHSE Review     → anyone with the "QHSE Manager" role
  //   Step 2: Management sign-off → anyone with the "Administrator" role
  const smsWorkflow = await prisma.workflowDefinition.upsert({
    where: {
      companyId_key: { companyId: company.id, key: "sms-document-approval" },
    },
    update: { active: true },
    create: {
      companyId: company.id,
      key: "sms-document-approval",
      name: "SMS Document Approval",
      entityType: "SmsDocument",
      description: "Two-step approval chain for controlled SMS documents.",
      active: true,
    },
  });
  await prisma.workflowStep.deleteMany({
    where: { definitionId: smsWorkflow.id },
  });
  await prisma.workflowStep.createMany({
    data: [
      {
        definitionId: smsWorkflow.id,
        order: 1,
        name: "QHSE Review",
        approverType: "ROLE",
        approverRole: "QHSE Manager",
      },
      {
        definitionId: smsWorkflow.id,
        order: 2,
        name: "Management Sign-off",
        approverType: "ROLE",
        approverRole: "Administrator",
      },
    ],
  });

  // Approval workflow for Risk Assessment documents (configurable, admin-editable).
  //   Step 1: QHSE Review     → anyone with the "QHSE Manager" role
  //   Step 2: Management sign-off → anyone with the "Administrator" role
  const riskWorkflow = await prisma.workflowDefinition.upsert({
    where: {
      companyId_key: { companyId: company.id, key: "risk-assessment-approval" },
    },
    update: { active: true },
    create: {
      companyId: company.id,
      key: "risk-assessment-approval",
      name: "Risk Assessment Approval",
      entityType: "RiskAssessmentDocument",
      description: "Two-step approval chain for controlled Risk Assessment documents.",
      active: true,
    },
  });
  await prisma.workflowStep.deleteMany({
    where: { definitionId: riskWorkflow.id },
  });
  await prisma.workflowStep.createMany({
    data: [
      {
        definitionId: riskWorkflow.id,
        order: 1,
        name: "QHSE Review",
        approverType: "ROLE",
        approverRole: "QHSE Manager",
      },
      {
        definitionId: riskWorkflow.id,
        order: 2,
        name: "Management Sign-off",
        approverType: "ROLE",
        approverRole: "Administrator",
      },
    ],
  });

  // Fleet
  for (const v of VESSELS) {
    const particulars = {
      name: v.name,
      code: v.code,
      officialNumber: v.officialNumber,
      callSign: v.callSign,
      mmsi: v.mmsi,
      flag: v.flag,
      classificationSociety: v.classificationSociety,
      yearBuilt: v.yearBuilt,
      grossTonnage: v.grossTonnage,
      loa: v.loa,
      breadth: v.breadth,
      depth: v.depth,
    };
    await prisma.vessel.upsert({
      where: { imo: v.imo },
      update: particulars,
      create: {
        companyId: company.id,
        imo: v.imo,
        type: "LPG Carrier",
        status: "ACTIVE",
        ...particulars,
      },
    });
  }

  // Sample SMS documents
  const samples = [
    {
      code: "ADM-10",
      title: "Management Review Procedure",
      category: "Administration",
      department: "QHSE" as const,
      content:
        "# Management Review\n\nThe SMC shall conduct an annual review of the SMS covering all agenda items defined in ADM-10.",
    },
    {
      code: "MAR-05",
      title: "Navigation Safety Procedure",
      category: "Marine",
      department: "MARINE" as const,
      content:
        "# Navigation Safety\n\nBridge team management, passage planning and watchkeeping requirements per the SMS Manual.",
    },
  ];
  for (const s of samples) {
    const existing = await prisma.smsDocument.findFirst({
      where: { companyId: company.id, code: s.code },
    });
    if (existing) continue;
    await prisma.smsDocument.create({
      data: {
        companyId: company.id,
        code: s.code,
        title: s.title,
        category: s.category,
        department: s.department,
        status: "DRAFT",
        ownerId: adminId || null,
        createdBy: adminId || null,
        revisions: {
          create: {
            companyId: company.id,
            revisionNo: 1,
            changeSummary: "Initial revision",
            content: s.content,
            status: "DRAFT",
            createdBy: adminId || null,
          },
        },
      },
    });
  }

  const firstVessel = await prisma.vessel.findFirst({
    where: { companyId: company.id },
    orderBy: { name: "asc" },
  });

  // Tie each vessel's Ship Officer login to that same vessel — one shared
  // account per ship, keyed by name so it doesn't depend on seeding order.
  const shipVesselLogins: Record<string, string> = {
    "swanaquarius@swanshipping.com": "Swan Aquarius",
    "swanorion@swanshipping.com": "Swan Orion",
    "swanlyra@swanshipping.com": "Swan Lyra",
  };
  for (const [email, vesselName] of Object.entries(shipVesselLogins)) {
    const vessel = await prisma.vessel.findFirst({ where: { companyId: company.id, name: vesselName } });
    if (vessel) {
      await prisma.user.updateMany({ where: { companyId: company.id, email }, data: { vesselId: vessel.id } });
    }
  }

  // Sample incidents using the structured classification.
  let inc1 = await prisma.incident.findFirst({
    where: { companyId: company.id, refNo: "INC-2026-0001" },
  });
  if (!inc1) {
    inc1 = await prisma.incident.create({
      data: {
        companyId: company.id,
        refNo: "INC-2026-0001",
        title: "First-aid injury during mooring operation",
        typeEntries: {
          create: [{ type: "PERSONAL_INJURY", subCategory: "FAC", order: 0 }],
        },
        severity: "MEDIUM",
        status: "UNDER_INVESTIGATION",
        vesselId: firstVessel?.id ?? null,
        occurredAt: new Date(),
        location: "Forecastle, mooring station",
        description:
          "An AB sustained a minor hand laceration from a mooring rope during berthing; treated with first aid on board.",
        immediateAction: "First aid administered; work stopped and area secured.",
        investigationDetails:
          "Per ECFA follow-up: AB was handling the mooring line during final heaving on the winch when the rope bight came under sudden tension as the vessel surged alongside. AB's hand was inside the bight at the moment of load-up, resulting in a laceration. First aid was administered promptly by the OOW; no further medical evacuation was required.",
        rootCauseCategory: "HUMAN_FACTORS",
        rootCauseSubCategory: "SITUATIONAL_AWARENESS_REDUCED",
        rootCause: "Improper hand placement near the rope bight under tension.",
        reportedById: adminId || null,
        createdBy: adminId || null,
      },
    });
  }

  // Sample CAPA tracker rows (TMSA-style) on the first incident.
  const capaExists = await prisma.capaAction.findFirst({
    where: { companyId: company.id, entityType: "Incident", entityId: inc1.id },
  });
  if (!capaExists) {
    await prisma.capaAction.createMany({
      data: [
        {
          companyId: company.id,
          entityType: "Incident",
          entityId: inc1.id,
          kind: "CORRECTIVE",
          code: "CA-01",
          action: "Toolbox talk conducted on mooring rope bight hazards",
          responsible: "C/O",
          targetDate: new Date(),
          status: "CLOSED",
          closedDate: new Date(),
          createdBy: adminId || null,
        },
        {
          companyId: company.id,
          entityType: "Incident",
          entityId: inc1.id,
          kind: "CORRECTIVE",
          code: "CA-02",
          action: "Review and update mooring SWL/PPE guidance in the SMS",
          responsible: "DPA",
          status: "IN_PROGRESS",
          createdBy: adminId || null,
        },
        {
          companyId: company.id,
          entityType: "Incident",
          entityId: inc1.id,
          kind: "PREVENTIVE",
          code: "PA-01",
          action: "Add mooring-station hand-placement hazard to fleet-wide safety circular",
          responsible: "QHSE",
          status: "OPEN",
          createdBy: adminId || null,
        },
      ],
    });
  }
  if (!(await prisma.incident.findFirst({ where: { companyId: company.id, refNo: "INC-2026-0002" } }))) {
    await prisma.incident.create({
      data: {
        companyId: company.id,
        refNo: "INC-2026-0002",
        title: "Hydraulic oil sheen from steering gear vent",
        typeEntries: {
          create: [
            { type: "LOSS_OF_CONTAINMENT", subCategory: "HYDRAULIC_OIL_LEAK", order: 0 },
            { type: "PROPERTY_EQUIPMENT_DAMAGE", subCategory: "MACHINERY_DAMAGE", order: 1 },
          ],
        },
        status: "REPORTED",
        vesselId: firstVessel?.id ?? null,
        occurredAt: new Date(),
        location: "Stern, steering gear compartment vent",
        description:
          "A light hydraulic oil sheen was observed on deck near the steering gear vent during routine rounds.",
        immediateAction: "Source isolated; SOPEP locker checked; area contained.",
        // Freshly reported — severity / root cause are unset until the office investigates.
        reportedById: adminId || null,
        createdBy: adminId || null,
      },
    });
  }

  // Sample Near Miss
  if (!(await prisma.nearMiss.findFirst({ where: { companyId: company.id, refNo: "NM-2026-0001" } }))) {
    await prisma.nearMiss.create({
      data: {
        companyId: company.id,
        refNo: "NM-2026-0001",
        title: "Near miss during cargo hose connection",
        vesselId: firstVessel?.id ?? null,
        occurredAt: new Date(),
        location: "Cargo manifold, main deck",
        description:
          "A crew member's hand was nearly caught between the cargo hose flange and the manifold during connection due to unexpected hose swing.",
        potentialConsequence: "INJURY_ILL_HEALTH",
        potentialSeverity: "HIGH",
        immediateAction: "Work stopped; toolbox talk conducted before resuming.",
        rootCauseCategory: "HUMAN_FACTORS",
        rootCauseSubCategory: "SITUATIONAL_AWARENESS_REDUCED",
        status: "UNDER_REVIEW",
        reportedById: adminId || null,
        createdBy: adminId || null,
      },
    });
  }

  // Sample Hazard Observation (HOR) — merged into the Near Miss/HOR module.
  if (!(await prisma.nearMiss.findFirst({ where: { companyId: company.id, refNo: "HOR-2026-0001" } }))) {
    await prisma.nearMiss.create({
      data: {
        companyId: company.id,
        refNo: "HOR-2026-0001",
        title: "Missing gratings guard near engine room walkway",
        kind: "HOR",
        horCategory: "UNSAFE_CONDITION",
        vesselId: firstVessel?.id ?? null,
        occurredAt: new Date(),
        location: "Engine room",
        description:
          "A section of floor grating guard is missing near the walkway, presenting a trip/fall hazard.",
        potentialConsequence: "INJURY_ILL_HEALTH",
        potentialSeverity: "MEDIUM",
        immediateAction: "Area barriered off and warning sign posted.",
        rootCauseCategory: "EQUIPMENT_SOFTWARE",
        rootCauseSubCategory: "EQUIPMENT_FAILURE",
        status: "REPORTED",
        reportedById: adminId || null,
        createdBy: adminId || null,
      },
    });
  }

  // Sample Non-Conformity
  if (!(await prisma.nonConformity.findFirst({ where: { companyId: company.id, refNo: "NCR-2026-0001" } }))) {
    await prisma.nonConformity.create({
      data: {
        companyId: company.id,
        refNo: "NCR-2026-0001",
        title: "Fire drill interval exceeded",
        vesselId: firstVessel?.id ?? null,
        source: "INTERNAL_AUDIT",
        requirement: "SOLAS III/19.3.2 — monthly fire drill",
        severity: "HIGH",
        raisedAt: new Date(),
        targetDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
        description:
          "Records show the interval between two consecutive fire drills exceeded one month contrary to the requirement.",
        status: "OPEN",
        raisedById: adminId || null,
        createdBy: adminId || null,
      },
    });
  }

  // Sample SIRE inspection + observations
  if (!(await prisma.sireInspection.findFirst({ where: { companyId: company.id, refNo: "SIRE-2026-0001" } }))) {
    await prisma.sireInspection.create({
      data: {
        companyId: company.id,
        refNo: "SIRE-2026-0001",
        vesselId: firstVessel?.id ?? null,
        inspectingCompany: "Shell International Trading",
        inspectorName: "J. Miller",
        port: "Singapore",
        inspectionDate: new Date(),
        inspectionType: "LOADING_OPERATION",
        sireVersion: "2.0",
        overallResult: "OBSERVATIONS",
        summary: "Two observations raised; no critical findings.",
        status: "IN_PROGRESS",
        createdBy: adminId || null,
        observations: {
          create: [
            {
              companyId: company.id,
              seq: 1,
              chapter: 3,
              category: "PROCESS",
              viqRef: "3.1",
              question: "Was a documented passage plan available covering the entire intended voyage?",
              observation: "Bridge passage plan not signed by the Master for the current voyage.",
              rootCauseCategory: "PROCESS_METHODS",
              rootCauseSubCategory: "CHECKLIST_NOT_USED",
              rootCause: "Passage plan checklist step for Master's countersignature was skipped.",
              correctiveAction: "Master countersigned the current passage plan.",
              preventiveMeasure: "Passage plan checklist amended to make countersignature a hard gate before departure.",
              responsiblePersonId: adminId || null,
              targetDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
              status: "ONGOING",
              createdBy: adminId || null,
            },
            {
              companyId: company.id,
              seq: 2,
              chapter: 9,
              category: "HARDWARE",
              viqRef: "9.4",
              question: "Were emergency escape breathing devices (EEBDs) correctly stowed and clearly marked?",
              observation: "One EEBD stowage location not clearly marked.",
              correctiveAction: "Signage renewed; photo evidence filed.",
              responsiblePersonId: adminId || null,
              actualCompletionDate: new Date(),
              status: "CLOSED",
              verifiedById: adminId || null,
              createdBy: adminId || null,
            },
          ],
        },
      },
    });
  }

  // Sample PSC inspection (detained) + deficiency
  if (!(await prisma.pscInspection.findFirst({ where: { companyId: company.id, refNo: "PSC-2026-0001" } }))) {
    await prisma.pscInspection.create({
      data: {
        companyId: company.id,
        refNo: "PSC-2026-0001",
        vesselId: firstVessel?.id ?? null,
        authority: "Australia AMSA",
        mouRegion: "Tokyo MOU",
        port: "Fremantle",
        inspectionDate: new Date(),
        detained: false,
        summary: "Three deficiencies, none detainable.",
        status: "IN_PROGRESS",
        createdBy: adminId || null,
        deficiencies: {
          create: [
            {
              companyId: company.id,
              natureCode: "07110",
              reference: "SOLAS III/19",
              actionCode: "17",
              description: "Fire drill not carried out at required interval.",
              createdBy: adminId || null,
            },
            {
              companyId: company.id,
              natureCode: "11101",
              reference: "MLC 3.1",
              actionCode: "17",
              description: "Galley exhaust not adequately cleaned.",
              rootCauseCategory: "MANAGEMENT_GOVERNANCE",
              rootCauseSubCategory: "PLANNING_INADEQUATE",
              createdBy: adminId || null,
            },
          ],
        },
      },
    });
  }

  // Sample CDI inspection + observation
  if (!(await prisma.cdiInspection.findFirst({ where: { companyId: company.id, refNo: "CDI-2026-0001" } }))) {
    await prisma.cdiInspection.create({
      data: {
        companyId: company.id,
        refNo: "CDI-2026-0001",
        vesselId: firstVessel?.id ?? null,
        inspectorName: "A. Petrov",
        scheme: "CDI-M",
        port: "Rotterdam",
        inspectionDate: new Date(),
        summary: "One observation on documentation.",
        status: "IN_PROGRESS",
        createdBy: adminId || null,
        observations: {
          create: [
            {
              companyId: company.id,
              questionRef: "5.2.1",
              observation: "Cargo compatibility records not consistently retained on board.",
              status: "OPEN",
              createdBy: adminId || null,
            },
          ],
        },
      },
    });
  }

  // Sample Internal Audit + findings
  if (!(await prisma.internalAudit.findFirst({ where: { companyId: company.id, refNo: "IA-2026-0001" } }))) {
    await prisma.internalAudit.create({
      data: {
        companyId: company.id,
        refNo: "IA-2026-0001",
        vesselId: firstVessel?.id ?? null,
        scope: "Full SMS internal audit",
        standard: "ISM Code",
        auditorName: "Maria Santos",
        auditBody: "QHSE Department",
        auditDate: new Date(),
        summary: "Annual internal audit; two minor findings raised.",
        status: "IN_PROGRESS",
        createdBy: adminId || null,
        findings: {
          create: [
            {
              companyId: company.id,
              category: "MINOR_NC",
              reference: "ISM 10.3",
              description: "Some PMS jobs overdue without documented postponement.",
              createdBy: adminId || null,
            },
            {
              companyId: company.id,
              category: "OBSERVATION",
              reference: "ISM 7",
              description: "Consider adding a checklist for enclosed-space entry drills.",
              rootCauseCategory: "MANAGEMENT_GOVERNANCE",
              rootCauseSubCategory: "PLANNING_INADEQUATE",
              createdBy: adminId || null,
            },
          ],
        },
      },
    });
  }

  // Sample External Audit + finding
  if (!(await prisma.externalAudit.findFirst({ where: { companyId: company.id, refNo: "EA-2026-0001" } }))) {
    await prisma.externalAudit.create({
      data: {
        companyId: company.id,
        refNo: "EA-2026-0001",
        vesselId: firstVessel?.id ?? null,
        scope: "ISM annual verification",
        standard: "ISM Code",
        auditorName: "External surveyor",
        auditBody: "DNV",
        auditDate: new Date(),
        summary: "Annual ISM verification; one minor NC.",
        status: "IN_PROGRESS",
        createdBy: adminId || null,
        findings: {
          create: [
            {
              companyId: company.id,
              category: "MINOR_NC",
              reference: "ISM 12.1",
              description: "Management review records incomplete for the prior period.",
              createdBy: adminId || null,
            },
          ],
        },
      },
    });
  }

  // Sample Committee Meeting — combined Safety Committee + Health & Hygiene,
  // per ADM-04 / RC-013 (one meeting instance can cover several committees).
  if (!(await prisma.committeeMeeting.findFirst({ where: { companyId: company.id, refNo: "CM-2026-0001" } }))) {
    await prisma.committeeMeeting.create({
      data: {
        companyId: company.id,
        refNo: "CM-2026-0001",
        status: "REPORTED",
        vesselId: firstVessel?.id ?? null,
        position: "Singapore — Anchorage",
        meetingDate: new Date(),
        meetingTime: "1100H-1130",
        chairman: "Capt. Ramon Reyes",
        inCharge: "C/Off Ronald Cariño",
        members: "C/Off Ronald Cariño\nC/Engr Rommel Mapalad\n2/Engr Andy Dela Merced",
        inAttendance: "2/Off Royce Hautea\n3/Engr Joy Amoronio\nBosun",
        vesselRemarks: "Monthly safety meeting carried out for the month; all pending items completed.",
        createdBy: adminId || null,
        agendaItems: {
          create: [
            {
              companyId: company.id,
              seq: 1,
              committeeType: "SAFETY",
              code: "A",
              label: "Previous minutes meeting — reading of the previous meeting minutes and confirmation that all pending items have been completed.",
              details: "No outstanding items from the previous meeting.",
            },
            {
              companyId: company.id,
              seq: 2,
              committeeType: "SAFETY",
              code: "B",
              label: "Accident/Incident discussion — discussions on any accidents/incidents that have occurred on the ship or in the fleet.",
              details: "No incidents to report this period.",
            },
            {
              companyId: company.id,
              seq: 3,
              committeeType: "SAFETY",
              code: "D",
              label: "Near Miss / Non-Conformity issues — discussion on any reported near miss incidents on board.",
              details: "Reminded all crew of the importance of reporting near misses promptly.",
            },
            {
              companyId: company.id,
              seq: 4,
              committeeType: "HEALTH_HYGIENE",
              code: "A",
              label: "Cleanliness of galley, crew cabins, mess halls, hospital room, toilets, bathrooms, laundry room and others.",
              details: "Cleaning stations reminded to all crew; maintained weekly and before/after port stay.",
            },
            {
              companyId: company.id,
              seq: 5,
              committeeType: "HEALTH_HYGIENE",
              code: "C",
              label: "Crew physical condition.",
              details: "Work/rest hour periods monitored; monthly BMI and blood pressure checks conducted.",
            },
          ],
        },
      },
    });
  }

  // Drill & Familiarization master checklist (SMS A-EMP-01LPG / CK-047(b))
  const scheduleItemIds: Record<string, string> = {};
  for (let i = 0; i < SCHEDULE_ITEMS.length; i++) {
    const s = SCHEDULE_ITEMS[i]!;
    const item = await prisma.scheduleItem.upsert({
      where: { companyId_kind_itemNo: { companyId: company.id, kind: s.kind, itemNo: s.itemNo } },
      update: {
        category: s.category,
        name: s.name,
        smsReference: s.smsReference,
        frequencyLabel: s.frequencyLabel,
        frequencyDays: s.frequencyDays,
        sortOrder: i,
      },
      create: {
        companyId: company.id,
        kind: s.kind,
        category: s.category,
        itemNo: s.itemNo,
        name: s.name,
        smsReference: s.smsReference,
        frequencyLabel: s.frequencyLabel,
        frequencyDays: s.frequencyDays,
        sortOrder: i,
      },
    });
    scheduleItemIds[`${s.kind}:${s.itemNo}`] = item.id;
  }

  // Sample Emergency Drill — transcribed verbatim from SMS form R-AS-021
  // "Report of Drill / Training onboard" (Appendix 6).
  if (!(await prisma.emergencyDrill.findFirst({ where: { companyId: company.id, refNo: "DR-2026-0001" } }))) {
    await prisma.emergencyDrill.create({
      data: {
        companyId: company.id,
        refNo: "DR-2026-0001",
        vesselId: firstVessel!.id,
        scheduleItemId: scheduleItemIds["DRILL:1.0"]!, // Abandon Ship
        drillDate: new Date("2026-01-06"),
        drillTime: "1000H-1030H",
        position: "AT CAPE TOWN ANCHORAGE, SOUTH AFRICA",
        participants: "ALL CREW EXCEPT DUTY ENGINEER",
        conductedBy: "CAPT. FERDINAND R. DEL MONTE",
        details:
          "1000H – General Emergency Alarm sounded (seven short and one long blast) from the ship's bell followed by announcement by the Master on the PA System “ABANDON SHIP DRILL (said three times)!”\n\n" +
          "1004H – All crew (except Duty Engineer) arrived at the designated abandon ship muster station, passing by the Navigation Bridge. Chief Officer reported to Command Squad that all crew are accounted for with their assigned carrying things provided in the Station Bill. Master then instructed Chief Officer to review all crew's duties and responsibilities during abandon ship scenario and to check if their assigned things to carry are correct and complete. Checking of lifejacket lights and whistles as well as donning will then follow. Chief Officer acknowledges Master's instructions.\n\n" +
          "1006H – Chief Officer reported lifejacket inspection and review of duties and responsibilities completed. All lights and whistles are working properly. Master then instructed all crew to proceed by pair inside the Freefall Lifeboat and to review each own seating arrangement. Seat belt fit should also be ensured. After which, Chief Officer to conduct Training in hypothermia and review of the Freefall Lifeboat's features which includes testing of the lifeboat's engine, rudder, and lights; location and use of the lifeboat's equipment; preparation for launching and launching procedures; and the use of radio life-saving appliances.\n\n" +
          "1020H – Emergency lights were switched on for checking. Master assigned some crew to check all emergency lights and if all watertight doors in the accommodation area can be closed accordingly.\n\n" +
          "1023H – Chief Officer reported that familiarization and training completed, no busted emergency lights noted, and all watertight doors can be closed tightly. Drill debriefing was then conducted after.\n\n" +
          "1030H – Debriefing concluded. Master dismissed the drill and instructed all Deck hands to proceed to the Nav. Bridge for GMDSS Drill. All Engine hands were dismissed to their respective agenda for the rest of the day.",
        deficiencies: "No deficiencies were noted during the drill.",
        correctiveAction:
          "Commended all crew for a successful abandon ship drill. Reminded all crew to be fully familiar with their duties and responsibilities during abandon ship scenario for a more rapid response and action.",
        vesselRemarks: "Freefall Lifeboat and equipment found in good working condition and stowage positions; and ready for immediate use.",
        status: "OPEN",
        createdBy: adminId || null,
      },
    });
  }

  // Sample Familiarization record
  if (
    !(await prisma.familiarizationRecord.findFirst({
      where: { companyId: company.id, vesselId: firstVessel!.id, scheduleItemId: scheduleItemIds["FAMILIARIZATION:1"] },
    }))
  ) {
    await prisma.familiarizationRecord.create({
      data: {
        companyId: company.id,
        vesselId: firstVessel!.id,
        scheduleItemId: scheduleItemIds["FAMILIARIZATION:1"]!, // Cyber Security Plan
        completedDate: new Date(),
        notedBy: "Capt. Ramon Reyes",
        remarks: "Reviewed with deck & engine officers.",
        createdBy: adminId || null,
      },
    });
  }

  // Sample Controlled Document
  if (!(await prisma.controlledDocument.findFirst({ where: { companyId: company.id, docNumber: "DOC-2026-0001" } }))) {
    await prisma.controlledDocument.create({
      data: {
        companyId: company.id,
        docNumber: "DOC-2026-0001",
        title: "Permit to Work — Enclosed Space Entry",
        category: "FORM",
        version: "Rev 2",
        issueDate: new Date(),
        owner: "QHSE Department",
        description: "Standard permit form for enclosed space entry operations fleet-wide.",
        status: "APPROVED",
        createdBy: adminId || null,
      },
    });
  }

  // Sample Circulars — one per source, so the taxonomy is visible in demo data
  if (!(await prisma.circular.findFirst({ where: { companyId: company.id, refNo: "CIR-2026-0001" } }))) {
    await prisma.circular.create({
      data: {
        companyId: company.id,
        refNo: "CIR-2026-0001",
        title: "Updated enclosed space entry procedure",
        source: "COMPANY",
        category: "SAFETY",
        issueDate: new Date(),
        dateReceived: new Date(),
        body: "Please note the enclosed space entry permit (DOC-2026-0001) has been revised to Rev 2, adding a mandatory gas-free re-check after any break exceeding 30 minutes.",
        createdBy: adminId || null,
      },
    });
  }
  if (!(await prisma.circular.findFirst({ where: { companyId: company.id, refNo: "CIR-2026-0002" } }))) {
    await prisma.circular.create({
      data: {
        companyId: company.id,
        refNo: "CIR-2026-0002",
        title: "Amendment to annual survey requirements",
        source: "FLAG",
        issuingBody: "Panama",
        category: "REGULATORY",
        issueDate: new Date(),
        body: "Panama Maritime Authority circular amending the annual survey window for vessels over 20 years of age — refer to the attached notice for the revised schedule.",
        createdBy: adminId || null,
      },
    });
  }
  if (!(await prisma.circular.findFirst({ where: { companyId: company.id, refNo: "CIR-2026-0003" } }))) {
    await prisma.circular.create({
      data: {
        companyId: company.id,
        refNo: "CIR-2026-0003",
        title: "Class notation update for hull maintenance intervals",
        source: "CLASS",
        issuingBody: "NKK",
        category: "TECHNICAL",
        issueDate: new Date(),
        body: "NKK technical circular on revised hull maintenance and thickness-gauging intervals for bulk carriers — engineering department to review against the PMS.",
        createdBy: adminId || null,
      },
    });
  }

  // Sample Risk Assessments — controlled-document library, multi-row hazard
  // table structure (RC-012 form). RA-2026-0001: approved, in force, with a
  // recorded job execution and a pending revision request.
  if (!(await prisma.riskAssessmentDocument.findFirst({ where: { companyId: company.id, refNo: "RA-2026-0001" } }))) {
    const now = new Date();
    const nextReview = new Date(now);
    nextReview.setMonth(nextReview.getMonth() + 12);

    const raDoc = await prisma.riskAssessmentDocument.create({
      data: {
        companyId: company.id,
        refNo: "RA-2026-0001",
        title: "Hot Work in the ER Workshop",
        category: "Hot Work",
        description: "Covers welding/cutting/grinding repairs carried out inside the Engine Room workshop.",
        vesselId: firstVessel?.id ?? null,
        reviewFrequencyMonths: 12,
        lastReviewDate: now,
        nextReviewDate: nextReview,
        status: "APPROVED",
        ownerId: adminId || null,
        createdBy: adminId || null,
        updatedBy: adminId || null,
        revisions: {
          create: {
            companyId: company.id,
            revisionNo: 1,
            changeSummary: "Initial approved revision",
            smsProcedureRefs: "SSP-11 (Welding Safety Rev.4), SSP-13 (Rev.12), SSP-03",
            riskMatrixRef: "SSP-13 / Appendix 13 — RF = Severity × Likelihood",
            checklistsRequired: "CK-003 (Hot Work Permit) — recommended best practice",
            approvalLevel: "LOCAL",
            status: "APPROVED",
            approvedBy: adminId || null,
            approvedAt: now,
            effectiveDate: now,
            createdBy: adminId || null,
            hazardRows: {
              create: [
                {
                  companyId: company.id,
                  rowNo: 1,
                  phase: "PHASE 1 — PRE-WORK PREPARATION",
                  consequence: "Fire / Explosion",
                  causes: "Combustible materials/hydrocarbons present in workshop area — oily rags, grease, spilled fuel/lube oil. Inadequate housekeeping before work starts.",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "Area to be clean, free of grease/oil/flammable material before work — Ref: SSP-11 Sec. 5.2",
                  additionalControls: "Area cleared of flammables, signed off by Chief Engineer before start — Ref: CK-003 Sec. 1.7. ISGOTT Table 9.1 cleaning radius applied where adjacent bulkheads/frames may be affected.",
                  resLikelihood: 1,
                  responsible: "Chief Engineer, 3/E",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 2,
                  phase: "PHASE 1 — PRE-WORK PREPARATION",
                  consequence: "Gas Cylinder Leak / Overheating (O2-Acetylene)",
                  causes: "Damaged hoses/valves undetected before use. Cylinder exposed to a heat source near the work area.",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "Flash arresters fitted on O2 and acetylene lines — Ref: SSP-11 Sec. 5.12. Cylinders secured on purpose-made trolley.",
                  additionalControls: "Soapy-water leak test performed before each use. If cylinder overheats: cool with water, or jettison overboard as last resort — Ref: SSP-11 Sec. 5.12(d).",
                  resLikelihood: 1,
                  responsible: "3/E",
                  isNew: true,
                  ratingChangeNote: "NEW HAZARD: Not in original RA-009. Gas cylinder handling was referenced generically as \"PPE, Safety arrangements\" with no specific control for leak or overheat scenarios despite SSP-11 Sec. 5.12 covering this in detail.",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 3,
                  phase: "PHASE 2 — DURING HOT WORK",
                  consequence: "Fire / Explosion",
                  causes: "Sparks/molten steel \"flying\" in the work area. Inadequate spark containment.",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "Effective means of containing welding sparks/slag to be established — Ref: SSP-11 (Welding Safety, general precautions).",
                  additionalControls: "Surrounding area physically contained with canvas/plywood before work starts — Ref: CK-003 Sec. 2.5.",
                  resLikelihood: 1,
                  responsible: "3/E",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 4,
                  phase: "PHASE 2 — DURING HOT WORK",
                  consequence: "Electrocution",
                  causes: "Worn/stripped welding cable undetected. Wet gloves or clothing worn during work. Poor earthing of welding set.",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "Cable inspected for soundness of insulation; dry insulated PPE worn; welding set separately earthed to ship's structure — Ref: SSP-11 Sec. 5.11",
                  additionalControls: "Cable condition logged pre-use each session; rapid current cut-off system confirmed available.",
                  resLikelihood: 1,
                  responsible: "3/E, Oiler",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 5,
                  phase: "PHASE 2 — DURING HOT WORK",
                  consequence: "No Dedicated Fire Watch / Spark Migration",
                  causes: "No person assigned solely to fire-watch duty. Sparks/heat migrating to adjacent spaces undetected.",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "General PPE and safety arrangements (insufficient alone)",
                  additionalControls: "Dedicated fire watch assigned, no other duties, per OCIMF Guidelines on SMS for Hot Work / ISGOTT Ch.9. Charged fire hose/extinguisher on site.",
                  resLikelihood: 1,
                  responsible: "2/E to assign",
                  isNew: true,
                  ratingChangeNote: "NEW HAZARD: Not in original RA-009. No RA in the sample set names a fire watch as a distinct, no-other-duties role — treated as covered by general \"safety arrangements\" only.",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 6,
                  phase: "PHASE 2 — DURING HOT WORK",
                  consequence: "Injury to a Person",
                  causes: "Inadequate competence/experience. Lack of supervision. Adverse weather/sea condition.",
                  severity: 3,
                  likelihood: 2,
                  existingControls: "Qualified/experienced operator assigned; C/E or 2/E supervision in co-operation with C/O — Ref: SSP-11 Sec. 5.11.",
                  additionalControls: "Work carried out under favorable sea conditions unless emergency.",
                  resLikelihood: 1,
                  responsible: "C/E, 2/E",
                  ratingChangeNote: "RATING CORRECTED: Severity reduced 4→3. A generic supervision-related injury is not a fatality-class outcome absent a specific fatal mechanism (fire/explosion and electrocution are already captured separately). RF = 3×2 = 6 (ALARP). Residual: 3×1 = 3.",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 7,
                  phase: "PHASE 2 — DURING HOT WORK",
                  consequence: "Fume Inhalation / Inadequate Ventilation",
                  causes: "Poor ventilation of workshop. MSDS not reviewed for materials being welded.",
                  severity: 3,
                  likelihood: 2,
                  existingControls: "Mechanical dilution ventilation; portable fan if required — Ref: SSP-11 Sec. 5.3.",
                  additionalControls: "MSDS reviewed prior to work — Ref: SSP-11 Sec. 5.3(c).",
                  resLikelihood: 1,
                  responsible: "3/E",
                  ratingChangeNote: "RATING CORRECTED: Severity reduced 4→3. The ER workshop has mechanical dilution ventilation (SSP-11 Sec. 5.3) and is not a confined space — S4 (fatality-class) is not supportable absent enclosed-space conditions.",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 8,
                  phase: "PHASE 3 — COMPLETION / POST-WORK",
                  consequence: "Post-Work Reflash / Delayed Ignition",
                  causes: "Residual heat in slag/metal after work stops. Smoldering material undetected.",
                  severity: 3,
                  likelihood: 2,
                  existingControls: "Clean up, hang up equipment, leave area safe/clean/tidy — Ref: SSP-11 Sec. 5.9",
                  additionalControls: "Minimum 30-minute fire watch after work stops; hourly checks up to 6 hours (industry standard — OCIMF/ISGOTT). CK-003 Sec. 3.1 sign-off before area is released.",
                  resLikelihood: 1,
                  responsible: "Fire watch, 3/E",
                  isNew: true,
                  ratingChangeNote: "NEW HAZARD: Not in original RA-009. No post-work monitoring period was specified in any of the 3 source RAs.",
                  createdBy: adminId || null,
                },
              ],
            },
          },
        },
      },
      include: { revisions: { include: { hazardRows: true } } },
    });
    await prisma.riskAssessmentDocument.update({
      where: { id: raDoc.id },
      data: { currentRevisionId: raDoc.revisions[0]!.id },
    });

    if (firstVessel) {
      await prisma.riskAssessmentExecution.create({
        data: {
          companyId: company.id,
          documentId: raDoc.id,
          revisionId: raDoc.revisions[0]!.id,
          vesselId: firstVessel.id,
          jobName: "Repair of bent handrail bracket — ER workshop",
          conditionStatus: "UNCHANGED",
          toolboxAttendees: "3/E, Oiler",
          toolboxSignedAt: now,
          performedById: adminId || null,
          createdBy: adminId || null,
        },
      });

      await prisma.riskAssessmentRevisionRequest.create({
        data: {
          companyId: company.id,
          documentId: raDoc.id,
          vesselId: firstVessel.id,
          reason: "Suggest adding a specific control for gas cylinder leak/overheat — currently only covered generically under general safety arrangements.",
          reviewTrigger: "REVISION_REQUESTED_BY_VESSEL",
          status: "PENDING",
        },
      });
    }
  }

  // RA-2026-0002: still in draft — shows the authoring/submission workflow,
  // Company-mandatory approval level (hot work outside the workshop).
  if (!(await prisma.riskAssessmentDocument.findFirst({ where: { companyId: company.id, refNo: "RA-2026-0002" } }))) {
    await prisma.riskAssessmentDocument.create({
      data: {
        companyId: company.id,
        refNo: "RA-2026-0002",
        title: "Hot Work Outside the ER Workshop",
        category: "Hot Work",
        description: "Covers welding/cutting/grinding performed on equipment, piping, or pump locations outside the ER workshop.",
        reviewFrequencyMonths: 6,
        status: "DRAFT",
        ownerId: adminId || null,
        createdBy: adminId || null,
        updatedBy: adminId || null,
        revisions: {
          create: {
            companyId: company.id,
            revisionNo: 1,
            changeSummary: "Initial draft",
            smsProcedureRefs: "SSP-11 (Welding Safety Rev.4), SSP-13 (Rev.12), SSP-03",
            riskMatrixRef: "SSP-13 / Appendix 13 — RF = Severity × Likelihood",
            checklistsRequired: "CK-003 (Hot Work Permit) — MANDATORY, Company-approved",
            approvalLevel: "COMPANY_MANDATORY",
            status: "DRAFT",
            createdBy: adminId || null,
            hazardRows: {
              create: [
                {
                  companyId: company.id,
                  rowNo: 1,
                  phase: "PHASE 1 — PRE-WORK / COMPANY APPROVAL",
                  consequence: "Fire / Explosion — O2/Acetylene Leak",
                  causes: "Damaged/worn gas supply hoses or fittings. Leakage undetected before work starts.",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "Gas hoses inspected for condition; cylinders secured outside tank/entrance areas — Ref: SSP-11 Sec. 5.12",
                  additionalControls: "Combustible gas indicator and multi-gas detector checks before work; interval atmosphere readings logged — Ref: CK-003 Sec. 1.5/1.6",
                  resLikelihood: 1,
                  responsible: "Chief Engineer",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 2,
                  phase: "PHASE 1 — PRE-WORK / COMPANY APPROVAL",
                  consequence: "Fire / Explosion — Combustibles at Location",
                  causes: "Combustible materials/hydrocarbons present at the equipment location. Less controlled housekeeping than a dedicated workshop.",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "General hot work precautions; ISGOTT Table 9.1 cleaning radius.",
                  additionalControls: "Area-clear sign-off before start — Ref: CK-003 Sec. 1.7. Check reverse side of adjacent bulkheads/frames per ISGOTT.",
                  resLikelihood: 1,
                  responsible: "Chief Engineer, 3/E",
                  ratingChangeNote: "LIKELIHOOD CONFIRMED: L2 (industry-known), not L3. No documented incident of this type has occurred on a Swan vessel. Per SSP-13, L3 requires a documented fleet occurrence — this has not happened.",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 3,
                  phase: "PHASE 2 — ISOLATION & PREPARATION",
                  consequence: "Sparks/Slag Falling Through Gratings",
                  causes: "Open floor plates/gratings near work location. Unsealed deck penetrations below/adjacent to work site.",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "None in source RAs — gap identified during review",
                  additionalControls: "Seal/cover deck openings and gratings below and adjacent to the work location before starting. Post additional fire watch in the space below if not sealable — Ref: CK-003 Sec. 2.5.",
                  resLikelihood: 1,
                  responsible: "3/E",
                  isNew: true,
                  ratingChangeNote: "NEW HAZARD, LIKELIHOOD CONFIRMED L2: the underlying hazard (slag generation) is present on every hot work job, but no incident is documented on a Swan vessel, so this is rated L2 (\"heard of in the industry\"), not L3 — per SSP-13's own definitions.",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 4,
                  phase: "PHASE 2 — ISOLATION & PREPARATION",
                  consequence: "Line/Pump Not Isolated Before Hot Work",
                  causes: "Line or pump not drained/depressurized/tagged before cutting or welding.",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "None in source RAs — gap identified during review",
                  additionalControls: "Drain, depressurize, and tag the line/pump before hot work; Chief Engineer permission required — Ref: SSP-11 Sec. 5.11(t). Gas-freed, blanked, and free from liquid confirmed — Ref: CK-003 Sec. 2.1–2.3.",
                  resLikelihood: 1,
                  responsible: "Chief Engineer",
                  isNew: true,
                  ratingChangeNote: "NEW HAZARD: Not in original RA-133 or RA-220. Isolation of the line/pump was absent from both source RAs despite hot work being performed directly on or near pressurized equipment.",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 5,
                  phase: "PHASE 2 — ISOLATION & PREPARATION",
                  consequence: "Pump Motor Not Electrically Isolated",
                  causes: "Accidental energization of equipment being worked on.",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "None in source RAs — gap identified during review",
                  additionalControls: "Electrically isolate and tag the motor before hot work. Isolation confirmed by 2nd Engineer — Ref: CK-003 Sec. 2.4.",
                  resLikelihood: 1,
                  responsible: "Chief Engineer",
                  isNew: true,
                  ratingChangeNote: "NEW HAZARD: Not in original RA-133 or RA-220. Isolation of the motor was absent from both source RAs despite hot work being performed near energized equipment.",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 6,
                  phase: "PHASE 3 — DURING HOT WORK",
                  consequence: "Electrocution",
                  causes: "Worn/stripped welding cable. Wet gloves or coverall worn during work.",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "Dry insulated PPE; cable condition checks — Ref: SSP-11 Sec. 5.11.",
                  additionalControls: "Cable condition logged pre-use each session.",
                  resLikelihood: 1,
                  responsible: "3/E",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 7,
                  phase: "PHASE 3 — DURING HOT WORK",
                  consequence: "No Dedicated Fire Watch",
                  causes: "No person assigned solely to fire-watch duty at a non-workshop location.",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "General PPE and safety arrangements (insufficient alone)",
                  additionalControls: "Dedicated fire watch, no other duties, with charged fire hose/extinguisher on site — Ref: OCIMF/ISGOTT.",
                  resLikelihood: 1,
                  responsible: "2/E to assign",
                  isNew: true,
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 8,
                  phase: "PHASE 3 — DURING HOT WORK",
                  consequence: "Injury to a Person",
                  causes: "Inadequate competence/experience. Lack of supervision. Adverse weather/sea condition.",
                  severity: 3,
                  likelihood: 2,
                  existingControls: "Qualified operator; C/E/2/E supervision — Ref: SSP-11 Sec. 5.11.",
                  additionalControls: "Work carried out under favorable sea conditions unless emergency.",
                  resLikelihood: 1,
                  responsible: "C/E, 2/E",
                  ratingChangeNote: "RATING CORRECTED: Severity reduced 4→3 — same rationale as RA-1 (generic supervision-related injury, not a fatality-class outcome on its own).",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 9,
                  phase: "PHASE 4 — COMPLETION",
                  consequence: "Delay Completion of the Job",
                  causes: "Improper supervision. Lack of tools/equipment prepared in advance.",
                  severity: 2,
                  likelihood: 2,
                  existingControls: "Toolbox meeting before commencement; equipment prepared in advance — Ref: SSP-11 Sec. 5.2.",
                  additionalControls: "Work plan confirmed with Chief Engineer before start to avoid mid-job delays.",
                  resLikelihood: 1,
                  responsible: "3/E",
                  ratingChangeNote: "RATING CORRECTED: Severity reduced 4→2. A job delay is an operational inconvenience, not a life-safety or major-damage consequence — S4 was clearly overstated in all three source RAs (RF was 8, now 4, ALARP).",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 10,
                  phase: "PHASE 4 — COMPLETION",
                  consequence: "Post-Work Reflash / Delayed Ignition",
                  causes: "Residual heat in slag/metal after work stops. Smoldering material undetected.",
                  severity: 3,
                  likelihood: 2,
                  existingControls: "Clean up, leave area safe/clean/tidy — Ref: SSP-11 Sec. 5.9.",
                  additionalControls: "Minimum 30-minute fire watch post-work; hourly checks up to 6 hours. CK-003 Sec. 3.1 sign-off; Company notified of completion per approval terms.",
                  resLikelihood: 1,
                  responsible: "Fire watch, 3/E",
                  isNew: true,
                  ratingChangeNote: "NEW HAZARD: Not in original RA-133 or RA-220. No post-work monitoring period was specified.",
                  createdBy: adminId || null,
                },
              ],
            },
          },
        },
      },
    });
  }

  // RA-2026-0004: Bunkering with Bunker Barge — sourced from company RA
  // AN-26-288-ENG Rev.1 (Revised Bunkering RA, 21 Jun 2026). LPG carrier
  // fleet-wide; still in draft so office can review before publishing.
  if (!(await prisma.riskAssessmentDocument.findFirst({ where: { companyId: company.id, refNo: "RA-2026-0004" } }))) {
    await prisma.riskAssessmentDocument.create({
      data: {
        companyId: company.id,
        refNo: "RA-2026-0004",
        title: "Bunkering with Bunker Barge",
        category: "Bunkering",
        description: "Covers ship-to-ship bunkering with a bunker barge, from barge approach through hose disconnection and departure.",
        applicableVesselType: "LPG Carrier",
        reviewFrequencyMonths: 12,
        status: "DRAFT",
        ownerId: adminId || null,
        createdBy: adminId || null,
        updatedBy: adminId || null,
        revisions: {
          create: {
            companyId: company.id,
            revisionNo: 1,
            changeSummary: "Initial draft — sourced from company RA AN-26-288-ENG Rev.1 (Revised Bunkering RA, 21 Jun 2026)",
            smsProcedureRefs: "ENG-06 (Rev.31 Oct 25), DCK-17, DCK-11, SSP-13",
            riskMatrixRef: "SSP-13 / Appendix 13 — RF = Severity × Likelihood",
            checklistsRequired: "CK-024 (Bunkering Checklist), CK-067 (STS Bunkering Transfer)",
            approvalLevel: "COMPANY_MANDATORY",
            status: "DRAFT",
            createdBy: adminId || null,
            hazardRows: {
              create: [
                {
                  companyId: company.id,
                  rowNo: 1,
                  phase: "PHASE 1 — PRE-BUNKERING PREPARATION",
                  consequence: "Oil Tank Overflow / Oil Spill / Marine Pollution",
                  causes: "• Failure to double-check valve lineup before start\n• Inadequate tank soundings during bunkering\n• Scuppers not plugged — spill reaches sea\n• Loading rate not reduced as tank approaches full (>80%)\n• No drip trays at manifold connection\n• SOPEP not on standby\n• Quantity error — exceeds tank capacity",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "• Chief Engineer to brief all personnel before bunkering — Ref: ENG-06 Sec. 4.1\n• Valve lineup to be checked and confirmed before opening barge valve — Ref: ENG-06 Sec. 4.2d\n• OOW / Officer to maintain regular tank soundings throughout operation — Ref: ENG-06 Sec. 4.3d\n• Agreed quantity and loading sequence documented in Bunkering Plan (R-EG-007) — Ref: ENG-06 Sec. 4.2b\n• Pumping rate to be reduced when last tank reaches 80% full — Ref: ENG-06 Sec. 4.3g\n• CK-024 (Bunkering Checklist) to be completed — Ref: ENG-06 Appendix 8",
                  additionalControls: "• All deck scuppers to be plugged and sealed before hose connection — Ref: ENG-06 Sec. 4.2g / ISGOTT 5.6.1\n• Drip trays deployed under all hose connections and at manifold before transfer\n• SOPEP locker unlocked; oil spill materials (sorbent pads, collection drums) on standby at manifold\n• MARPOL Annex I ORB entry prepared for post-bunkering completion\n• Restore scuppers to open only after hose disconnection and deck confirmed clean — Ref: ENG-06 Sec. 4.4b",
                  resLikelihood: 1,
                  responsible: "Chief Engineer / OOW",
                  ratingChangeNote: "MERGED: Former rows 5, 7, and 14 (source RAs) consolidated — same hazard scenario (overflow/spill/pollution) from three angles.",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 2,
                  phase: "PHASE 1 — PRE-BUNKERING PREPARATION",
                  consequence: "Loading of Off-Spec Bunker / Resulting Machinery Damage",
                  causes: "• Failure to verify Bunker Delivery Note (BDN) parameters before transfer\n• Supplier delivers incorrect grade or contaminated fuel\n• No bunker sampling kit available on board\n• Bunker sample not retained for testing\n• Off-spec fuel consumed before analysis result received",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "• BDN to be checked for sulphur content, grade, and density before transfer — Ref: ENG-06 Sec. 4.2c\n• Bunker sample to be taken during transfer per MARPOL requirements — Ref: ENG-06 Sec. 4.4a\n• Retain samples for 12 months minimum\n• Contact Superintendent if analysis result raises concern — Ref: ENG-06 Sec. 4.7\n• CK-024 (Bunkering Checklist) to be completed — Ref: ENG-06 Appendix 8",
                  additionalControls: "• Do NOT consume new bunker until fuel analysis confirms fit for use — Ref: ENG-06 Sec. 4.7\n• MARPOL Annex VI compliance check — sulphur content confirmed on BDN before transfer starts\n• Letter of Protest to be filed for any quality discrepancy — Ref: ENG-06 Sec. 4.4g/h",
                  resLikelihood: 1,
                  responsible: "Chief Engineer",
                  ratingChangeNote: "MERGED: Former rows 12 and 16 (source RAs) consolidated — same scenario written from two angles (quality failure → machinery damage).",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 3,
                  phase: "PHASE 1 — PRE-BUNKERING PREPARATION",
                  consequence: "Sludge / Wax Formation in Fuel Oil Storage Tanks",
                  causes: "• Bunkering of fuel with high wax content or high pour point\n• HFO temperature not maintained above pour point\n• Mixing of incompatible fuels (different base stocks)",
                  severity: 3,
                  likelihood: 2,
                  existingControls: "• Check fuel specifications on BDN before transfer — Ref: ENG-06 Sec. 4.2c\n• Maintain HFO tank temperature above pour point per manufacturer requirements\n• Confirm compatibility if bunkering a different grade — consult Superintendent — Ref: ENG-06 Sec. 4.7",
                  additionalControls: "• Monitor HFO tank temperatures after bunkering until fuel is confirmed stable\n• If pour point risk identified, inform C/E and increase tank heating — do not transfer to service tank until stable",
                  resLikelihood: 1,
                  responsible: "Chief Engineer",
                  ratingChangeNote: "RATING CORRECTED: Severity reduced 4→3. Sludge/wax causes minor operational disruption and maintenance — not fatality or major structural damage. RF = 3×2 = 6 (ALARP). Residual: 3×1 = 3.",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 4,
                  phase: "PHASE 1 — PRE-BUNKERING PREPARATION",
                  consequence: "Failure of Pre-Agreed Emergency Shutdown (ESD)",
                  causes: "• Emergency stop signal not agreed before transfer commences\n• Communication breakdown between ship and barge during overflow or fire\n• Valve cannot be closed remotely — manual stop requires delay\n• Barge operator unresponsive to ship's stop signal",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "• ENG-06 Sec. 5.1 — STS checklist (CK-067) requires ESD agreement before opening any valve\n• Pre-transfer briefing to include emergency stop signal, radio channel, and backup method\n• Ship's valve to remain under ship's control at all times — Ref: ENG-06 Sec. 4.3a",
                  additionalControls: "• STS Transfer Bunkering Checklist (CK-067) to be signed by BOTH parties before transfer — Ref: ENG-06 Sec. 5.1\n• Emergency stop signal and procedure confirmed with barge — item on CK-067\n• Radio channel tested and confirmed before opening valves\n• Backup communication method (whistle / hand signal) agreed and briefed to all parties",
                  resLikelihood: 1,
                  responsible: "OOW / Chief Engineer",
                  isNew: true,
                  ratingChangeNote: "NEW HAZARD: Not in original RA. ESD failure is a primary barrier against overflow and fire escalation.",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 5,
                  phase: "PHASE 2 — BARGE APPROACH AND MOORING",
                  consequence: "Collision / Damage to Vessel During Barge Approach",
                  causes: "• Barge approaching at excessive speed\n• Inadequate fendering on barge\n• Adverse current or wind causing uncontrolled contact\n• Poor communication between vessel and barge during approach",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "• OOW and Master to be on bridge during approach — Ref: ENG-06 Sec. 5.3\n• Confirm barge is suitably fendered before allowing alongside — Ref: ENG-06 Sec. 5.3\n• Abort approach if barge not suitably fendered or sea conditions threaten safety — Ref: ENG-06 Sec. 5.6\n• VHF communication on agreed channel established before approach",
                  additionalControls: "• Abort if barge speed or heading is unsafe — issue 'stop approach' via VHF immediately\n• Vessel's own fenders to be deployed and rigged before barge arrives\n• Lookouts posted on both port and starboard sides during approach",
                  resLikelihood: 1,
                  responsible: "OOW / Master",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 6,
                  phase: "PHASE 2 — BARGE APPROACH AND MOORING",
                  consequence: "Injury to Crew / Mooring Line Failure / Snap-Back",
                  causes: "• Crew positioned in snap-back zone during mooring\n• Mooring line worn, damaged, or exceeds discard criteria (MEG4)\n• Excessive tension on line due to vessel movement or barge surge\n• Non-essential personnel on exposed deck during line-tending\n• Poor communication between mooring stations",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "• All mooring operations per DCK-17 (Safe Mooring and Unmooring Operations)\n• Mooring equipment tested and maintained per DCK-11 / OCIMF MEG4\n• Toolbox meeting before start; roles briefed to all — Ref: ENG-06 Sec. 4.1\n• Appropriate PPE: safety helmet, gloves, safety boots — mandatory on deck during mooring\n• Radio communication between forward and aft stations confirmed",
                  additionalControls: "• Snap-back danger zones to be clearly marked on deck. All non-essential personnel to remain outside snap-back zones — Ref: DCK-11 / OCIMF MEG4\n• Mooring lines to be inspected for wear and integrity per MEG4 discard criteria BEFORE use\n• Designated AB on duty to tend mooring lines throughout entire bunkering operation — Ref: ENG-06 Sec. 5.4 / DCK-17 Sec. 4\n• No crew to stand between ship and barge hull during mooring operations",
                  resLikelihood: 1,
                  responsible: "Bosun / OOW",
                  ratingChangeNote: "MERGED: Former rows 2 and 8 (source RAs) consolidated — mooring line snap is a cause within mooring injury, not a separate hazard.",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 7,
                  phase: "PHASE 2 — BARGE APPROACH AND MOORING",
                  consequence: "Man Overboard — Between Ship and Barge (Crush Zone)",
                  causes: "• Crew member slips on wet deck near ship-barge interface\n• Loss of balance during hose handling or line tending\n• No guardrail or net at ship-barge gap\n• Crew working alone at interface without lookout",
                  severity: 5,
                  likelihood: 2,
                  existingControls: "• No lone working at ship-barge interface — minimum two persons required\n• MOB recovery equipment (lifebuoy, rescue line, throwing buoy) at ready — Ref: DCK-17\n• ENG-06 Sec. 5.1 STS checklist includes MOB alert procedure between ship and barge\n• Non-essential personnel barred from ship-barge interface area",
                  additionalControls: "• Guardrails or safety nets to be rigged at ship-barge interface where practicable before barge comes alongside\n• MOB recovery plan agreed with barge before start of operations — who recovers, how, with what equipment\n• Crew briefed: do not stand on open deck between vessels without a firm handhold\n• Rescue boat / rescue throw line at immediate readiness throughout bunkering",
                  resLikelihood: 1,
                  responsible: "OOW / Bosun",
                  isNew: true,
                  ratingChangeNote: "NEW HAZARD: Gap between ship and barge is a crush zone. Survival probability extremely low. Not addressed in original RA.",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 8,
                  phase: "PHASE 3 — HOSE CONNECTION AND DISCONNECTION",
                  consequence: "Injury to Crew During Hose Connection / Disconnection",
                  causes: "• Hose heavier than anticipated — handling injury during lift\n• Slippery deck due to oil residue or rain\n• Hose coupling under pressure during connection\n• Inadequate lighting during night operations",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "• Toolbox meeting before start; hose handling plan briefed — Ref: ENG-06 Sec. 4.1\n• Appropriate PPE: gloves, safety boots, chemical-resistant apron at manifold\n• Hose to be visually inspected for defects before connection — Ref: ENG-06 Sec. 4.2d\n• Deck lighting confirmed operational for night operations",
                  additionalControls: "• Portable lifting equipment or tackle to be rigged for heavy bunker hoses where required\n• Confirm hose pressure is zero before disconnection — bleed down before opening flange\n• Drip trays in position before flange is opened\n• Minimum 2 persons required for hose connection and disconnection",
                  resLikelihood: 1,
                  responsible: "Chief Engineer / OOW",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 9,
                  phase: "PHASE 3 — HOSE CONNECTION AND DISCONNECTION",
                  consequence: "Bunker Hose Rupture / Fuel Spill at Connection",
                  causes: "• Hose in poor condition — worn, cracked, or exceeds service life\n• Flange connection not fully secured / wrong gasket used\n• Agreed delivery pressure exceeded by barge pump\n• Hose subject to excessive kinking or tension during transfer",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "• Visual inspection of hose for defects before connection — Ref: ENG-06 Sec. 4.2d\n• Agreed maximum flow rate and delivery pressure established before start — Ref: ENG-06 Sec. 4.3c\n• Hose to be supported and not subjected to kinking or excessive tension\n• Annual bunker line pressure test to be current — Ref: ENG-17",
                  additionalControls: "• Maximum agreed flow rate and pressure documented and confirmed with barge before opening valve\n• Drip trays and sorbent pads in place at manifold connection before any flow\n• Hose watched continuously during initial flow — officer to confirm no leaks before leaving manifold unattended",
                  resLikelihood: 1,
                  responsible: "Chief Engineer",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 10,
                  phase: "PHASE 4 — FUEL TRANSFER (BUNKERING)",
                  consequence: "Damage to Vessel During Bunkering Operation",
                  causes: "• Unexpected vessel movement from weather or passing traffic\n• Barge surge causing hose to part\n• No lookout posted — other vessel approaches undetected",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "• OOW to maintain bridge watch throughout bunkering — Ref: ENG-06 Sec. 4.3\n• Abort bunkering if weather or sea conditions deteriorate beyond safe limits — Ref: ENG-06 Sec. 5.6\n• VHF watch maintained on working channel and distress channel",
                  additionalControls: "• Lookout posted on exposed deck throughout operation\n• Barge mooring lines to be tended continuously — Ref: ENG-06 Sec. 5.4\n• Pre-agreed abort criteria (wind speed, sea state) agreed with barge before start",
                  resLikelihood: 1,
                  responsible: "OOW / Master",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 11,
                  phase: "PHASE 4 — FUEL TRANSFER (BUNKERING)",
                  consequence: "Explosion or Fire During Bunkering",
                  causes: "• Ignition of fuel vapor from: open flame, hot work, smoking, static discharge, faulty electrical equipment\n• Fuel vapor concentration reaches flammable range (LEL)\n• Thunderstorm / lightning during bunkering\n• Cargo vapor mixing with fuel vapors in bunkering zone",
                  severity: 5,
                  likelihood: 2,
                  existingControls: "• No smoking in bunkering zone — NO SMOKING signs posted — Ref: ENG-06 Sec. 4.2k\n• No naked lights, no naked flames in bunkering zone — Ref: ENG-06 Sec. 4.2m\n• Only intrinsically safe equipment to be used in bunkering zone — Ref: ENG-06 Sec. 4.2p\n• Gas detector check before commencement; vapor monitoring throughout — Ref: ENG-06 Sec. 4.5\n• H2S and benzene precautions per ENG-06 Sec. 4.5\n• Abort bunkering if thunderstorm approaches — Ref: ENG-06 Sec. 4.2 / ISGOTT 3.5.4\n• Hot work embargo: no simultaneous hot work during any bunkering operation\n• Fire extinguisher (foam/CO₂) on standby at manifold throughout operation\n• Toolbox meeting to confirm fire prevention measures — Ref: ENG-06 Sec. 4.1",
                  additionalControls: "• PPE: fire-resistant gloves and chemical-resistant apron at manifold — last barrier, not primary control\n• Engine Room to maintain fire detection system active throughout\n• Barge operator briefed: no smoking, no open flames on barge during transfer",
                  resLikelihood: 1,
                  responsible: "Chief Engineer / OOW",
                  ratingChangeNote: "RATING CORRECTED: Severity raised 4→5. On an LPG carrier, fire/explosion during bunkering can result in multiple fatalities and extensive damage = S5 (Catastrophic). RF = 5×2 = 10. Residual: 5×1 = 5 (ALARP).",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 12,
                  phase: "PHASE 4 — FUEL TRANSFER (BUNKERING)",
                  consequence: "LPG Cargo Vapor Migration into Bunkering Zone",
                  causes: "• Cargo tank pressure relief or venting during HFO bunkering operation\n• LPG vapor migrates to manifold area — reaches ignition sources\n• Bunkering conducted during cargo operations or gas freeing\n• LPG vapor detector not in place or not functioning",
                  severity: 5,
                  likelihood: 2,
                  existingControls: "• Cargo containment status to be confirmed stable and no relief valve lifting before bunkering commences\n• No simultaneous LPG cargo loading/discharge or gas freeing during bunkering — Ref: ENG-06 Sec. 4.2\n• Intrinsically safe equipment mandatory in all zones during bunkering — Ref: ENG-06 Sec. 4.2p",
                  additionalControls: "• LPG vapor detector (portable) to be deployed in bunkering zone and active throughout\n• Cargo tank pressures to be monitored continuously during bunkering — any relief valve activity = immediate stop\n• Immediate stop-work if any cargo alarm activates during bunkering\n• Pre-bunkering check: confirm all cargo vent lines and PRVs are pointing away from bunkering zone",
                  resLikelihood: 1,
                  responsible: "Chief Engineer / OOW / C/O",
                  isNew: true,
                  ratingChangeNote: "NEW HAZARD: Vessel-type specific risk for LPG carrier. Not present in original RA. LPG vapor is far more flammable than HFO vapor — ignition consequence is catastrophic (S5).",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 13,
                  phase: "PHASE 4 — FUEL TRANSFER (BUNKERING)",
                  consequence: "Unauthorized Flow Resumption by Barge / Quantity Dispute",
                  causes: "• Barge resumes pumping without ship's explicit go-ahead after a pause\n• Agreed quantity exceeded — overflow results\n• Quantity discrepancy >1% on BDN vs. vessel measurement\n• Ship's officer not stationed at manifold during resumption",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "• Agreed quantity and maximum flow rate documented in Bunkering Plan (R-EG-007) before start — Ref: ENG-06 Sec. 4.2b\n• Ship's valve to remain under ship's control at all times — Ref: ENG-06 Sec. 4.3a\n• Ship officer to give explicit go-signal before each start and restart of flow — Ref: ENG-06 Sec. 4.3a",
                  additionalControls: "• Agreed quantity confirmed with barge master before start; documented on CK-024\n• Officer stationed at manifold during all flow starts and restarts\n• Letter of Protest to be filed immediately for any quantity discrepancy >1% — Ref: ENG-06 Sec. 4.4g/h",
                  resLikelihood: 1,
                  responsible: "Chief Engineer / OOW",
                  isNew: true,
                  ratingChangeNote: "NEW HAZARD: Unauthorized flow resumption is a known industry cause of overflow incidents. Not in original RA.",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 14,
                  phase: "PHASE 4 — FUEL TRANSFER (BUNKERING)",
                  consequence: "Static Charge Buildup at Initial Flow — Ignition Risk",
                  causes: "• HFO pumped at high initial flow rate — static charge builds in pipe\n• Static discharge at manifold connection before bonding established\n• No initial flow rate restriction agreed with barge",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "• Use only intrinsically safe equipment in bunkering zone — Ref: ENG-06 Sec. 4.2p\n• Hot work embargo during bunkering — no ignition sources in zone\n• ISGOTT 3.5.4 — precautions against static electricity in fuel transfer",
                  additionalControls: "• Initial flow rate to be restricted to agreed low rate — do not go to full rate until static has dissipated\n• Flow rate to be confirmed with barge before opening valve — agreed rate documented on CK-024\n• Bonding/earthing cable to be established (if required per ISGOTT 3.5.4 / barge requirements) before any flow commences",
                  resLikelihood: 1,
                  responsible: "Chief Engineer",
                  isNew: true,
                  ratingChangeNote: "NEW HAZARD: Static charge at initial flow is covered in ISGOTT 3.5.4 but absent from the original RA controls.",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 15,
                  phase: "PHASE 4 — FUEL TRANSFER (BUNKERING)",
                  consequence: "Damage to HFO Transfer Pump During Transfer",
                  causes: "• HFO temperature below minimum transfer temperature — wax / sludge plugs pump\n• Air in suction line — cavitation\n• Transfer started before HFO heated to recommended temperature",
                  severity: 3,
                  likelihood: 2,
                  existingControls: "• Heat HFO to recommended transfer temperature before starting pump — Ref: ENG-06 Sec. 4.3\n• Chief Engineer to confirm temperature before starting transfer\n• Air vent purged from suction line before starting pump",
                  additionalControls: "• Monitor HFO temperature continuously during transfer\n• Stop pump immediately if abnormal noise, vibration, or pressure fluctuation",
                  resLikelihood: 1,
                  responsible: "Chief Engineer",
                  ratingChangeNote: "RATING CORRECTED: Severity reduced 4→3. Pump damage = minor equipment damage and operational delay. Not a fatality scenario. RF = 3×2 = 6 (ALARP). Residual: 3×1 = 3.",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 16,
                  phase: "PHASE 5 — BUNKERING COMPLETION AND BARGE DEPARTURE",
                  consequence: "Breach of Ship Security During Bunkering",
                  causes: "• Unauthorized persons boarding via barge during bunkering\n• Restricted areas (bridge, E/R, accommodation) left unsecured\n• Gangway access not controlled; visitor log not maintained",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "• Ship Security Plan (SSP-01) to be in force throughout bunkering\n• Security level per SSP-01 — access control at gangway mandatory\n• Security rounds per SSP-01 schedule to be maintained during bunkering",
                  additionalControls: "• Gangway watch to be posted throughout bunkering — visitor log maintained\n• Bridge, E/R, and accommodation doors to be locked during bunkering\n• Master to be informed of any security anomaly immediately",
                  resLikelihood: 1,
                  responsible: "Master / OOW",
                  createdBy: adminId || null,
                },
                {
                  companyId: company.id,
                  rowNo: 17,
                  phase: "PHASE 5 — BUNKERING COMPLETION AND BARGE DEPARTURE",
                  consequence: "Injury to Crew — General Bunkering Watch / Duty Officer",
                  causes: "• Crew fatigue — bunkering conducted after long duty hours\n• Inadequate lighting during night bunkering\n• Slip/trip on wet or oily deck during rounds\n• No supervision of crew during overnight bunkering",
                  severity: 4,
                  likelihood: 2,
                  existingControls: "• Duty Officer to maintain continuous watch throughout bunkering — Ref: ENG-06 Sec. 4.3\n• All crew in bunkering zone to wear full PPE (hard hat, gloves, safety boots, coveralls)\n• Deck lighting to be confirmed operational before bunkering commences\n• Toolbox meeting: fatigue management discussed; shift rotation planned if bunkering is prolonged",
                  additionalControls: "• If overnight bunkering: relief officer to be briefed and stationed — no single officer for >6 hours\n• Non-slip measures on wet deck areas around manifold and mooring stations",
                  resLikelihood: 1,
                  responsible: "OOW / Chief Engineer",
                  createdBy: adminId || null,
                },
              ],
            },
          },
        },
      },
    });
  }

  // Sample Defect
  if (!(await prisma.defect.findFirst({ where: { companyId: company.id, refNo: "DEF-2026-0001" } }))) {
    await prisma.defect.create({
      data: {
        companyId: company.id,
        refNo: "DEF-2026-0001",
        vesselId: firstVessel!.id,
        equipment: "No.2 Fire Pump",
        description: "Fire pump fails to reach required discharge pressure on test.",
        severity: "MAJOR",
        dateRaised: new Date(),
        targetRectificationDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
        raisedBy: "C/Engr",
        status: "MONITORING",
        actionTaken: "Impeller inspection scheduled at next port; spare gasket kit ordered.",
        createdBy: adminId || null,
      },
    });
  }

  console.log("\n✔ Seed complete.");
  console.log("  Company: Swan Shipping Corporation (SWAN)");
  console.log("  Login with any of these (password: swan1234):");
  for (const u of USERS) console.log(`    • ${u.email}  →  ${u.role}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
