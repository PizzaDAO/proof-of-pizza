import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function checkTables() {
  const sql = neon(process.env.DATABASE_URL!);

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;

  console.log("Tables in database:", tables.map(t => t.table_name));

  // Try to query Submission
  try {
    const count = await sql`SELECT COUNT(*) as count FROM "Submission"`;
    console.log("Submission count:", count[0].count);
  } catch (e: unknown) {
    console.log("Submission table error:", (e as Error).message);
  }
}

checkTables();
