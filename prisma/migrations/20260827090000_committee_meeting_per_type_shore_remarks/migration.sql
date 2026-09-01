-- CreateTable
CREATE TABLE "CommitteeMeetingTypeRemarks" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "committeeType" "CommitteeType" NOT NULL,
    "shoreRemarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "CommitteeMeetingTypeRemarks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CommitteeMeetingTypeRemarks_meetingId_idx" ON "CommitteeMeetingTypeRemarks"("meetingId");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeMeetingTypeRemarks_meetingId_committeeType_key" ON "CommitteeMeetingTypeRemarks"("meetingId", "committeeType");

-- AddForeignKey
ALTER TABLE "CommitteeMeetingTypeRemarks" ADD CONSTRAINT "CommitteeMeetingTypeRemarks_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "CommitteeMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: copy each existing meeting's single overall shoreRemarks into a
-- row per distinct committee type actually present in its agenda, so a
-- previously-closed meeting doesn't lose its office reply once the old
-- combined column is dropped below. (A meeting spanning several types can't
-- be un-mixed retroactively — the same text lands in every one of its
-- types, and the office can split it apart going forward.)
INSERT INTO "CommitteeMeetingTypeRemarks" ("id", "companyId", "meetingId", "committeeType", "shoreRemarks", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, cm."companyId", cm."id", t."committeeType", cm."shoreRemarks", now(), now()
FROM "CommitteeMeeting" cm
JOIN (SELECT DISTINCT "meetingId", "committeeType" FROM "CommitteeMeetingAgenda") t ON t."meetingId" = cm."id"
WHERE cm."shoreRemarks" IS NOT NULL;

-- AlterTable
ALTER TABLE "CommitteeMeeting" DROP COLUMN "shoreRemarks";
