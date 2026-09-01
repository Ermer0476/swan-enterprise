-- AlterEnum
ALTER TYPE "ReviewTrigger" ADD VALUE 'MANAGEMENT_OF_CHANGE';

-- AlterTable
ALTER TABLE "RaExecutionHazardSelection" ADD COLUMN     "likelihood" INTEGER,
ADD COLUMN     "resLikelihood" INTEGER,
ADD COLUMN     "severity" INTEGER;
