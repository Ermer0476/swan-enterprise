-- AlterTable
ALTER TABLE "CommitteeMeetingAgenda" ADD COLUMN     "shoreCommentsAt" TIMESTAMP(3),
ADD COLUMN     "shoreCommentsByUserId" TEXT;

-- AlterTable
ALTER TABLE "NearMiss" ADD COLUMN     "shoreRemarksAt" TIMESTAMP(3),
ADD COLUMN     "shoreRemarksByUserId" TEXT;

-- AlterTable
ALTER TABLE "NonConformity" ADD COLUMN     "shoreRemarksAt" TIMESTAMP(3),
ADD COLUMN     "shoreRemarksByUserId" TEXT;

-- AddForeignKey
ALTER TABLE "NearMiss" ADD CONSTRAINT "NearMiss_shoreRemarksByUserId_fkey" FOREIGN KEY ("shoreRemarksByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonConformity" ADD CONSTRAINT "NonConformity_shoreRemarksByUserId_fkey" FOREIGN KEY ("shoreRemarksByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMeetingAgenda" ADD CONSTRAINT "CommitteeMeetingAgenda_shoreCommentsByUserId_fkey" FOREIGN KEY ("shoreCommentsByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
