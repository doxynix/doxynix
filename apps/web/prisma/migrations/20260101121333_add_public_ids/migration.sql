/*
  Warnings:

  - A unique constraint covering the columns `[public_id]` on the table `analyses` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[public_id]` on the table `documents` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[public_id]` on the table `repos` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[owner,name,user_id]` on the table `repos` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[public_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - The required column `public_id` was added to the `analyses` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `public_id` was added to the `documents` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `public_id` was added to the `repos` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.
  - The required column `public_id` was added to the `users` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterEnum
ALTER TYPE "Status" ADD VALUE 'NEW';

-- DropIndex
DROP INDEX "repos_owner_name_key";

-- AlterTable
ALTER TABLE "analyses" ADD COLUMN     "public_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "public_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "repos" ADD COLUMN     "public_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "public_id" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "analyses_public_id_key" ON "analyses"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "documents_public_id_key" ON "documents"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "repos_public_id_key" ON "repos"("public_id");

-- CreateIndex
CREATE UNIQUE INDEX "repos_owner_name_user_id_key" ON "repos"("owner", "name", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_public_id_key" ON "users"("public_id");
