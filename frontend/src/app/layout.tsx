import type { Metadata } from "next";
import { Cormorant_Garamond, Inter, Lato } from "next/font/google";
import { ClerkAppProvider } from "./clerkAppProvider";
import "./globals.css";

// Self-hosted via next/font — downloaded and served locally at build time,
// no runtime request to Google's CDN. Matches docs/DESIGN_SYSTEM.md's three
// typography roles exactly: Cormorant Garamond (logo/headlines), Inter (UI
// chrome), Lato (body copy).
const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-cormorant-garamond",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const lato = Lato({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-lato",
});

export const metadata: Metadata = {
  title: "Preeve",
  description:
    "Snap a photo of anything you're about to buy and get an instant " +
    "Buy, Maybe, or Skip verdict based on your wardrobe and style.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${cormorantGaramond.variable} ${inter.variable} ${lato.variable}`}
    >
      <body className="min-h-full flex flex-col">
        <ClerkAppProvider>{children}</ClerkAppProvider>
      </body>
    </html>
  );
}
