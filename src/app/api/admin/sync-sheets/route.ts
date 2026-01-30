import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { google } from "googleapis";
import path from "path";
import fs from "fs";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SHEET_NAME = "Sheet1";

function verifyAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const password = authHeader.replace("Bearer ", "");
  return password === process.env.ADMIN_PASSWORD;
}

async function getAuthClient() {
  let credentials;

  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  } else {
    const credentialsPath = path.join(process.cwd(), "google-credentials.json");
    const credentialsFile = fs.readFileSync(credentialsPath, "utf-8");
    credentials = JSON.parse(credentialsFile);
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return auth;
}

async function getSheets() {
  const auth = await getAuthClient();
  return google.sheets({ version: "v4", auth });
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!SPREADSHEET_ID) {
    return NextResponse.json(
      { error: "GOOGLE_SHEETS_ID not configured" },
      { status: 500 }
    );
  }

  try {
    const sheets = await getSheets();

    // Get all submission IDs from the sheet
    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:A`,
    });

    const existingIds = new Set(
      (sheetResponse.data.values || [])
        .flat()
        .filter((id) => id && id !== "Submission ID")
    );

    // Get all submissions from database
    const submissions = await prisma.submission.findMany({
      orderBy: { createdAt: "asc" },
    });

    // Find missing submissions
    const missingSubmissions = submissions.filter(
      (s) => !existingIds.has(s.id)
    );

    if (missingSubmissions.length === 0) {
      return NextResponse.json({
        message: "All submissions are already in the sheet",
        synced: 0,
      });
    }

    // Add missing submissions to sheet
    const rows = missingSubmissions.map((s) => [
      s.id,
      s.createdAt.toISOString(),
      s.walletAddress,
      s.ensName || "",
      s.extractedAmount.toString(),
      s.currency,
      s.finalAmount.toString(),
      1, // exchange rate
      s.receiptPhotoUrl,
      s.pizzaPhotoUrl,
      s.status,
      s.transactionHash || "",
      s.paidAmount?.toString() || "",
      s.paidAt?.toISOString() || "",
      s.reviewedBy || "",
      s.rejectionReason || "",
    ]);

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:P`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: rows,
      },
    });

    return NextResponse.json({
      message: `Synced ${missingSubmissions.length} submissions to Google Sheets`,
      synced: missingSubmissions.length,
      ids: missingSubmissions.map((s) => ({ id: s.id, ens: s.ensName, wallet: s.walletAddress })),
    });
  } catch (error) {
    console.error("Failed to sync sheets:", error);
    return NextResponse.json(
      { error: "Failed to sync sheets" },
      { status: 500 }
    );
  }
}
