-- DropIndex
DROP INDEX "ScheduleItem_companyId_kind_itemNo_key";

-- DropIndex
DROP INDEX "ScheduleItem_companyId_kind_sortOrder_idx";

-- AlterTable
ALTER TABLE "ScheduleItem" ADD COLUMN     "flag" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "ScheduleItem_companyId_kind_flag_sortOrder_idx" ON "ScheduleItem"("companyId", "kind", "flag", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleItem_companyId_kind_flag_itemNo_key" ON "ScheduleItem"("companyId", "kind", "flag", "itemNo");
