-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pin" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "users_pin_key" ON "users"("pin");
