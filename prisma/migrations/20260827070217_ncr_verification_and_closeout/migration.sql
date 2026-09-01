-- CreateEnum
CREATE TYPE "NcrVerificationOutcome" AS ENUM ('COMPLETED', 'FOLLOWUP_REQUIRED');

-- AlterEnum
ALTER TYPE "NcrStatus" ADD VALUE 'VERIFIED';

-- AlterTable
ALTER TABLE "NonConformity" ADD COLUMN     "assistanceNature" TEXT,
ADD COLUMN     "assistanceRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "closeOutFollowUpNature" TEXT,
ADD COLUMN     "closeOutFollowUpRequired" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "closedByUserId" TEXT,
ADD COLUMN     "departmentName" TEXT,
ADD COLUMN     "reporterName" TEXT,
ADD COLUMN     "verificationFollowUpNature" TEXT,
ADD COLUMN     "verificationOutcome" "NcrVerificationOutcome",
ADD COLUMN     "verifiedAt" TIMESTAMP(3),
ADD COLUMN     "verifiedByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_closedByUserId_fkey" FOREIGN KEY ("closedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
