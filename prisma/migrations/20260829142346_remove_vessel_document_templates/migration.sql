/*
  Warnings:

  - You are about to drop the `VesselDocumentApplicability` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `VesselDocumentTemplateItem` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "VesselDocumentApplicability" DROP CONSTRAINT "VesselDocumentApplicability_companyId_fkey";

-- DropForeignKey
ALTER TABLE "VesselDocumentApplicability" DROP CONSTRAINT "VesselDocumentApplicability_templateItemId_fkey";

-- DropForeignKey
ALTER TABLE "VesselDocumentApplicability" DROP CONSTRAINT "VesselDocumentApplicability_vesselId_fkey";

-- DropForeignKey
ALTER TABLE "VesselDocumentTemplateItem" DROP CONSTRAINT "VesselDocumentTemplateItem_companyId_fkey";

-- DropTable
DROP TABLE "VesselDocumentApplicability";

-- DropTable
DROP TABLE "VesselDocumentTemplateItem";
