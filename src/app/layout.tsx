import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/providers/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Proof of Pizza | PizzaDAO",
  description: "Submit proof of pizza and get reimbursed in USDC",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>💸</text></svg>",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>{children}</Providers>
        <div className="corner-links" aria-label="Project links">
          <a
            href="https://docs.google.com/spreadsheets/d/1u-ejZIVFzqQ0rNCLEOP4VZuMGqFn-kguML8CtXw5vLQ/edit?gid=0#gid=0"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open Google Sheets"
          >
            <img src="https://cdn.simpleicons.org/googlesheets/000000" alt="Google Sheets" />
          </a>
          <a
            href="https://github.com/PizzaDAO/pizza-faucet-v2"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open GitHub"
          >
            <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/github/github-original.svg" alt="GitHub" />
          </a>
        </div>
      </body>
    </html>
  );
}
