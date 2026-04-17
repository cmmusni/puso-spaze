-- AlterTable
ALTER TABLE "users" ADD COLUMN     "lastStreakDate" TIMESTAMP(3),
ADD COLUMN     "streakCount" INTEGER NOT NULL DEFAULT 0;
