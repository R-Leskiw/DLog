import type { Metadata } from "next";
import { Inter, Young_Serif } from "next/font/google";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const youngSerif = Young_Serif({
  subsets: ["latin"],
  variable: "--font-young-serif",
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BuildTrack",
  description: "Construction daily logs and team messaging",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`theme ${inter.variable} ${youngSerif.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
