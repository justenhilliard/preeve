import { dark } from "@clerk/themes";

// Clerk generates its own internal color scales from real color values in
// `variables`; it can't resolve CSS custom properties there. The official
// dark base theme handles Clerk's internal surfaces, while these hex values
// keep Preeve's brand palette layered on top.
type Theme = "light" | "dark";

const PALETTE: Record<
  Theme,
  Readonly<{
    accent: string;
    bg: string;
    onAccent: string;
    text: string;
    textMuted: string;
  }>
> = {
  light: {
    accent: "#B8674A",
    bg: "#FAF9F8",
    onAccent: "#FAF9F8",
    text: "#3E2E29",
    textMuted: "#4A413C",
  },
  dark: {
    accent: "#D9835F",
    bg: "#17120F",
    onAccent: "#FFFFFF",
    text: "#FFFFFF",
    textMuted: "#D9D2CB",
  },
};

const FONT_SANS = "var(--font-inter), ui-sans-serif, system-ui, sans-serif";
const FONT_BODY = "var(--font-lato), ui-sans-serif, system-ui, sans-serif";

// Only the sign-in/sign-up pages have their own custom "Preeve" / "Log in
// to your account" header above the embedded Clerk form, so only those
// pages should hide Clerk's own header - merge this into their appearance
// prop on top of the global one from ClerkProvider (which must NOT hide
// headers everywhere, since that risked taking other page titles, like
// UserProfile's "Account" heading, down with it).
export const HIDE_CLERK_HEADER = {
  elements: {
    header: {
      display: "none",
    },
  },
};

export function getAuthAppearance(theme: Theme) {
  const c = PALETTE[theme];

  return {
    ...(theme === "dark" ? { baseTheme: dark } : {}),
    variables: {
      borderRadius: "12px",
      colorBackground: c.bg,
      colorDanger: "#C4634F",
      colorForeground: c.text,
      colorInput: c.bg,
      colorInputBackground: c.bg,
      colorInputForeground: c.text,
      colorInputText: c.text,
      colorNeutral: c.textMuted,
      colorPrimary: c.accent,
      colorPrimaryForeground: c.onAccent,
      colorSuccess: "#8A9A7B",
      colorText: c.text,
      colorTextOnPrimaryBackground: c.onAccent,
      colorTextSecondary: c.textMuted,
      colorWarning: "#C9A66B",
      fontFamily: FONT_SANS,
      fontFamilyButtons: FONT_SANS,
    },
    elements: {
      card: {
        backgroundColor: c.bg,
        border: `1px solid ${c.textMuted}30`,
        borderRadius: "16px",
        boxShadow: "0 24px 70px rgb(62 46 41 / 0.10)",
        color: c.text,
        width: "100%",
      },
      dividerLine: {
        backgroundColor: `${c.textMuted}30`,
      },
      dividerText: {
        color: c.textMuted,
        fontFamily: FONT_BODY,
      },
      footer: {
        backgroundColor: c.bg,
        borderRadius: "0 0 16px 16px",
        color: c.textMuted,
        fontFamily: FONT_BODY,
      },
      footerActionLink: {
        color: c.accent,
        fontFamily: FONT_SANS,
        fontWeight: "600",
      },
      footerActionText: {
        color: c.textMuted,
        fontFamily: FONT_BODY,
      },
      formButtonPrimary: {
        backgroundColor: c.accent,
        borderRadius: "6px",
        color: c.onAccent,
        fontFamily: FONT_SANS,
        fontWeight: "600",
        textTransform: "none",
      },
      formFieldAction: {
        color: c.accent,
        fontFamily: FONT_SANS,
      },
      formFieldErrorText: {
        color: "#C4634F",
        fontFamily: FONT_BODY,
      },
      formFieldHintText: {
        color: c.textMuted,
        fontFamily: FONT_BODY,
      },
      formFieldInput: {
        "&::placeholder": {
          color: c.textMuted,
        },
        backgroundColor: c.bg,
        borderColor: `${c.textMuted}50`,
        borderRadius: "12px",
        color: c.text,
        fontFamily: FONT_SANS,
      },
      formFieldLabel: {
        color: c.text,
        fontFamily: FONT_SANS,
        fontWeight: "600",
      },
      formFieldSuccessText: {
        color: "#8A9A7B",
        fontFamily: FONT_BODY,
      },
      formResendCodeLink: {
        color: c.accent,
        fontFamily: FONT_SANS,
      },
      identityPreviewEditButton: {
        color: c.accent,
      },
      identityPreviewText: {
        color: c.text,
        fontFamily: FONT_BODY,
      },
      otpCodeFieldInput: {
        backgroundColor: c.bg,
        borderColor: `${c.textMuted}50`,
        color: c.text,
      },
      socialButtonsBlockButton: {
        backgroundColor: c.bg,
        borderColor: `${c.textMuted}3D`,
        borderRadius: "6px",
        color: c.text,
        fontFamily: FONT_SANS,
        fontWeight: "600",
      },
    },
  };
}
