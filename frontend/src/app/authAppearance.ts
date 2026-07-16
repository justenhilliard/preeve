// Colors here reference the same CSS custom properties defined in
// globals.css (light default + .dark override), so Clerk's embedded
// sign-in/sign-up UI follows the site's theme toggle automatically -
// Clerk's `elements` styles accept any valid CSS value, including var().
export const authAppearance = {
  variables: {
    borderRadius: "12px",
    colorBackground: "var(--color-bg)",
    colorInputBackground: "var(--color-bg)",
    colorInputText: "var(--color-text)",
    colorPrimary: "var(--color-accent)",
    colorText: "var(--color-text)",
    colorTextSecondary: "var(--color-text-muted)",
    fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
    fontFamilyButtons: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  },
  elements: {
    card: {
      backgroundColor: "var(--color-bg)",
      border: "1px solid color-mix(in srgb, var(--color-text-muted) 18%, transparent)",
      borderRadius: "16px",
      boxShadow: "0 24px 70px rgb(62 46 41 / 0.10)",
      color: "var(--color-text)",
      width: "100%",
    },
    formButtonPrimary: {
      backgroundColor: "var(--color-accent)",
      borderRadius: "6px",
      color: "var(--color-on-dark)",
      fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      fontWeight: "600",
      textTransform: "none",
    },
    formFieldInput: {
      backgroundColor: "var(--color-bg)",
      borderColor: "color-mix(in srgb, var(--color-text-muted) 32%, transparent)",
      borderRadius: "12px",
      color: "var(--color-text)",
      fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
    },
    formFieldLabel: {
      color: "var(--color-text)",
      fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      fontWeight: "600",
    },
    footer: {
      backgroundColor: "var(--color-bg)",
      borderRadius: "0 0 16px 16px",
      color: "var(--color-text-muted)",
      fontFamily: "var(--font-lato), ui-sans-serif, system-ui, sans-serif",
    },
    footerActionLink: {
      color: "var(--color-accent)",
      fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      fontWeight: "600",
    },
    header: {
      display: "none",
    },
    headerSubtitle: {
      color: "var(--color-text-muted)",
      fontFamily: "var(--font-lato), ui-sans-serif, system-ui, sans-serif",
    },
    headerTitle: {
      color: "var(--color-text)",
    },
    socialButtonsBlockButton: {
      backgroundColor: "var(--color-bg)",
      borderColor: "color-mix(in srgb, var(--color-text-muted) 24%, transparent)",
      borderRadius: "6px",
      color: "var(--color-text)",
      fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
      fontWeight: "600",
    },
  },
};
