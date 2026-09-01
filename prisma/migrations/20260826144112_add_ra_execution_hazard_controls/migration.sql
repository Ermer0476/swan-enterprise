-- AlterTable
ALTER TABLE "RiskAssessmentExecution" ADD COLUMN     "execNo" TEXT;

-- CreateTable
CREATE TABLE "RaExecutionHazardSelection" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "hazardRowId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "RaExecutionHazardSelection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaExecutionControl" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "executionId" TEXT NOT NULL,
    "hazardRowId" TEXT NOT NULL,
    "controlText" TEXT NOT NULL,
    "addedBy" TEXT,
    "officeReviewedAt" TIMESTAMP(3),
    "officeReviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaExecutionControl_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RaExecutionHazardSelection_companyId_executionId_idx" ON "RaExecutionHazardSelection"("companyId", "executionId");

-- CreateIndex
CREATE UNIQUE INDEX "RaExecutionHazardSelection_executionId_hazardRowId_key" ON "RaExecutionHazardSelection"("executionId", "hazardRowId");

-- CreateIndex
CREATE INDEX "RaExecutionControl_companyId_executionId_idx" ON "RaExecutionControl"("companyId", "executionId");

-- CreateIndex
CREATE INDEX "RaExecutionControl_companyId_hazardRowId_idx" ON "RaExecutionControl"("companyId", "hazardRowId");

-- CreateIndex
CREATE INDEX "RaExecutionControl_companyId_officeReviewedAt_idx" ON "RaExecutionControl"("companyId", "officeReviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "RiskAssessmentExecution_companyId_execNo_key" ON "RiskAssessmentExecution"("companyId", "execNo");

-- AddForeignKey
ALTER TABLE "RaExecutionHazardSelection" ADD CONSTRAINT "RaExecutionHazardSelection_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "RiskAssessmentExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaExecutionHazardSelection" ADD CONSTRAINT "RaExecutionHazardSelection_hazardRowId_fkey" FOREIGN KEY ("hazardRowId") REFERENCES "RiskHazardRow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaExecutionControl" ADD CONSTRAINT "RaExecutionControl_executionId_fkey" FOREIGN KEY ("executionId") REFERENCES "RiskAssessmentExecution"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RaExecutionControl" ADD CONSTRAINT "RaExecutionControl_hazardRowId_fkey" FOREIGN KEY ("hazardRowId") REFERENCES "RiskHazardRow"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

