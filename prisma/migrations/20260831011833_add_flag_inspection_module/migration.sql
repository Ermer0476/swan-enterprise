-- CreateTable
CREATE TABLE "FlagInspection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "refNo" TEXT NOT NULL,
    "vesselId" TEXT,
    "scope" TEXT NOT NULL,
    "standard" TEXT NOT NULL,
    "auditorName" TEXT,
    "auditBody" TEXT,
    "auditDate" TIMESTAMP(3) NOT NULL,
    "summary" TEXT,
    "status" "InspectionStatus" NOT NULL DEFAULT 'OPEN',
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "FlagInspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlagInspectionFinding" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "auditId" TEXT NOT NULL,
    "category" "AuditFindingCategory" NOT NULL,
    "reference" TEXT,
    "description" TEXT NOT NULL,
    "rootCauseCategory" "RootCauseCategory",
    "rootCauseSubCategory" TEXT,
    "rootCause" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "FlagInspectionFinding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FlagInspection_companyId_status_idx" ON "FlagInspection"("companyId", "status");

-- CreateIndex
CREATE INDEX "FlagInspection_companyId_vesselId_idx" ON "FlagInspection"("companyId", "vesselId");

-- CreateIndex
CREATE INDEX "FlagInspection_companyId_auditDate_idx" ON "FlagInspection"("companyId", "auditDate");

-- CreateIndex
CREATE UNIQUE INDEX "FlagInspection_companyId_refNo_key" ON "FlagInspection"("companyId", "refNo");

-- CreateIndex
CREATE INDEX "FlagInspectionFinding_auditId_idx" ON "FlagInspectionFinding"("auditId");

-- AddForeignKey
ALTER TABLE "FlagInspection" ADD CONSTRAINT "FlagInspection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlagInspection" ADD CONSTRAINT "FlagInspection_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FlagInspectionFinding" ADD CONSTRAINT "FlagInspectionFinding_auditId_fkey" FOREIGN KEY ("auditId") REFERENCES "FlagInspection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
