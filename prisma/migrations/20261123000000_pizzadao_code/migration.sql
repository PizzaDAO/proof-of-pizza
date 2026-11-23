-- Additive only: nullable columns + index.
ALTER TABLE "Submission" ADD COLUMN "pizzadaoCode" TEXT;
ALTER TABLE "Submission" ADD COLUMN "pizzadaoCodeRedeemedAt" TIMESTAMP(3);
ALTER TABLE "Submission" ADD COLUMN "pizzadaoCodeError" TEXT;

CREATE INDEX "Submission_pizzadaoCode_idx" ON "Submission"("pizzadaoCode");
