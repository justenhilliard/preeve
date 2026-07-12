"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { usePathname } from "next/navigation";

export function ClerkAppProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const formButtonPrimary = pathname.startsWith("/sign-in")
    ? "Log In"
    : "Create Account";

  return (
    <ClerkProvider localization={{ formButtonPrimary }}>
      {children}
    </ClerkProvider>
  );
}
