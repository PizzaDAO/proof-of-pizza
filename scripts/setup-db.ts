import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function setupDatabase() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }

  console.log("Connecting to database...");
  const sql = neon(connectionString);

  try {
    // Check existing tables
    const tables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log("Existing tables:", tables.map((t) => t.table_name));

    // Create enum type if it doesn't exist
    console.log("Creating SubmissionStatus enum...");
    await sql`
      DO $$ BEGIN
        CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'PAID');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$
    `;

    // Create Submission table
    console.log("Creating Submission table...");
    await sql`
      CREATE TABLE IF NOT EXISTS "Submission" (
        "id" TEXT NOT NULL,
        "walletAddress" TEXT NOT NULL,
        "ensName" TEXT,
        "pizzaPhotoUrl" TEXT NOT NULL,
        "receiptPhotoUrl" TEXT NOT NULL,
        "extractedAmount" DECIMAL(10,2) NOT NULL,
        "finalAmount" DECIMAL(10,2) NOT NULL,
        "currency" TEXT NOT NULL DEFAULT 'USD',
        "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
        "reviewedBy" TEXT,
        "reviewedAt" TIMESTAMP(3),
        "rejectionReason" TEXT,
        "transactionHash" TEXT,
        "paidAt" TIMESTAMP(3),
        "paidAmount" DECIMAL(18,6),
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
      )
    `;

    // Create indexes
    console.log("Creating indexes...");
    await sql`CREATE INDEX IF NOT EXISTS "Submission_status_idx" ON "Submission"("status")`;
    await sql`CREATE INDEX IF NOT EXISTS "Submission_walletAddress_idx" ON "Submission"("walletAddress")`;
    await sql`CREATE INDEX IF NOT EXISTS "Submission_createdAt_idx" ON "Submission"("createdAt")`;

    // Create AuthorizedReimburser table
    console.log("Creating AuthorizedReimburser table...");
    await sql`
      CREATE TABLE IF NOT EXISTS "AuthorizedReimburser" (
        "id" TEXT NOT NULL,
        "walletAddress" TEXT NOT NULL,
        "name" TEXT,
        "isActive" BOOLEAN NOT NULL DEFAULT true,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "AuthorizedReimburser_pkey" PRIMARY KEY ("id")
      )
    `;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS "AuthorizedReimburser_walletAddress_key" ON "AuthorizedReimburser"("walletAddress")`;

    // Verify tables were created
    const newTables = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    console.log("Tables after setup:", newTables.map((t) => t.table_name));

    console.log("Database setup complete!");
  } catch (error) {
    console.error("Setup failed:", error);
    process.exit(1);
  }
}

setupDatabase();
