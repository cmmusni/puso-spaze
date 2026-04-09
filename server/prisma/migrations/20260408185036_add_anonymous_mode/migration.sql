-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "anonDisplayName" TEXT,
ADD COLUMN     "isAnonymous" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isAnonymous" BOOLEAN NOT NULL DEFAULT false;
