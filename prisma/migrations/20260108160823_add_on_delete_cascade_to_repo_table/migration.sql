-- DropForeignKey
ALTER TABLE "repos" DROP CONSTRAINT "repos_user_id_fkey";

-- AddForeignKey
ALTER TABLE "repos" ADD CONSTRAINT "repos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
