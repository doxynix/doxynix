/*
  Warnings:

  - A unique constraint covering the columns `[image_key]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "users_image_key_key" ON "users"("image_key");
