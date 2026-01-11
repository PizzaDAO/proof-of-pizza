import { NextRequest, NextResponse } from "next/server";
import { getOpenAI } from "@/lib/openai";
import { z } from "zod";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2Client, R2_BUCKET_NAME } from "@/lib/r2-client";

const requestSchema = z.object({
  imageUrl: z.string().url(),
});

const responseSchema = z.object({
  amount: z.number(),
  currency: z.string(),
  confidence: z.number().min(0).max(1),
  items: z.array(z.string()).optional(),
});

// Common currency codes and their typical symbols
const CURRENCY_MAP: Record<string, string> = {
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  "¥": "JPY",
  "₦": "NGN",
  "N": "NGN", // Nigerian Naira often shown as N
  "NGN": "NGN",
  "₹": "INR",
  "R$": "BRL",
  "₱": "PHP",
  "฿": "THB",
  "kr": "SEK",
  "zł": "PLN",
  "CHF": "CHF",
  "A$": "AUD",
  "C$": "CAD",
};

// Fallback exchange rates (approximate, updated periodically)
// These are used if live API calls fail
const FALLBACK_RATES_TO_USD: Record<string, number> = {
  NGN: 0.00063,  // Nigerian Naira ~1600 NGN = 1 USD
  EUR: 1.08,     // Euro
  GBP: 1.27,     // British Pound
  JPY: 0.0067,   // Japanese Yen
  INR: 0.012,    // Indian Rupee
  BRL: 0.20,     // Brazilian Real
  PHP: 0.018,    // Philippine Peso
  THB: 0.029,    // Thai Baht
  SEK: 0.096,    // Swedish Krona
  PLN: 0.25,     // Polish Zloty
  CHF: 1.13,     // Swiss Franc
  AUD: 0.66,     // Australian Dollar
  CAD: 0.74,     // Canadian Dollar
  MXN: 0.058,    // Mexican Peso
  KRW: 0.00075,  // South Korean Won
  CNY: 0.14,     // Chinese Yuan
  ZAR: 0.055,    // South African Rand
};

async function convertToUSD(amount: number, fromCurrency: string): Promise<{
  usdAmount: number;
  exchangeRate: number;
  originalAmount: number;
  originalCurrency: string;
}> {
  // Normalize currency code
  const normalizedCurrency = CURRENCY_MAP[fromCurrency] || fromCurrency.toUpperCase();

  if (normalizedCurrency === "USD") {
    return {
      usdAmount: amount,
      exchangeRate: 1,
      originalAmount: amount,
      originalCurrency: "USD",
    };
  }

  try {
    // Try fawazahmed0's free currency API (no key required, supports NGN)
    const response = await fetch(
      `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${normalizedCurrency.toLowerCase()}.json`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (response.ok) {
      const data = await response.json();
      const rate = data[normalizedCurrency.toLowerCase()]?.usd;
      if (rate) {
        const usdAmount = amount * rate;
        console.log(`Currency conversion: ${amount} ${normalizedCurrency} = ${usdAmount.toFixed(2)} USD (rate: ${rate})`);
        return {
          usdAmount: Math.round(usdAmount * 100) / 100,
          exchangeRate: rate,
          originalAmount: amount,
          originalCurrency: normalizedCurrency,
        };
      }
    }
  } catch (error) {
    console.log("Primary API failed, trying fallback:", error);
  }

  try {
    // Fallback: Try frankfurter.app (doesn't support all currencies like NGN)
    const fallbackResponse = await fetch(
      `https://api.frankfurter.app/latest?from=${normalizedCurrency}&to=USD`,
      { signal: AbortSignal.timeout(5000) }
    );

    if (fallbackResponse.ok) {
      const fallbackData = await fallbackResponse.json();
      if (fallbackData.rates?.USD) {
        const usdAmount = amount * fallbackData.rates.USD;
        console.log(`Currency conversion (frankfurter): ${amount} ${normalizedCurrency} = ${usdAmount.toFixed(2)} USD (rate: ${fallbackData.rates.USD})`);
        return {
          usdAmount: Math.round(usdAmount * 100) / 100,
          exchangeRate: fallbackData.rates.USD,
          originalAmount: amount,
          originalCurrency: normalizedCurrency,
        };
      }
    }
  } catch (error) {
    console.log("Frankfurter API failed:", error);
  }

  // Use hardcoded fallback rates
  const fallbackRate = FALLBACK_RATES_TO_USD[normalizedCurrency];
  if (fallbackRate) {
    const usdAmount = amount * fallbackRate;
    console.log(`Currency conversion (fallback rate): ${amount} ${normalizedCurrency} = ${usdAmount.toFixed(2)} USD (rate: ${fallbackRate})`);
    return {
      usdAmount: Math.round(usdAmount * 100) / 100,
      exchangeRate: fallbackRate,
      originalAmount: amount,
      originalCurrency: normalizedCurrency,
    };
  }

  // If all else fails, log warning and return original
  console.warn(`Could not convert ${normalizedCurrency} to USD, no fallback rate available`);
  return {
    usdAmount: amount,
    exchangeRate: 1,
    originalAmount: amount,
    originalCurrency: normalizedCurrency,
  };
}

async function getImageAsBase64(imageUrl: string): Promise<string> {
  // Extract the key from the R2 URL
  const url = new URL(imageUrl);
  const key = url.pathname.slice(1); // Remove leading slash

  try {
    // Fetch directly from R2 using S3 client
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });

    const response = await r2Client.send(command);
    const bodyContents = await response.Body?.transformToByteArray();

    if (!bodyContents) {
      throw new Error("Empty response from R2");
    }

    const base64 = Buffer.from(bodyContents).toString("base64");
    const contentType = response.ContentType || "image/jpeg";
    return `data:${contentType};base64,${base64}`;
  } catch {
    // Fallback: try fetching via HTTP (if public access is enabled)
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const contentType = response.headers.get("content-type") || "image/jpeg";
    return `data:${contentType};base64,${base64}`;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { imageUrl } = requestSchema.parse(body);

    // Convert image to base64
    const base64Image = await getImageAsBase64(imageUrl);

    const response = await getOpenAI().chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `You are a receipt analysis assistant. Extract the total amount from the receipt image.
Return ONLY a JSON object with these fields:
- amount: number (the total amount paid, as a decimal number)
- currency: string (USD, EUR, etc. - default to USD if unclear)
- confidence: number (0-1, your confidence in the extraction)
- items: string[] (optional list of food items if visible)

If you cannot determine the total, estimate from visible items. Always return valid JSON.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the total amount from this receipt.",
            },
            {
              type: "image_url",
              image_url: {
                url: base64Image,
              },
            },
          ],
        },
      ],
      max_tokens: 500,
      response_format: { type: "json_object" },
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from OpenAI");
    }

    const parsed = JSON.parse(content);
    const result = responseSchema.parse(parsed);

    // Convert to USD if needed
    const conversion = await convertToUSD(result.amount, result.currency);

    console.log("Receipt analysis complete:", {
      extractedAmount: result.amount,
      extractedCurrency: result.currency,
      convertedToUSD: conversion.usdAmount,
      exchangeRate: conversion.exchangeRate,
    });

    return NextResponse.json({
      ...result,
      amount: conversion.usdAmount, // Return USD amount as the primary amount
      currency: "USD",
      originalAmount: conversion.originalAmount,
      originalCurrency: conversion.originalCurrency,
      exchangeRate: conversion.exchangeRate,
      conversionNote: conversion.originalCurrency !== "USD"
        ? `Converted from ${conversion.originalAmount.toLocaleString()} ${conversion.originalCurrency} → $${conversion.usdAmount.toFixed(2)} USD (1 ${conversion.originalCurrency} = $${conversion.exchangeRate.toFixed(6)} USD)`
        : undefined,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid request or response", details: error.errors },
        { status: 400 }
      );
    }

    console.error("Receipt analysis error:", error);
    return NextResponse.json(
      { error: "Failed to analyze receipt" },
      { status: 500 }
    );
  }
}
