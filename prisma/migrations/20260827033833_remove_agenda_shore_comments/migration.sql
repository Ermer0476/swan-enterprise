/*
  Warnings:

  - You are about to drop the column `shoreComments` on the `CommitteeMeetingAgenda` table. All the data in the column will be lost.
  - You are about to drop the column `shoreCommentsAt` on the `CommitteeMeetingAgenda` table. All the data in the column will be lost.
  - You are about to drop the column `shoreCommentsByUserId` on the `CommitteeMeetingAgenda` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "CommitteeMeetingAgenda" DROP CONSTRAINT "CommitteeMeetingAgenda_shoreCommentsByUserId_fkey";

-- AlterTable
ALTER TABLE "CommitteeMeetingAgenda" DROP COLUMN "shoreComments",
DROP COLUMN "shoreCommentsAt",
DROP COLUMN "shoreCommentsByUserId";
