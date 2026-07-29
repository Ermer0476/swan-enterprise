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
      "hazard:read", "hazard:create", "hazard:update", "hazard:close", "hazard:delete",
      "ncr:read", "ncr:create", "ncr:update", "ncr:close", "ncr:delete",
      "sire:read", "sire:create", "sire:update", "sire:close", "sire:delete",
      "psc:read", "psc:create", "psc:update", "psc:close", "psc:delete",
      "cdi:read", "cdi:create", "cdi:update", "cdi:close", "cdi:delete",
      "iaudit:read", "iaudit:create", "iaudit:update", "iaudit:close", "iaudit:delete",
      "eaudit:read", "eaudit:create", "eaudit:update", "eaudit:close", "eaudit:delete",
      "vessel:read",
    ],
  },
  "Marine Superintendent": {
    desc: "Authors/submits SMS documents; investigates safety reports & inspections",
    perms: [
      "sms:read", "sms:create", "sms:update", "sms:submit",
      "incident:read", "incident:create", "incident:update",
      "nm:read", "nm:create", "nm:update",
      "hazard:read", "hazard:create", "hazard:update",
      "ncr:read", "ncr:create", "ncr:update",
      "sire:read", "sire:create", "sire:update",
      "psc:read", "psc:create", "psc:update",
      "cdi:read", "cdi:create", "cdi:update",
      "iaudit:read", "iaudit:create", "iaudit:update",
      "eaudit:read", "eaudit:create", "eaudit:update",
      "vessel:read", "vessel:create", "vessel:update", "vessel:delete",
    ],
  },
  "Ship Officer": {
    desc: "Reads controlled documents; reports safety observations onboard",
    perms: [
      "sms:read",
      "incident:read", "incident:create",
      "nm:read", "nm:create",
      "hazard:read", "hazard:create",
      "ncr:read",
      "sire:read", "psc:read", "cdi:read",
      "iaudit:read", "eaudit:read",
      "vessel:read",
    ],
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
  { email: "master@swanshipping.com", name: "Capt. Ramon Reyes", role: "Ship Officer", department: "SHIPBOARD", rank: "Master" },
];

const VESSELS = [
  {
    name: "Swan Aquarius",
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
      skipDuplicates: true,
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
        humanFactorPrimary: "SITUATIONAL_AWARENESS",
        humanFactorContributing: ["WORKLOAD_MULTITASKING"],
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
        humanFactorPrimary: "SITUATIONAL_AWARENESS",
        status: "UNDER_REVIEW",
        reportedById: adminId || null,
        createdBy: adminId || null,
      },
    });
  }

  // Sample Hazard Observation
  if (!(await prisma.hazardObservation.findFirst({ where: { companyId: company.id, refNo: "HOR-2026-0001" } }))) {
    await prisma.hazardObservation.create({
      data: {
        companyId: company.id,
        refNo: "HOR-2026-0001",
        title: "Missing gratings guard near engine room walkway",
        vesselId: firstVessel?.id ?? null,
        observedAt: new Date(),
        location: "Engine room, 2nd platform",
        category: "Slips / Trips / Falls",
        hazardType: "UNSAFE_CONDITION",
        riskLevel: "MEDIUM",
        observation:
          "A section of floor grating guard is missing near the walkway, presenting a trip/fall hazard.",
        immediateAction: "Area barriered off and warning sign posted.",
        status: "OPEN",
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
        sireVersion: "2.0",
        summary: "Two observations raised; no critical findings.",
        status: "IN_PROGRESS",
        createdBy: adminId || null,
        observations: {
          create: [
            {
              companyId: company.id,
              viqRef: "3.1",
              category: "Process",
              observation: "Bridge passage plan not signed by the Master for the current voyage.",
              status: "OPEN",
              createdBy: adminId || null,
            },
            {
              companyId: company.id,
              viqRef: "9.4",
              category: "Hardware",
              observation: "One EEBD stowage location not clearly marked.",
              response: "Signage renewed; photo evidence filed.",
              status: "CLOSED",
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
              status: "OPEN",
              createdBy: adminId || null,
            },
            {
              companyId: company.id,
              natureCode: "11101",
              reference: "MLC 3.1",
              actionCode: "17",
              description: "Galley exhaust not adequately cleaned.",
              rectification: "Cleaned and logged; PMS job created.",
              status: "CLOSED",
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
              status: "OPEN",
              createdBy: adminId || null,
            },
            {
              companyId: company.id,
              category: "OBSERVATION",
              reference: "ISM 7",
              description: "Consider adding a checklist for enclosed-space entry drills.",
              correctiveAction: "Checklist drafted; pending approval.",
              status: "CLOSED",
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
              status: "OPEN",
              createdBy: adminId || null,
            },
          ],
        },
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
