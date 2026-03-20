-- AlterTable: Add multi-photo array columns
ALTER TABLE "Submission" ADD COLUMN "pizzaPhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Submission" ADD COLUMN "receiptPhotoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Backfill: Copy existing single-URL values into the new array columns
UPDATE "Submission" SET "pizzaPhotoUrls" = ARRAY["pizzaPhotoUrl"], "receiptPhotoUrls" = ARRAY["receiptPhotoUrl"];
