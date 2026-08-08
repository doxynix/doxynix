/*
  Warnings:

  - Added the required column `jobId` to the `analyses` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "analyses" ADD COLUMN     "jobId" TEXT NOT NULL;
