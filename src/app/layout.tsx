import type { Metadata, Viewport } from "next";
import { Anuphan, Prompt } from "next/font/google";
import type { ReactNode } from "react";

import NavigationPending from "@/components/hr/navigation-pending";

import "./globals.css";

const anuphan = Anuphan({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-anuphan",
  display: "swap",
});

const prompt = Prompt({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-prompt",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GoldenSoft HR",
  description: "ระบบทรัพยากรบุคคล GoldenSoft",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className={`${anuphan.variable} ${prompt.variable}`}>
        <NavigationPending />
        {children}
      </body>
    </html>
  );
}
