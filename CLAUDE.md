# Project: Proof of Pizza

## User
- Refer to the user as **Snax**

## Project Overview
Pizza reimbursement submission and admin approval system for PizzaDAO.

## Tech Stack
- Next.js 16 (App Router)
- Prisma with PostgreSQL (Neon)
- Viem for blockchain transactions
- Base chain for USDC payments
- Google Sheets integration for logging

## Key Files
- `src/lib/server-wallet.ts` - Server-side wallet for automated USDC payments
- `src/app/api/admin/pay/route.ts` - Payment endpoint
- `src/components/SubmissionQueue.tsx` - Admin queue interface

## Environment Variables
- `ADMIN_CREDENTIALS` - JSON mapping admin names to passwords
- `ADMIN_SESSION_SECRET` - HMAC key (32+ chars) for the admin session cookie; admin login fails closed without it
- `PAYMENT_WALLET_PRIVATE_KEY` - Server wallet private key
- `BASE_RPC_URL` - Optional custom RPC for Base chain

## Security notes
- Admin auth is an httpOnly signed session cookie (`src/lib/admin-auth.ts`); admin routes call `requireAdmin` / `requireSuperAdmin`. Never store the admin password client-side.
- Per-IP rate limits live in the Postgres `RateLimit` table (`src/lib/rate-limit.ts`), since serverless instances don't share memory.
- Upload keys are server-generated (`src/lib/upload-keys.ts`); presigned PUTs sign Content-Type and Content-Length.
