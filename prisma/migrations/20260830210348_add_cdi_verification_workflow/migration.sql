-- CreateEnum
CREATE TYPE "CdiObservationStatus" AS ENUM ('OPEN', 'ONGOING', 'PENDING_VERIFICATION', 'CLOSED');

-- AlterTable
ALTER TABLE "CdiObservation" ADD COLUMN     "actualCompletionDate" TIMESTAMP(3),
ADD COLUMN     "responsiblePersonId" TEXT,
ADD COLUMN     "targetDate" TIMESTAMP(3),
ADD COLUMN     "verifiedById" TEXT;

-- AlterTable: cast existing status values across to the new enum instead of
-- dropping the column, so real observation statuses aren't lost (every value
-- in the old FindingStatus enum also exists in CdiObservationStatus).
ALTER TABLE "CdiObservation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "CdiObservation" ALTER COLUMN "status" TYPE "CdiObservationStatus" USING ("status"::text::"CdiObservationStatus");
ALTER TABLE "CdiObservation" ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- DropEnum
DROP TYPE "FindingStatus";

-- AddForeignKey
ALTER TABLE "CdiObservation" ADD CONSTRAINT "CdiObservation_responsiblePersonId_fkey" FOREIGN KEY ("responsiblePersonId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CdiObservation" ADD CONSTRAINT "CdiObservation_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
