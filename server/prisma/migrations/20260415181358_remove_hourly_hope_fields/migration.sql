/*
  Warnings:

  - You are about to drop the column `hourlyHopeEnabled` on the `app_config` table. All the data in the column will be lost.
  - You are about to drop the column `hourlyHopePostingEnabled` on the `app_config` table. All the data in the column will be lost.
  - You are about to drop the column `hourlyHopeVisible` on the `app_config` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "app_config" DROP COLUMN "hourlyHopeEnabled",
DROP COLUMN "hourlyHopePostingEnabled",
DROP COLUMN "hourlyHopeVisible";
