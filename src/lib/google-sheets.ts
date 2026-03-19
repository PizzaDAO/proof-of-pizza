import { google } from "googleapis";
import path from "path";
import fs from "fs";

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
  let credentials;

  // Try env var first (production)
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  } else {
    // Fall back to file (local development)
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
  },
  fullSubmission?: {
    walletAddress: string;
    ensName?: string | null;
    extractedAmount: number | string;
    finalAmount: number | string;
    currency: string;
    receiptPhotoUrl: string;
    pizzaPhotoUrl: string;
    receiptPhotoUrls?: string[];
    pizzaPhotoUrls?: string[];
    createdAt: Date | string;
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
      // Row not found - add it if we have full submission data
      if (fullSubmission) {
        console.log(`Submission ${submissionId} not in sheet, adding it now`);
        // Use array URLs joined with " ; " if available, otherwise single URL
        const receiptUrlForSheet =
          fullSubmission.receiptPhotoUrls && fullSubmission.receiptPhotoUrls.length > 0
            ? fullSubmission.receiptPhotoUrls.join(" ; ")
            : fullSubmission.receiptPhotoUrl;
        const pizzaUrlForSheet =
          fullSubmission.pizzaPhotoUrls && fullSubmission.pizzaPhotoUrls.length > 0
            ? fullSubmission.pizzaPhotoUrls.join(" ; ")
            : fullSubmission.pizzaPhotoUrl;

        const row = [
          submissionId,
          new Date(fullSubmission.createdAt).toISOString(),
          fullSubmission.walletAddress,
          fullSubmission.ensName || "",
          fullSubmission.extractedAmount,
          fullSubmission.currency,
          fullSubmission.finalAmount,
          1, // exchange rate
          receiptUrlForSheet,
          pizzaUrlForSheet,
          updates.status || "PENDING",
          updates.transactionHash || "",
          updates.paidAmount || "",
          updates.paidAt ? new Date(updates.paidAt).toISOString() : "",
          updates.reviewedBy || "",
          updates.rejectionReason || "",
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
        console.log(`Added missing submission ${submissionId} to Google Sheets`);
        return;
      }
      console.warn(`Submission ${submissionId} not found in sheet and no full data provided`);
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

export async function deleteSubmissionFromSheet(submissionId: string) {
  if (!SPREADSHEET_ID) {
    console.warn("GOOGLE_SHEETS_ID not set, skipping sheet deletion");
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

    // Get the sheet ID
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const sheet = spreadsheet.data.sheets?.find(
      (s) => s.properties?.title === SHEET_NAME
    );

    if (!sheet?.properties?.sheetId) {
      console.error("Could not find sheet ID");
      return;
    }

    // Delete the row
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheet.properties.sheetId,
                dimension: "ROWS",
                startIndex: rowIndex,
                endIndex: rowIndex + 1,
              },
            },
          },
        ],
      },
    });

    console.log(`Deleted submission ${submissionId} from Google Sheets`);
  } catch (error) {
    console.error("Failed to delete submission from sheet:", error);
  }
}
