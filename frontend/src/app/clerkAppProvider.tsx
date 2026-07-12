"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useState } from "react";

export function ClerkAppProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const [queryClient] = useState(() => new QueryClient());
  const formButtonPrimary = pathname.startsWith("/sign-in")
    ? "Log In"
    : "Create Account";

  return (
    <ClerkProvider localization={{ formButtonPrimary }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ClerkProvider>
  );
}
