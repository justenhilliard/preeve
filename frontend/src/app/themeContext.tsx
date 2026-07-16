"use client";

import { createContext, useCallback, useContext, useSyncExternalStore } from "react";

type Theme = "light" | "dark";

type ThemeContextValue = Readonly<{
  theme: Theme;
  toggleTheme: () => void;
}>;

export const THEME_STORAGE_KEY = "preeve-theme";

// useSyncExternalStore (rather than useState+useEffect) is the React-
// recommended way to read a value that can differ between the server
// render and the client - the .dark class is set by an inline script in
// layout.tsx before hydration, so the client's real value is often not
// "light" the way a server-only render would assume. This hook reconciles
// that safely without a manual "mounted" flag.
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function getServerSnapshot(): Theme {
  return "light";
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleTheme = useCallback(() => {
    const next: Theme = getSnapshot() === "dark" ? "light" : "dark";

    document.documentElement.classList.toggle("dark", next === "dark");
    window.localStorage.setItem(THEME_STORAGE_KEY, next);
    notifyListeners();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);

  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }

  return context;
}
