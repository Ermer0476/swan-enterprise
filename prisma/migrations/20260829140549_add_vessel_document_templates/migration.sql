-- CreateTable
CREATE TABLE "VesselDocumentTemplateItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "VesselDocumentTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VesselDocumentApplicability" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vesselId" TEXT NOT NULL,
    "templateItemId" TEXT NOT NULL,
    "notApplicable" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "VesselDocumentApplicability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VesselDocumentTemplateItem_companyId_active_sortOrder_idx" ON "VesselDocumentTemplateItem"("companyId", "active", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "VesselDocumentTemplateItem_companyId_type_name_key" ON "VesselDocumentTemplateItem"("companyId", "type", "name");

-- CreateIndex
CREATE UNIQUE INDEX "VesselDocumentApplicability_companyId_vesselId_templateItem_key" ON "VesselDocumentApplicability"("companyId", "vesselId", "templateItemId");

-- AddForeignKey
ALTER TABLE "VesselDocumentTemplateItem" ADD CONSTRAINT "VesselDocumentTemplateItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VesselDocumentApplicability" ADD CONSTRAINT "VesselDocumentApplicability_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VesselDocumentApplicability" ADD CONSTRAINT "VesselDocumentApplicability_vesselId_fkey" FOREIGN KEY ("vesselId") REFERENCES "Vessel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VesselDocumentApplicability" ADD CONSTRAINT "VesselDocumentApplicability_templateItemId_fkey" FOREIGN KEY ("templateItemId") REFERENCES "VesselDocumentTemplateItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
