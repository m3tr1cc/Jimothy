import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(`https://${process.env.VERCEL_PROJECT_PRODUCTION_URL ?? "jimothy.vercel.app"}`),
  title: "Jimothy — Alley Run",
  description: "Jump trash cans, clear dumpsters, duck pigeons, and chase the Codefair global high score.",
  applicationName: "Jimothy",
  icons: {
    icon: "/jimothy-sprites.jpg",
    shortcut: "/jimothy-sprites.jpg",
  },
  openGraph: {
    title: "Jimothy — Alley Run",
    description: "A tiny monochrome alley runner built for Codefair.",
    type: "website",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Jimothy — Alley Run",
    description: "A tiny monochrome alley runner built for Codefair.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#f7f7f3",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
