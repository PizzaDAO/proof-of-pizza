import { google } from "googleapis";
import path from "path";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_ID;
const SHEET_NAME = "Sheet1";

// Headers for the spreadsheet
const HEADERS = [
  "Submission ID",
  "Timestamp",
  "Wallet Address",
  "ENS Name",
  "Original Amount",
  "Original Currency",
  "USD Amount",
  "Exchange Rate",
  "Receipt Photo URL",
  "Pizza Photo URL",
  "Status",
  "Transaction Hash",
  "Paid Amount (USDC)",
  "Paid At",
  "Reviewed By",
  "Notes",
];

async function getAuthClient() {
  const credentialsPath = path.join(process.cwd(), "google-credentials.json");

  const auth = new google.auth.GoogleAuth({
    keyFile: credentialsPath,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return auth;
}

async function getSheets() {
  const auth = await getAuthClient();
  return google.sheets({ version: "v4", auth });
}

export async function initializeSheet() {
  if (!SPREADSHEET_ID) {
    console.warn("GOOGLE_SHEETS_ID not set, skipping sheet initialization");
    return;
  }

  try {
    const sheets = await getSheets();

    // Check if headers exist
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A1:P1`,
    });

    if (!response.data.values || response.data.values.length === 0) {
      // Add headers
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${SHEET_NAME}!A1:P1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [HEADERS],
        },
      });
      console.log("Initialized spreadsheet with headers");
    }
  } catch (error) {
    console.error("Failed to initialize sheet:", error);
  }
}

export async function logSubmission(submission: {
  id: string;
  walletAddress: string;
  ensName?: string | null;
  extractedAmount: number | string;
  finalAmount: number | string;
  currency: string;
  originalAmount?: number;
  originalCurrency?: string;
  exchangeRate?: number;
  receiptPhotoUrl: string;
  pizzaPhotoUrl: string;
  status: string;
  transactionHash?: string | null;
  paidAmount?: number | string | null;
  paidAt?: Date | string | null;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
  createdAt: Date | string;
}) {
  if (!SPREADSHEET_ID) {
    console.warn("GOOGLE_SHEETS_ID not set, skipping sheet logging");
    return;
  }

  try {
    const sheets = await getSheets();

    const row = [
      submission.id,
      new Date(submission.createdAt).toISOString(),
      submission.walletAddress,
      submission.ensName || "",
      submission.originalAmount ?? submission.extractedAmount,
      submission.originalCurrency ?? submission.currency,
      submission.finalAmount,
      submission.exchangeRate ?? 1,
      submission.receiptPhotoUrl,
      submission.pizzaPhotoUrl,
      submission.status,
      submission.transactionHash || "",
      submission.paidAmount || "",
      submission.paidAt ? new Date(submission.paidAt).toISOString() : "",
      submission.reviewedBy || "",
      submission.rejectionReason || "",
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:P`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [row],
      },
    });

    console.log(`Logged submission ${submission.id} to Google Sheets`);
  } catch (error) {
    console.error("Failed to log submission to sheet:", error);
  }
}

export async function updateSubmissionInSheet(
  submissionId: string,
  updates: {
    status?: string;
    transactionHash?: string | null;
    paidAmount?: number | string | null;
    paidAt?: Date | string | null;
    reviewedBy?: string | null;
    rejectionReason?: string | null;
  }
) {
  if (!SPREADSHEET_ID) {
    console.warn("GOOGLE_SHEETS_ID not set, skipping sheet update");
    return;
  }

  try {
    const sheets = await getSheets();

    // Find the row with this submission ID
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:A`,
    });

    const rows = response.data.values || [];
    const rowIndex = rows.findIndex((row) => row[0] === submissionId);

    if (rowIndex === -1) {
      console.warn(`Submission ${submissionId} not found in sheet`);
      return;
    }

    // Update the specific cells (Status=K, TxHash=L, PaidAmount=M, PaidAt=N, ReviewedBy=O, Notes=P)
    const rowNumber = rowIndex + 1; // 1-indexed

    const updateValues: [string, unknown][] = [];

    if (updates.status !== undefined) {
      updateValues.push([`${SHEET_NAME}!K${rowNumber}`, updates.status]);
    }
    if (updates.transactionHash !== undefined) {
      updateValues.push([`${SHEET_NAME}!L${rowNumber}`, updates.transactionHash || ""]);
    }
    if (updates.paidAmount !== undefined) {
      updateValues.push([`${SHEET_NAME}!M${rowNumber}`, updates.paidAmount || ""]);
    }
    if (updates.paidAt !== undefined) {
      updateValues.push([`${SHEET_NAME}!N${rowNumber}`, updates.paidAt ? new Date(updates.paidAt).toISOString() : ""]);
    }
    if (updates.reviewedBy !== undefined) {
      updateValues.push([`${SHEET_NAME}!O${rowNumber}`, updates.reviewedBy || ""]);
    }
    if (updates.rejectionReason !== undefined) {
      updateValues.push([`${SHEET_NAME}!P${rowNumber}`, updates.rejectionReason || ""]);
    }

    // Batch update
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        valueInputOption: "RAW",
        data: updateValues.map(([range, value]) => ({
          range: range as string,
          values: [[value]],
        })),
      },
    });

    console.log(`Updated submission ${submissionId} in Google Sheets`);
  } catch (error) {
    console.error("Failed to update submission in sheet:", error);
  }
}
