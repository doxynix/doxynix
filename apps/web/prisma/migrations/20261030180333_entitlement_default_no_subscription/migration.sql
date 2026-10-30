-- AlterTable
-- Existing rows keep their value; only the default for new workspaces changes.
ALTER TABLE "workspace_entitlements" ALTER COLUMN "access_state" SET DEFAULT 'NO_SUBSCRIPTION';
