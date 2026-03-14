/*
  Warnings:

  - A unique constraint covering the columns `[model,request_id]` on the table `audit_logs` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "audit_logs_model_request_id_key" ON "audit_logs"("model", "request_id");
