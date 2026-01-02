/*
  Warnings:

  - You are about to drop the column `key` on the `api_keys` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[hashedKey]` on the table `api_keys` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `hashedKey` to the `api_keys` table without a default value. This is not possible if the table is not empty.
  - Added the required column `prefix` to the `api_keys` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "api_keys_key_key";

-- AlterTable
ALTER TABLE "api_keys" DROP COLUMN "key",
ADD COLUMN     "hashedKey" TEXT NOT NULL,
ADD COLUMN     "prefix" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "api_keys_hashedKey_key" ON "api_keys"("hashedKey");
