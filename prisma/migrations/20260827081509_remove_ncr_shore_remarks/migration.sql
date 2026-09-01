/*
  Warnings:

  - You are about to drop the column `shoreRemarks` on the `NonConformity` table. All the data in the column will be lost.
  - You are about to drop the column `shoreRemarksAt` on the `NonConformity` table. All the data in the column will be lost.
  - You are about to drop the column `shoreRemarksByUserId` on the `NonConformity` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "NonConformity" DROP CONSTRAINT "NonConformity_shoreRemarksByUserId_fkey";

-- AlterTable
ALTER TABLE "NonConformity" DROP COLUMN "shoreRemarks",
DROP COLUMN "shoreRemarksAt",
DROP COLUMN "shoreRemarksByUserId";
