-- CreateTable
CREATE TABLE IF NOT EXISTS "recovery_requests" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "displayName" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "recovery_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "recovery_requests_status_created_idx" ON "recovery_requests"("status", "createdAt");

