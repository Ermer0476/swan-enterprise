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
      "risk:read", "risk:create", "risk:update", "risk:close", "risk:delete",
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
      "risk:read", "risk:create", "risk:update", "risk:close",
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
      "risk:read", "risk:create", "risk:update",
      "defect:read", "defect:create", "defect:update",
      "vessel:read",
    ],
  },
  DPA: {
    desc: "Designated Person Ashore — verifies and closes out non-conformities",
    perms: ["ncr:read", "ncr:update", "ncr:close", "vessel:read"],
  },
  "General Manager": {
    desc: "Top management — verifies and closes out non-conformities",
    perms: ["ncr:read", "ncr:update", "ncr:close", "vessel:read"],
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

  // Sample Emergency Drill
  if (!(await prisma.emergencyDrill.findFirst({ where: { companyId: company.id, refNo: "DR-2026-0001" } }))) {
    await prisma.emergencyDrill.create({
      data: {
        companyId: company.id,
        refNo: "DR-2026-0001",
        vesselId: firstVessel!.id,
        drillType: "FIRE",
        drillDate: new Date(),
        scenario: "Engine room fire, CO2 release drill (simulated).",
        participants: "All crew on board",
        conductedBy: "Capt. Ramon Reyes",
        observations: "Response time within target; one extinguisher due for service.",
        status: "OPEN",
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

  // Sample Risk Assessment
  if (!(await prisma.riskAssessment.findFirst({ where: { companyId: company.id, refNo: "RA-2026-0001" } }))) {
    await prisma.riskAssessment.create({
      data: {
        companyId: company.id,
        refNo: "RA-2026-0001",
        vesselId: firstVessel?.id ?? null,
        activity: "Enclosed space entry for cargo tank cleaning",
        hazards: "Oxygen deficiency, toxic gas, engulfment.",
        existingControls: "Gas-free certificate, permit to work, standby man, rescue equipment.",
        likelihood: "LOW",
        severity: "HIGH",
        additionalControls: "Continuous gas monitoring, comms check every 15 minutes.",
        assessedBy: "Maria Santos",
        assessmentDate: new Date(),
        status: "ACTIVE",
        createdBy: adminId || null,
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
