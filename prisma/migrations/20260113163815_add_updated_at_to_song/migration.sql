/*
  Warnings:

  - Added the required column `updatedAt` to the `Song` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
-- Add column as nullable first
ALTER TABLE "Song" ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Set all existing songs to 12/31/2025
UPDATE "Song" SET "updatedAt" = '2025-12-31 00:00:00'::timestamp;

-- Now make it NOT NULL
ALTER TABLE "Song" ALTER COLUMN "updatedAt" SET NOT NULL;
