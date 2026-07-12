import { PreferencesProvider } from "./preferencesContext";

export default function PreferencesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <PreferencesProvider>{children}</PreferencesProvider>;
}
