// One-off import of the TMSA Hub data ported from the Swan-GCC app's sqlite
// DB (266 TmsaAssessment KPI answers, 19 TmsaScore rows, 120 TmsaFinding CAP
// items) into this app's Postgres TMSA tables, scoped to the Swan Shipping
// Corporation company. Source JSON was dumped from swan-gcc's prisma/dev.db
// via `sqlite3 ... .mode json ... .output ...` and copied into the session
// scratchpad. Rerunnable safely — each insert is upsert-by-natural-key.
// Usage: npx tsx scripts/migrate-tmsa-from-gcc.ts
import { readFileSync } from "fs";
import { prisma } from "../lib/prisma";

const DUMP_DIR =
  "/private/tmp/claude-501/-Users-ermermagbanua-Documents-My-FIle-Claude-Project-Folder/73c5605b-8ab7-484d-8195-4b091af8a575/scratchpad";

type GccAssessment = {
  id: string;
  code: string;
  elementNumber: number;
  elementCode: string;
  stage: number;
  questionNo: number;
  kpiDescription: string;
  complianceStatus: "Yes" | "No";
  remarks: string | null;
  bpg: string | null;
  revision: number;
  responseState: "ON_OCIMF" | "REVISED";
  revisedAt: string | null;
  uploadedAt: string | null;
};

type GccScore = {
  id: string;
  year: number;
  elementCode: string;
  elementBase: number;
  sortOrder: number;
  title: string;
  s1Yes: number; s1Req: number;
  s2Yes: number; s2Req: number;
  s3Yes: number; s3Req: number;
  s4Yes: number; s4Req: number;
  noCount: number;
  reqTotal: number;
  rating: number;
  stageCleared: number;
};

type GccFinding = {
  id: string;
  code: string;
  seq: number;
  auditYear: number;
  elementCode: string;
  elementBase: number;
  stageQ: string;
  stage: number;
  questionNo: number;
  kpiRef: string;
  source: string;
  observation: string;
  correctiveAction: string;
  status: "OPEN" | "IN PROGRESS" | "CLOSED";
  responsible: string;
  target: string;
};

function loadJson<T>(name: string): T[] {
  return JSON.parse(readFileSync(`${DUMP_DIR}/${name}.json`, "utf8"));
}

async function main() {
  const company = await prisma.company.findFirst({ where: { code: "SWAN" } });
  if (!company) throw new Error('Company with code "SWAN" not found — run prisma/seed.ts first.');
  const companyId = company.id;

  const assessments = loadJson<GccAssessment>("tmsa_assessment");
  const scores = loadJson<GccScore>("tmsa_score");
  const findings = loadJson<GccFinding>("tmsa_finding");

  let a = 0;
  for (const row of assessments) {
    await prisma.tmsaAssessment.upsert({
      where: { companyId_code: { companyId, code: row.code } },
      create: {
        companyId,
        code: row.code,
        elementNumber: row.elementNumber,
        elementCode: row.elementCode,
        stage: row.stage,
        questionNo: row.questionNo,
        kpiDescription: row.kpiDescription,
        complianceStatus: row.complianceStatus === "Yes" ? "YES" : "NO",
        remarks: row.remarks,
        bpg: row.bpg,
        revision: row.revision,
        responseState: row.responseState,
        revisedAt: row.revisedAt ? new Date(row.revisedAt) : null,
        uploadedAt: row.uploadedAt ? new Date(row.uploadedAt) : null,
        createdBy: "migration:swan-gcc",
        updatedBy: "migration:swan-gcc",
      },
      update: {},
    });
    a++;
  }
  console.log(`TmsaAssessment: upserted ${a} row(s).`);

  let s = 0;
  for (const row of scores) {
    await prisma.tmsaScore.upsert({
      where: { companyId_year_elementCode: { companyId, year: row.year, elementCode: row.elementCode } },
      create: {
        companyId,
        year: row.year,
        elementCode: row.elementCode,
        elementBase: row.elementBase,
        sortOrder: row.sortOrder,
        title: row.title,
        s1Yes: row.s1Yes, s1Req: row.s1Req,
        s2Yes: row.s2Yes, s2Req: row.s2Req,
        s3Yes: row.s3Yes, s3Req: row.s3Req,
        s4Yes: row.s4Yes, s4Req: row.s4Req,
        noCount: row.noCount,
        reqTotal: row.reqTotal,
        rating: row.rating,
        stageCleared: row.stageCleared,
        createdBy: "migration:swan-gcc",
        updatedBy: "migration:swan-gcc",
      },
      update: {},
    });
    s++;
  }
  console.log(`TmsaScore: upserted ${s} row(s).`);

  let f = 0;
  for (const row of findings) {
    await prisma.tmsaFinding.upsert({
      where: { companyId_code: { companyId, code: row.code } },
      create: {
        companyId,
        code: row.code,
        seq: row.seq,
        auditYear: row.auditYear,
        elementCode: row.elementCode,
        elementBase: row.elementBase,
        stageQ: row.stageQ,
        stage: row.stage,
        questionNo: row.questionNo,
        kpiRef: row.kpiRef,
        source: row.source,
        observation: row.observation,
        correctiveAction: row.correctiveAction,
        status: row.status.replace(" ", "_") as "OPEN" | "IN_PROGRESS" | "CLOSED",
        responsible: row.responsible,
        target: row.target,
        createdBy: "migration:swan-gcc",
        updatedBy: "migration:swan-gcc",
      },
      update: {},
    });
    f++;
  }
  console.log(`TmsaFinding: upserted ${f} row(s).`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
