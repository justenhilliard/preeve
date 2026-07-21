import type { Metadata, Viewport } from "next";
import { SerwistProvider } from "@serwist/turbopack/react";
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
  appleWebApp: {
    capable: true,
    title: "Preeve",
  },
};

export const viewport: Viewport = {
  initialScale: 1,
  themeColor: "#9d583f",
  viewportFit: "cover",
  width: "device-width",
};

// Runs before React hydrates so the .dark class (and therefore every CSS
// custom property in globals.css) is correct on first paint - without this,
// a returning dark-mode visitor would see a flash of the light theme.
const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = window.localStorage.getItem("preeve-theme");
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    var isDark = stored ? stored === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", isDark);
  } catch (error) {
    // localStorage/matchMedia can throw in locked-down environments -
    // falling back to the light theme default is fine.
  }
})();
`;

const ROOT_HTML_CLASS =
  `h-full antialiased ${cormorantGaramond.variable} ` +
  `${inter.variable} ${lato.variable}`;

// The service worker caches static assets with a CacheFirst strategy. In
// development Next.js serves CSS and JS at stable URLs whose contents change
// on every rebuild, so the worker keeps serving the previous build's assets
// until a hard refresh. Registering it only in production avoids that while
// leaving real PWA behavior intact (test it against `npm run build`).
const isProduction = process.env.NODE_ENV === "production";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const appTree = <ClerkAppProvider>{children}</ClerkAppProvider>;

  return (
    <html
      lang="en"
      className={ROOT_HTML_CLASS}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        {isProduction ? (
          <SerwistProvider swUrl="/serwist/sw.js">{appTree}</SerwistProvider>
        ) : (
          appTree
        )}
      </body>
    </html>
  );
}
