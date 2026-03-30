-- AlterTable
ALTER TABLE "Submission" ADD COLUMN "originalAmount" DECIMAL(10,2);
ALTER TABLE "Submission" ADD COLUMN "originalCurrency" TEXT;
ALTER TABLE "Submission" ADD COLUMN "exchangeRate" DECIMAL(18,6);
