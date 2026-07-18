"use client";

import Link from "next/link";
import { InlineError } from "../inlineError";
import { ThemeToggle } from "../themeToggle";

type StepShellProps = Readonly<{
  backHref: string;
  children: React.ReactNode;
  errorMessage: string | null;
  isLoading: boolean;
  step: number;
  subtitle: string;
  title: string;
}>;

type OptionButtonProps = Readonly<{
  children: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
}>;

type PrimaryActionProps = Readonly<{
  children: React.ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
}>;

type PrimaryLinkProps = Readonly<{
  children: React.ReactNode;
  href: string;
}>;

const PRIMARY_ACTION_CLASS =
  "rounded-md bg-[var(--color-accent-button)] px-6 py-3 font-sans text-sm font-semibold " +
  "text-[var(--color-on-dark)] transition-[background-color,transform] duration-[160ms] " +
  "ease-[var(--ease-out)] hover:bg-[var(--color-accent-button-hover)] active:scale-[0.97]";
const DISABLED_PRIMARY_ACTION_CLASS =
  "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100";
const OPTION_BUTTON_BASE_CLASS =
  "flex min-h-11 items-center justify-between gap-3 rounded-xl border-2 " +
  "border-[var(--color-text-muted)]/15 bg-[var(--color-bg)] px-4 py-3 font-sans text-sm " +
  "font-medium text-[var(--color-text)] shadow-[0_3px_8px_rgba(62,46,41,0.22)] " +
  "outline outline-[3px] outline-offset-[3px] transition focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-accent-dark)] focus-visible:ring-offset-4 " +
  "focus-visible:ring-offset-[var(--color-bg)]";
const COLOR_SWATCH_BASE_CLASS =
  "relative flex h-16 w-16 items-center justify-center rounded-full border " +
  "border-[var(--color-text-muted)]/20 shadow-[0_3px_8px_rgba(62,46,41,0.22)] " +
  "outline outline-[3px] outline-offset-[3px] transition";
const LOADING_SPINNER_CLASS =
  "h-9 w-9 animate-spin rounded-full border-[3px] border-[var(--color-text-muted)]/15 " +
  "border-t-[var(--color-accent)]";

export function StepShell({
  backHref,
  children,
  errorMessage,
  isLoading,
  step,
  subtitle,
  title,
}: StepShellProps) {
  return (
    <main className="relative min-h-screen bg-background px-6 py-8 text-foreground">
      <div aria-hidden="true" className="grain-overlay" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col">
        <nav className="flex items-start justify-between gap-4">
          <Link href={backHref} className="auth-back-link">
            Back
          </Link>

          <div className="flex items-center gap-4">
            {isLoading ? null : (
              <div className="w-36 pt-2">
                <ProgressBar step={step} />
                <p
                  className={
                    "mt-2 text-right font-sans text-xs font-medium " +
                    "text-[var(--color-text-muted)]"
                  }
                >
                  Step {step} of 3
                </p>
              </div>
            )}
            <ThemeToggle />
          </div>
        </nav>

        <section className="flex flex-1 flex-col justify-center gap-10 py-10">
          {isLoading ? (
            <LoadingSpinner />
          ) : (
            <>
              <div className="space-y-4">
                <header className="space-y-4 text-center">
                  <h1
                    className={
                      "font-serif text-5xl font-semibold tracking-normal " +
                      "text-[var(--color-text)]"
                    }
                  >
                    {title}
                  </h1>
                  <p
                    className={
                      "mx-auto max-w-sm font-sans text-sm font-medium " +
                      "text-[var(--color-text-muted)]"
                    }
                  >
                    {subtitle}
                  </p>
                </header>
              </div>

              {children}

              {errorMessage ? (
                <InlineError message={errorMessage} />
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex flex-col items-center gap-3 py-10" role="status">
      <span className={LOADING_SPINNER_CLASS} />
      <span className="sr-only">Loading your preferences...</span>
    </div>
  );
}

export function ProgressBar({ step }: Readonly<{ step: number }>) {
  return (
    <div
      aria-label={`Step ${step} of 3`}
      className="grid grid-cols-3 gap-2"
      role="progressbar"
    >
      {[1, 2, 3].map((currentStep) => (
        <div
          className={`h-2 rounded-full ${
            currentStep <= step ? "bg-[var(--color-accent)]" : "bg-[var(--color-surface)]"
          }`}
          key={currentStep}
        />
      ))}
    </div>
  );
}

export function OptionButton({
  children,
  isSelected,
  onClick,
}: OptionButtonProps) {
  return (
    <button
      aria-pressed={isSelected}
      className={`${OPTION_BUTTON_BASE_CLASS} ${
        isSelected
          ? "outline-[var(--color-accent)] shadow-[0_5px_14px_rgba(184,103,74,0.35)]"
          : "outline-transparent"
      }`}
      onClick={onClick}
      type="button"
    >
      <span>{children}</span>
      {isSelected ? (
        <svg
          aria-hidden="true"
          className="h-5 w-5 flex-shrink-0"
          fill="none"
          stroke="var(--color-accent)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
          viewBox="0 0 24 24"
        >
          <path d="M4 12.5l5 5L20 7" />
        </svg>
      ) : null}
    </button>
  );
}

type ColorSwatchButtonProps = Readonly<{
  colorName: string;
  hex: string;
  isSelected: boolean;
  onClick: () => void;
}>;

/**
 * Picks readable label text for a swatch fill using perceived luminance —
 * light text on dark colors, dark text on light ones. Gradient fills
 * (multicolor) fall back to light text since the gradient leans dark overall.
 */
function getContrastTextColor(hex: string): string {
  if (!hex.startsWith("#")) {
    return "#FAF9F8";
  }

  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  const perceivedLuminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;

  return perceivedLuminance > 0.6 ? "#3E2E29" : "#FAF9F8";
}

export function ColorSwatchButton({
  colorName,
  hex,
  isSelected,
  onClick,
}: ColorSwatchButtonProps) {
  const contrastColor = getContrastTextColor(hex);

  return (
    <button
      aria-pressed={isSelected}
      className={
        "flex flex-col items-center gap-2 rounded-xl focus-visible:outline-none " +
        "focus-visible:ring-2 focus-visible:ring-[var(--color-accent-dark)] " +
        "focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--color-bg)]"
      }
      onClick={onClick}
      type="button"
    >
      <span
        className={`${COLOR_SWATCH_BASE_CLASS} ${
          isSelected
            ? "outline-[var(--color-accent)] shadow-[0_5px_14px_rgba(184,103,74,0.35)]"
            : "outline-transparent"
        }`}
        style={{ background: hex }}
      >
        {isSelected ? (
          <svg
            aria-hidden="true"
            className="h-6 w-6"
            fill="none"
            stroke={contrastColor}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            viewBox="0 0 24 24"
          >
            <path d="M4 12.5l5 5L20 7" />
          </svg>
        ) : null}
      </span>

      {/* Label lives on the fixed cream background, not the color fill —
          guarantees consistent, WCAG-passing contrast regardless of which
          color is shown, unlike text overlaid directly on the swatch. */}
      <span className="font-sans text-xs font-semibold capitalize text-[var(--color-text)]">
        {colorName}
      </span>
    </button>
  );
}

export function PrimaryAction({
  children,
  disabled = false,
  onClick,
  type = "button",
}: PrimaryActionProps) {
  return (
    <button
      className={`${PRIMARY_ACTION_CLASS} ${DISABLED_PRIMARY_ACTION_CLASS}`}
      disabled={disabled}
      onClick={onClick}
      type={type}
    >
      {children}
    </button>
  );
}

export function PrimaryLink({ children, href }: PrimaryLinkProps) {
  return (
    <Link
      className={PRIMARY_ACTION_CLASS}
      href={href}
    >
      {children}
    </Link>
  );
}

export function formatOptionLabel(value: string) {
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
