"use client";

import { useAuth, useClerk, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ThemeToggle } from "../themeToggle";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/wardrobe", label: "Wardrobe" },
  { href: "/preferences/colors", label: "Preferences" },
  { href: "/settings", label: "Settings" },
];

const TOP_BAR_CLASS =
  "flex flex-wrap items-center gap-3 border-b border-[var(--color-text-muted)]/15 pb-6";
const PAGE_HEADING_CLASS =
  "font-serif text-5xl font-semibold tracking-normal text-[var(--color-text)] " +
  "sm:text-6xl";
const SETTINGS_PANEL_CLASS =
  "rounded-2xl border border-[var(--color-text-muted)]/15 " +
  "bg-[var(--color-surface)]/45 p-8 " +
  "shadow-[0_24px_70px_rgba(62,46,41,0.10)]";
const SECTION_LABEL_CLASS =
  "font-sans text-sm font-semibold uppercase tracking-[0.18em] " +
  "text-[var(--color-text-muted)]";
const READONLY_VALUE_CLASS =
  "rounded-xl border border-[var(--color-text-muted)]/15 " +
  "bg-[var(--color-bg)]/85 px-4 py-3 font-sans text-sm font-semibold " +
  "text-[var(--color-text)]";
const SECONDARY_BUTTON_CLASS =
  "rounded-xl border border-[var(--color-text-muted)]/20 px-6 py-3 " +
  "font-sans text-sm font-semibold text-[var(--color-text)] transition " +
  "hover:bg-[var(--color-surface)]/60";
const DELETE_BUTTON_CLASS =
  "rounded-md bg-[var(--color-accent)] px-6 py-3 font-sans text-sm " +
  "font-semibold text-[var(--color-on-accent)] transition " +
  "hover:bg-[var(--color-accent)]";
const LOADING_SHELL_CLASS =
  "mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center " +
  "justify-center";

function SettingsTopBar() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <nav className={TOP_BAR_CLASS}>
      <div className="flex w-full items-center justify-between gap-4">
        <Link
          className="font-serif text-4xl font-semibold tracking-normal text-[var(--color-text)]"
          href="/"
        >
          Preeve
        </Link>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === "/settings";

              return (
                <Link
                  className={`rounded-full px-4 py-2 font-sans text-sm font-semibold transition ${
                    isActive
                      ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]"
                      : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]/45"
                  }`}
                  href={item.href}
                  key={item.href}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
          <ThemeToggle />
          <button
            aria-controls="settings-mobile-nav"
            aria-expanded={isMobileNavOpen}
            aria-label="Toggle navigation"
            className={
              "flex h-11 w-11 items-center justify-center rounded-full " +
              "border border-[var(--color-text-muted)]/15 " +
              "text-[var(--color-text)] transition hover:bg-[var(--color-surface)]/45 sm:hidden"
            }
            onClick={() => setIsMobileNavOpen((currentValue) => !currentValue)}
            type="button"
          >
            <svg
              aria-hidden="true"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              viewBox="0 0 24 24"
            >
              {isMobileNavOpen ? (
                <path d="M6 6l12 12M18 6 6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      <div
        className={`w-full flex-col gap-2 border-t border-[var(--color-text-muted)]/10 ` +
          `pt-3 sm:hidden ${isMobileNavOpen ? "flex" : "hidden"}`}
        id="settings-mobile-nav"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/settings";

          return (
            <Link
              className={`rounded-xl px-3 py-3 font-sans text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-[var(--color-accent)] text-[var(--color-on-accent)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]/45"
              }`}
              href={item.href}
              key={item.href}
              onClick={() => setIsMobileNavOpen(false)}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function formatMemberSince(createdAt: Date | null | undefined) {
  if (!createdAt) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "long",
  }).format(createdAt);
}

export default function SettingsPage() {
  const router = useRouter();
  const { openUserProfile, signOut } = useClerk();
  const { isLoaded, isSignedIn } = useAuth();
  const { user } = useUser();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const email = user?.primaryEmailAddress?.emailAddress ?? "No email found";
  const memberSince = formatMemberSince(user?.createdAt);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.replace("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  async function logOut() {
    setErrorMessage(null);

    try {
      await signOut();
      router.push("/");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to log out.";
      setErrorMessage(message);
    }
  }

  async function deleteAccount() {
    if (!user || isDeleting) {
      return;
    }

    setErrorMessage(null);
    setIsDeleting(true);

    try {
      await user.delete();
      router.push("/");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to delete this account.";
      setErrorMessage(message);
      setIsDeleting(false);
    }
  }

  if (!isLoaded || !isSignedIn) {
    return (
      <main className="relative min-h-screen bg-background px-6 py-8 text-foreground">
        <div aria-hidden="true" className="grain-overlay" />
        <div className={LOADING_SHELL_CLASS}>
          <p className="font-sans text-sm font-medium text-[var(--color-text-muted)]">
            Loading settings...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen bg-background px-6 py-8 text-foreground">
      <div aria-hidden="true" className="grain-overlay" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col gap-10">
        <SettingsTopBar />

        <section className="flex flex-1 flex-col gap-8 py-8">
          <div className="space-y-3">
            <h1 className={PAGE_HEADING_CLASS}>Settings</h1>
          </div>

          {errorMessage ? (
            <p className="font-sans text-sm text-[var(--color-accent)]">
              {errorMessage}
            </p>
          ) : null}

          <div className="grid gap-6">
            <section className={SETTINGS_PANEL_CLASS}>
              <div className="space-y-4">
                <p className={SECTION_LABEL_CLASS}>Account</p>
                <div className="space-y-2">
                  <p className="font-sans text-sm font-semibold text-[var(--color-text-muted)]">
                    Email
                  </p>
                  <p className={READONLY_VALUE_CLASS}>{email}</p>
                </div>
                {memberSince ? (
                  <div className="space-y-2">
                    <p className="font-sans text-sm font-semibold text-[var(--color-text-muted)]">
                      Member since
                    </p>
                    <p className={READONLY_VALUE_CLASS}>{memberSince}</p>
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-3">
                  <button
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => openUserProfile()}
                    type="button"
                  >
                    Manage account
                  </button>
                  <button
                    className={SECONDARY_BUTTON_CLASS}
                    onClick={() => void logOut()}
                    type="button"
                  >
                    Log out
                  </button>
                </div>
              </div>
            </section>
          </div>

          <div className="mt-auto flex flex-col items-start gap-3 pt-10">
            <button
              className={DELETE_BUTTON_CLASS}
              disabled={isDeleting}
              onClick={() => {
                if (confirmingDelete) {
                  void deleteAccount();
                } else {
                  setConfirmingDelete(true);
                }
              }}
              type="button"
            >
              {isDeleting
                ? "Deleting..."
                : confirmingDelete
                  ? "Confirm delete"
                  : "Delete Account"}
            </button>
            {confirmingDelete ? (
              <p className="font-sans text-sm text-[var(--color-text-muted)]">
                Delete this account? This cannot be undone.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
