"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getAuthAppearance } from "./authAppearance";
import { ThemeProvider, useTheme } from "./themeContext";

// Split out so useTheme() can be called from a component that's actually a
// descendant of ThemeProvider - ClerkAppProvider itself renders
// ThemeProvider, so it can't read from that context in its own body.
function ThemedClerkProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const { theme } = useTheme();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // One retry smooths over brief network blips without hiding a real outage
            // behind several silent exponential-backoff attempts.
            retry: 1,
            staleTime: 30_000,
          },
        },
      }),
  );
  const formButtonPrimary = pathname.startsWith("/sign-in")
    ? "Log In"
    : "Create Account";

  return (
    <ClerkProvider
      appearance={getAuthAppearance(theme)}
      localization={{ formButtonPrimary }}
    >
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </ClerkProvider>
  );
}

export function ClerkAppProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ThemeProvider>
      <ThemedClerkProvider>{children}</ThemedClerkProvider>
    </ThemeProvider>
  );
}
