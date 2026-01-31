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
- `PAYMENT_WALLET_PRIVATE_KEY` - Server wallet private key
- `BASE_RPC_URL` - Optional custom RPC for Base chain
