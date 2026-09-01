-- CreateEnum
CREATE TYPE "RaFeedbackDisposition" AS ENUM ('ADDED_TO_TEMPLATE', 'NOT_ADDED', 'ALREADY_COVERED', 'FURTHER_REVIEW_REQUIRED');

-- AlterTable
ALTER TABLE "RaExecutionControl" ADD COLUMN     "disposition" "RaFeedbackDisposition";

-- AlterTable
ALTER TABLE "RiskAssessmentRevisionRequest" ADD COLUMN     "disposition" "RaFeedbackDisposition";

-- AlterTable
ALTER TABLE "RiskHazardRow" ADD COLUMN     "disposition" "RaFeedbackDisposition",
ADD COLUMN     "officeReviewedAt" TIMESTAMP(3),
ADD COLUMN     "officeReviewedBy" TEXT;
