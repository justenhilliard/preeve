import type { Metadata, Viewport } from "next";
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

export const viewport: Viewport = {
  initialScale: 1,
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={ROOT_HTML_CLASS}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ClerkAppProvider>{children}</ClerkAppProvider>
      </body>
    </html>
  );
}
