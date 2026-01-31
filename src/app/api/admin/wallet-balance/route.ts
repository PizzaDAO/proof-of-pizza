import { NextResponse } from "next/server";
import { getWalletBalance, getWalletAddress } from "@/lib/server-wallet";

export async function GET() {
  try {
    const balance = await getWalletBalance();
    const address = getWalletAddress();

    return NextResponse.json({ balance, address });
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    return NextResponse.json(
      { error: "Failed to fetch wallet balance", balance: 0 },
      { status: 500 }
    );
  }
}
