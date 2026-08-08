/*
  Warnings:

  - The values [USER_GUIDE] on the enum `DocType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DocType_new" AS ENUM ('README', 'API', 'CONTRIBUTING', 'CHANGELOG', 'CODE_DOC');
ALTER TABLE "documents" ALTER COLUMN "type" TYPE "DocType_new" USING ("type"::text::"DocType_new");
ALTER TYPE "DocType" RENAME TO "DocType_old";
ALTER TYPE "DocType_new" RENAME TO "DocType";
DROP TYPE "public"."DocType_old";
COMMIT;
