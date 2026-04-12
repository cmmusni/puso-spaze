-- AlterTable
ALTER TABLE "recovery_requests" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "reviewedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "webPushSubscription" JSONB;

-- RenameIndex
ALTER INDEX "recovery_requests_status_created_idx" RENAME TO "recovery_requests_status_createdAt_idx";
