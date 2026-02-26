/*
  Warnings:

  - The values [AMEN,HEART] on the enum `ReactionType` will be removed. If these variants are still used in the database, this will fail.
  - A unique constraint covering the columns `[displayName]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'COACH', 'ADMIN');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('REACTION', 'COMMENT', 'ENCOURAGEMENT', 'SYSTEM');

-- AlterEnum
BEGIN;
CREATE TYPE "ReactionType_new" AS ENUM ('PRAY', 'CARE', 'SUPPORT');
ALTER TABLE "reactions" ALTER COLUMN "type" TYPE "ReactionType_new" USING ("type"::text::"ReactionType_new");
ALTER TYPE "ReactionType" RENAME TO "ReactionType_old";
ALTER TYPE "ReactionType_new" RENAME TO "ReactionType";
DROP TYPE "ReactionType_old";
COMMIT;

-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'REVIEW';

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "pinned" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "expoPushToken" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "invite_codes" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "usedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "invite_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invite_codes_code_key" ON "invite_codes"("code");

-- CreateIndex
CREATE INDEX "notifications_userId_read_idx" ON "notifications"("userId", "read");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "users_displayName_key" ON "users"("displayName");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
