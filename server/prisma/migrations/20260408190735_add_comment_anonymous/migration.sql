-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "anonDisplayName" TEXT,
ADD COLUMN     "isAnonymous" BOOLEAN NOT NULL DEFAULT false;
