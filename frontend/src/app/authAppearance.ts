// Clerk generates its own internal color scales (hover/active states, and
// any element we don't explicitly override below) from the `variables`
// block using its own JS color logic - it can't resolve CSS custom
// properties there, only real color values. So unlike the rest of the app,
// this file can't just point at var(--color-*) tokens; it needs the actual
// hex per theme. getAuthAppearance(theme) is called with the live theme
// from useTheme() in the sign-in/sign-up pages so it updates when toggled.
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
    onAccent: "#F3ECE6",
    text: "#F3ECE6",
    textMuted: "#C9BFB6",
  },
};

const FONT_SANS = "var(--font-inter), ui-sans-serif, system-ui, sans-serif";
const FONT_BODY = "var(--font-lato), ui-sans-serif, system-ui, sans-serif";

export function getAuthAppearance(theme: Theme) {
  const c = PALETTE[theme];

  return {
    variables: {
      borderRadius: "12px",
      colorBackground: c.bg,
      // colorNeutral drives most of Clerk's un-overridden neutral chrome
      // (dividers, hint text, OTP boxes, secondary icons) - leaving this
      // unset was the main cause of low-contrast text in dark mode, since
      // Clerk then falls back to a gray tuned for a light background.
      colorDanger: "#C4634F",
      colorInputBackground: c.bg,
      colorInputText: c.text,
      colorNeutral: c.textMuted,
      colorPrimary: c.accent,
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
      header: {
        display: "none",
      },
      headerSubtitle: {
        color: c.textMuted,
        fontFamily: FONT_BODY,
      },
      headerTitle: {
        color: c.text,
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
