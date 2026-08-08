/*
  Warnings:

  - A unique constraint covering the columns `[public_id]` on the table `accounts` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[public_id]` on the table `sessions` will be added. If there are existing duplicate values, this will fail.
  - The required column `public_id` was added to the `accounts` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `public_id` was added to the `sessions` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "public_id" UUID NOT NULL;

-- AlterTable
ALTER TABLE "sessions" ADD COLUMN     "public_id" UUID NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "accounts_public_id_key" ON "accounts"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_public_id_key" ON "sessions"("public_id");
