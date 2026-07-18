"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import {
  formatItemDisplayLabel,
  type VisualAttributes,
} from "../lib/itemLabel";
import {
  COLOR_SWATCHES,
  type ColorOption,
} from "./preferences/preferencesContext";
import { useAuthenticatedApi } from "./apiClient";
import { InlineError } from "./inlineError";
import { ThemeToggle } from "./themeToggle";

type Verdict = "buy" | "maybe" | "skip";

type WardrobeItem = {
  createdAt: string;
  detectedCategory: string | null;
  detectedColor: string | null;
  id: string;
  isFavorited: boolean;
  photoUrl: string;
  rationale: string | null;
  verdict: Verdict | null;
  visualAttributes: VisualAttributes | null;
};

type WardrobeItemsResponse = {
  items: WardrobeItem[];
};

type MeResponse = {
  hasCompletedPreferences: boolean;
};

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/wardrobe", label: "Wardrobe" },
  { href: "/preferences/colors", label: "Preferences" },
  { href: "/settings", label: "Settings" },
];

const LANDING_NAV_LINKS = [
  { href: "#why-preeve", label: "Why Preeve" },
  { href: "#how-it-works", label: "How Preeve works" },
  { href: "#privacy", label: "Privacy" },
  { href: "#faq", label: "FAQ" },
];

const HOW_IT_WORKS_STEPS = [
  {
    title: "Scan",
    copy:
      "Snap a photo of the piece while you're still deciding, right in the " +
      "store or from a listing you're considering. Preeve reads the image " +
      "and identifies the category and color for you.",
  },
  {
    title: "Verdict",
    copy:
      "Preeve compares the item against the wardrobe and style preferences " +
      "you saved, then returns a clear Buy, Maybe, or Skip with the " +
      "reasoning behind it. If something looks off, you can correct the " +
      "details and get an updated verdict.",
  },
  {
    title: "Pairing",
    copy:
      "When there's a good match already in your wardrobe log, Preeve " +
      "suggests how to pair the new piece with something you already own, " +
      "so you can picture the outfit before you commit to buying.",
  },
];

const FAQ_ITEMS = [
  {
    question: "What is Preeve?",
    answer:
      "Preeve is a quick style check for anything you're about to buy. Snap a " +
      "photo of a clothing item and get an instant Buy, Maybe, or Skip verdict " +
      "based on the wardrobe and style preferences you set up.",
  },
  {
    question: "Is my photo data private?",
    answer:
      "Yes. Photos are stored privately and used only to generate your verdict " +
      "- they're never shared publicly or with other users.",
  },
  {
    question: "What if the verdict seems wrong?",
    answer:
      "You can manually correct the detected category or color any time the " +
      "automatic scan gets it wrong, and Preeve will recompute the verdict " +
      "from your correction.",
  },
  {
    question: "Does Preeve work with any clothing item?",
    answer:
      "Preeve currently recognizes six categories - tops, bottoms, dresses, " +
      "outerwear, shoes, and accessories - across a range of colors. Coverage " +
      "will keep expanding.",
  },
  {
    question: "Is Preeve free?",
    answer:
      "Yes, Preeve is a free personal project - no account tiers, no paywalls.",
  },
  {
    question: "What do I need to use it?",
    answer:
      "Just a phone or computer with a camera, and a few seconds to answer " +
      "some style preference questions when you first sign up.",
  },
];

const TOP_BAR_CLASS =
  "flex flex-wrap items-center gap-3 border-b border-[var(--color-text-muted)]/15 pb-6";
const EMPTY_STATE_CARD_CLASS =
  "rounded-2xl border border-[var(--color-text-muted)]/15 bg-[var(--color-surface)] p-8 " +
  "shadow-[0_24px_70px_rgba(62,46,41,0.10)]";
const LANDING_SECTION_CLASS =
  "mx-auto w-full max-w-5xl px-6";
const LANDING_BAND_CLASS =
  "scroll-mt-28 border-y border-[var(--color-text-muted)]/10 bg-[var(--color-surface)]/30 py-24";
const LANDING_NAV_CLASS =
  "mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-6";
const LANDING_CTA_BUTTON_CLASS =
  "rounded-md bg-[var(--color-accent-button)] px-6 py-3 font-sans text-sm font-semibold " +
  "text-[var(--color-on-dark)] transition-[background-color,transform] duration-[160ms] " +
  "ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[var(--color-accent-button-hover)] " +
  "active:scale-[0.97]";
const SIGN_IN_BUTTON_CLASS =
  "rounded-md bg-[var(--color-accent-dark)] px-5 py-2.5 font-sans text-sm " +
  "font-semibold text-[var(--color-on-dark)] " +
  "transition-[background-color,transform] duration-[160ms] " +
  "ease-[cubic-bezier(0.23,1,0.32,1)] " +
  "hover:bg-[var(--color-accent-dark-hover)] active:scale-[0.97]";
const EMAIL_INPUT_CLASS =
  "min-h-12 flex-1 rounded-xl border border-[var(--color-text-muted)]/20 " +
  "bg-[var(--color-bg)] px-4 font-sans text-sm text-[var(--color-text)] " +
  "outline-none transition placeholder:text-[var(--color-text-muted)] " +
  "focus-visible:border-[var(--color-accent)] focus-visible:ring-2 " +
  "focus-visible:ring-[var(--color-accent-dark)] focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[var(--color-bg)]";
const HERO_HEADLINE_CLASS =
  "font-serif text-4xl font-semibold leading-[1.05] tracking-normal " +
  "text-[var(--color-on-dark)] sm:text-6xl lg:text-8xl";
const CTA_BANNER_CLASS =
  "rounded-2xl border border-[var(--color-text-muted)]/15 bg-[var(--color-surface)]/45 p-8 " +
  "shadow-[0_24px_70px_rgba(62,46,41,0.10)]";
const FOOTER_LAYOUT_CLASS =
  "flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between";
const LOADING_HOME_CLASS =
  "mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center " +
  "justify-center";
const BADGE_CLASS =
  "rounded-md px-4 py-2 font-sans text-sm font-semibold";
const VERDICT_BADGE_CLASS =
  "inline-flex rounded-md px-3 py-1 font-sans text-xs font-semibold";
const VERDICT_STYLES: Record<Verdict, string> = {
  buy: "bg-[var(--color-sage-badge)] text-[var(--color-on-dark)]",
  maybe: "bg-[var(--color-ochre-badge)] text-[var(--color-on-dark)]",
  skip: "bg-[var(--color-accent-dark)] text-[var(--color-on-dark)]",
};
const VERDICT_BORDER_STYLES: Record<Verdict, string> = {
  buy: "border-[var(--color-sage)]",
  maybe: "border-[var(--color-ochre)]",
  skip: "border-[var(--color-accent-dark)]",
};
const SCAN_CTA_CLASS =
  "flex items-center gap-4 rounded-md bg-[var(--color-accent-button)] px-6 py-4 text-left " +
  "text-[var(--color-on-dark)] transition-[background-color,transform] duration-[160ms] " +
  "ease-[var(--ease-out)] hover:bg-[var(--color-accent-button-hover)] active:scale-[0.97]";
const DASHBOARD_SPINNER_CLASS =
  "h-9 w-9 animate-spin rounded-full border-[3px] border-[var(--color-text-muted)]/15 " +
  "border-t-[var(--color-accent)]";

function HomeTopBar() {
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <nav className={TOP_BAR_CLASS}>
      <div className="flex w-full items-center justify-between gap-4">
        <Link
          className={
            "font-serif text-4xl font-semibold tracking-normal " +
            "text-[var(--color-text)] sm:text-5xl"
          }
          href="/"
        >
          Preeve
        </Link>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">
            {NAV_ITEMS.map((item) => {
              const isActive = item.href === "/";

              return (
                <Link
                  className={`rounded-md px-4 py-2 font-sans text-sm font-semibold transition ${
                    isActive
                      ? "bg-[var(--color-accent-button)] text-[var(--color-on-dark)] " +
                        "hover:bg-[var(--color-accent-button-hover)]"
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
            aria-controls="home-mobile-nav"
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
        id="home-mobile-nav"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/";

          return (
            <Link
              className={`rounded-xl px-3 py-3 font-sans text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-[var(--color-accent-button)] text-[var(--color-on-dark)] " +
                    "hover:bg-[var(--color-accent-button-hover)]"
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

function getGreetingWord() {
  const hour = new Date().getHours();

  if (hour < 12) {
    return "Good morning";
  }

  if (hour < 18) {
    return "Good afternoon";
  }

  return "Good evening";
}

function HomeGreeting() {
  const { isLoaded, user } = useUser();
  const firstName = user?.firstName;

  if (!isLoaded) {
    return (
      <p className="font-sans text-sm font-medium text-[var(--color-text-muted)]">
        Loading your style space...
      </p>
    );
  }

  return (
    <h1
      className={
        "font-serif text-5xl font-semibold tracking-normal " +
        "text-[var(--color-text)] sm:text-6xl"
      }
    >
      {getGreetingWord()}
      {firstName ? `, ${firstName}` : ""}
    </h1>
  );
}

function CameraIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-6 w-6 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path
        d={
          "M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 " +
          "0 0 1-1-1V9a1 1 0 0 1 1-1Z"
        }
      />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}

function ScanItemCta() {
  return (
    <Link className={SCAN_CTA_CLASS} href="/capture">
      <CameraIcon />
      <span className="flex flex-col items-start">
        <span className="font-sans text-base font-semibold">Scan item</span>
        <span
          className={
            "font-sans text-xs font-medium " +
            "text-[var(--color-on-dark-muted)]"
          }
        >
          Photo to verdict in seconds
        </span>
      </span>
    </Link>
  );
}

function ScanNowBanner() {
  return (
    <section className={EMPTY_STATE_CARD_CLASS}>
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h2
            className={
              "font-serif text-3xl font-semibold tracking-normal " +
              "text-[var(--color-text)]"
            }
          >
            Heading out to shop?
          </h2>
          <p className="max-w-md text-base leading-7 text-[var(--color-text-muted)]">
            Keep Preeve open and scan anything that catches your eye. You&apos;ll
            know in seconds if it&apos;s worth it.
          </p>
        </div>

        <Link className={SCAN_CTA_CLASS} href="/capture">
          <CameraIcon />
          <span className="font-sans text-base font-semibold">Scan now</span>
        </Link>
      </div>
    </section>
  );
}

type ClosetSnapshotStats = {
  buyCount: number;
  maybeCount: number;
  skipCount: number;
  topColor: string | null;
  totalCount: number;
};

function computeClosetSnapshotStats(
  items: WardrobeItem[],
): ClosetSnapshotStats {
  const colorCounts = new Map<string, number>();
  let buyCount = 0;
  let maybeCount = 0;
  let skipCount = 0;

  for (const item of items) {
    if (item.verdict === "buy") {
      buyCount += 1;
    } else if (item.verdict === "maybe") {
      maybeCount += 1;
    } else if (item.verdict === "skip") {
      skipCount += 1;
    }

    if (item.detectedColor) {
      colorCounts.set(
        item.detectedColor,
        (colorCounts.get(item.detectedColor) ?? 0) + 1,
      );
    }
  }

  let topColor: string | null = null;
  let topColorCount = 0;
  for (const [color, count] of colorCounts) {
    if (count > topColorCount || (count === topColorCount && !topColor)) {
      topColor = color;
      topColorCount = count;
    }
  }

  return {
    buyCount,
    maybeCount,
    skipCount,
    topColor,
    totalCount: items.length,
  };
}

function formatSnapshotColor(color: string) {
  return color.charAt(0).toUpperCase() + color.slice(1).replace(/_/g, " ");
}

function getSnapshotSwatchFill(color: string): string | undefined {
  return COLOR_SWATCHES[color as ColorOption];
}

const SNAPSHOT_VALUE_CLASS =
  "font-serif text-3xl font-semibold tracking-normal lining-nums tabular-nums";
const SNAPSHOT_LABEL_CLASS =
  "font-sans text-xs font-semibold uppercase tracking-[0.14em] " +
  "text-[var(--color-text-muted)]";

function ClosetSnapshotStat({
  label,
  value,
  valueClassName = "text-[var(--color-text)]",
}: Readonly<{
  label: string;
  value: string;
  valueClassName?: string;
}>) {
  return (
    <div className="flex flex-col gap-1">
      <span className={`${SNAPSHOT_VALUE_CLASS} ${valueClassName}`}>
        {value}
      </span>
      <span className={SNAPSHOT_LABEL_CLASS}>{label}</span>
    </div>
  );
}

function ClosetSnapshot({ items }: Readonly<{ items: WardrobeItem[] }>) {
  if (items.length === 0) {
    return null;
  }

  const stats = computeClosetSnapshotStats(items);

  return (
    <section
      className={
        "rounded-2xl border border-[var(--color-text-muted)]/15 " +
        "bg-[var(--color-surface)]/45 px-6 py-5 " +
        "shadow-[0_10px_28px_rgba(62,46,41,0.08)]"
      }
    >
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <ClosetSnapshotStat
          label="Items saved"
          value={String(stats.totalCount)}
        />
        <ClosetSnapshotStat
          label="Buy"
          value={String(stats.buyCount)}
          valueClassName="text-[var(--color-sage)]"
        />
        <ClosetSnapshotStat
          label="Maybe"
          value={String(stats.maybeCount)}
          valueClassName="text-[var(--color-ochre)]"
        />
        <ClosetSnapshotStat
          label="Skip"
          value={String(stats.skipCount)}
          valueClassName="text-[var(--color-text-muted)]"
        />
        {stats.topColor ? (
          <div className="flex flex-col gap-1">
            <span
              className={
                `${SNAPSHOT_VALUE_CLASS} flex items-center gap-2.5 ` +
                "text-[var(--color-text)]"
              }
            >
              {getSnapshotSwatchFill(stats.topColor) ? (
                <span
                  aria-hidden="true"
                  className={
                    "h-4 w-4 rounded-full border " +
                    "border-[var(--color-text-muted)]/25"
                  }
                  style={{
                    background: getSnapshotSwatchFill(stats.topColor),
                  }}
                />
              ) : null}
              {formatSnapshotColor(stats.topColor)}
            </span>
            <span className={SNAPSHOT_LABEL_CLASS}>Most saved color</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function EmptyStateCard() {
  return (
    <section className={EMPTY_STATE_CARD_CLASS}>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
        <svg
          aria-hidden="true"
          className="h-9 w-9 text-[var(--color-sage)]"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="4" r="1.3" />
          <path d="M12 5.3v2" />
          <path
            d={
              "M12 7.3 3.6 13a1.6 1.6 0 0 0 .9 2.9h15a1.6 1.6 0 0 0 " +
              ".9-2.9L12 7.3Z"
            }
          />
        </svg>
        <p
          className={
            "font-sans text-sm font-semibold uppercase tracking-[0.18em] " +
            "text-[var(--color-text-muted)]"
          }
        >
          Ready when you are
        </p>
        <h2 className="font-serif text-4xl font-semibold tracking-normal text-[var(--color-text)]">
          Scan your first item.
        </h2>
        <p className="max-w-md text-base leading-7 text-[var(--color-text-muted)]">
          Start with one piece you are considering and keep your wardrobe
          decisions grounded in your preferences.
        </p>
        <ScanItemCta />
      </div>
    </section>
  );
}

function DashboardActivityLoading() {
  return (
    <section className={EMPTY_STATE_CARD_CLASS}>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 text-center">
        <p
          className={
            "font-sans text-sm font-semibold uppercase tracking-[0.18em] " +
            "text-[var(--color-text-muted)]"
          }
        >
          Checking your wardrobe
        </p>
        <span className={DASHBOARD_SPINNER_CLASS} />
      </div>
    </section>
  );
}

function formatVerdict(verdict: Verdict) {
  return verdict.charAt(0).toUpperCase() + verdict.slice(1);
}

function formatScanDate(createdAt: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));
}

function RecentActivityItem({ item }: Readonly<{ item: WardrobeItem }>) {
  const itemLabel = formatItemDisplayLabel(item);

  return (
    <Link
      aria-label={`Open ${itemLabel}`}
      className={
        "group flex h-full w-72 flex-shrink-0 snap-start flex-col overflow-hidden " +
        "rounded-2xl border border-[var(--color-text-muted)]/15 bg-[var(--color-bg)] " +
        "transition duration-[200ms] ease-[var(--ease-out)] " +
        "hover:shadow-[0_18px_48px_rgba(62,46,41,0.14)] sm:w-80"
      }
      href={`/items/${item.id}`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <Image
          alt={itemLabel}
          className={
            "object-cover transition duration-[300ms] " +
            "ease-[var(--ease-out)] group-hover:scale-[1.03]"
          }
          fill
          sizes="(min-width: 640px) 320px, 288px"
          src={item.photoUrl}
          unoptimized
        />
        {item.verdict ? (
          <span
            className={
              `${VERDICT_BADGE_CLASS} absolute right-3 top-3 ` +
              `${VERDICT_STYLES[item.verdict]}`
            }
          >
            {formatVerdict(item.verdict)}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col space-y-3 p-5">
        <div className="space-y-0.5">
          <p className="line-clamp-2 font-sans text-base font-semibold text-[var(--color-text)]">
            {itemLabel}
          </p>
          <p className="font-sans text-xs text-[var(--color-text-muted)]">
            {formatScanDate(item.createdAt)}
          </p>
        </div>

        {item.rationale ? (
          <p
            className={
              "line-clamp-3 border-l-2 py-1 pl-3 text-sm leading-6 " +
              `text-[var(--color-text-muted)] ${
                item.verdict
                  ? VERDICT_BORDER_STYLES[item.verdict]
                  : "border-[var(--color-text-muted)]/20"
              }`
            }
          >
            {item.rationale}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

function RecentActivityRow({ items }: Readonly<{ items: WardrobeItem[] }>) {
  return (
    <section className={EMPTY_STATE_CARD_CLASS}>
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-4">
          <p
            className={
              "flex items-center gap-2 font-sans text-sm font-semibold " +
              "uppercase tracking-[0.18em] text-[var(--color-text-muted)]"
            }
          >
            <ClockIcon />
            Recent activity
          </p>
          <Link
            className={
              "font-sans text-sm font-semibold text-[var(--color-accent)] " +
              "transition hover:text-[var(--color-accent-hover)]"
            }
            href="/wardrobe"
          >
            View your wardrobe &rarr;
          </Link>
        </div>

        <div
          className={
            "flex snap-x snap-mandatory items-stretch gap-5 overflow-x-auto pb-2"
          }
        >
          {items.map((item) => (
            <RecentActivityItem item={item} key={item.id} />
          ))}
        </div>
      </div>
    </section>
  );
}

function getDashboardErrorMessage(
  wardrobeError: Error | null,
  meError: Error | null,
) {
  if (wardrobeError && meError) {
    return "Unable to load your dashboard right now.";
  }

  return wardrobeError?.message ?? meError?.message ?? null;
}

function HomeDashboard() {
  const authenticatedApi = useAuthenticatedApi();
  const wardrobeQuery = useQuery({
    queryKey: ["homeWardrobeItems"],
    queryFn: () => authenticatedApi<WardrobeItemsResponse>("/api/items"),
  });
  const meQuery = useQuery({
    queryKey: ["homeMe"],
    queryFn: () => authenticatedApi<MeResponse>("/api/users/me"),
  });
  const recentItems = wardrobeQuery.data?.items.slice(0, 6) ?? [];
  const needsPreferences = meQuery.data?.hasCompletedPreferences === false;
  const dashboardErrorMessage = getDashboardErrorMessage(
    wardrobeQuery.error,
    meQuery.error,
  );
  const hasActivity = !wardrobeQuery.isLoading && recentItems.length > 0;
  const subtitleText = hasActivity
    ? "Welcome back. Here's what you've been circling lately."
    : "A quiet place to check whether a piece belongs with the style you " +
      "are building.";

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-6 py-8 text-foreground">
      <div aria-hidden="true" className="grain-overlay" />

      <div
        className={
          "relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full " +
          "max-w-5xl flex-col gap-10"
        }
      >
        <HomeTopBar />

        <section className="flex flex-1 flex-col justify-center gap-10 py-8">
          <div className="animate-fade-up space-y-4">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-4">
                <HomeGreeting />
                <p className="max-w-2xl text-lg leading-8 text-[var(--color-text-muted)]">
                  {subtitleText}
                </p>
              </div>

              <ScanItemCta />
            </div>

            {needsPreferences ? (
              <Link
                className={
                  "inline-block font-sans text-sm font-semibold " +
                  "text-[var(--color-accent)] transition hover:text-[var(--color-accent-hover)]"
                }
                href="/preferences/colors"
              >
                Set your style preferences for personalized verdicts &rarr;
              </Link>
            ) : null}
          </div>

          <div
            className="animate-fade-up flex flex-1 flex-col gap-10"
            style={{ animationDelay: "90ms" }}
          >
            {wardrobeQuery.isLoading ? (
              <DashboardActivityLoading />
            ) : dashboardErrorMessage ? (
              <InlineError
                actionLabel="Retry"
                message={dashboardErrorMessage}
                onAction={() => {
                  void wardrobeQuery.refetch();
                  void meQuery.refetch();
                }}
              />
            ) : recentItems.length > 0 ? (
              <>
                <ClosetSnapshot items={wardrobeQuery.data?.items ?? []} />
                <RecentActivityRow items={recentItems} />
                <ScanNowBanner />
              </>
            ) : (
              <EmptyStateCard />
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function EmailSignupForm({ compact = false }: Readonly<{ compact?: boolean }>) {
  const router = useRouter();
  const emailInputId = useId();
  const [email, setEmail] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    const path = trimmedEmail
      ? `/sign-up?email=${encodeURIComponent(trimmedEmail)}`
      : "/sign-up";
    router.push(path);
  }

  return (
    <form
      className={`flex w-full flex-col gap-3 sm:flex-row ${
        compact ? "max-w-xl" : "max-w-lg"
      }`}
      onSubmit={handleSubmit}
    >
      <label className="sr-only" htmlFor={emailInputId}>
        Email address
      </label>
      <input
        className={EMAIL_INPUT_CLASS}
        id={emailInputId}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email address"
        type="email"
        value={email}
      />
      <button className={LANDING_CTA_BUTTON_CLASS} type="submit">
        Preeve it
      </button>
    </form>
  );
}

function FaqItem({ item }: Readonly<{ item: (typeof FAQ_ITEMS)[number] }>) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <article className="border-b border-[var(--color-text-muted)]/15 first:pt-0 last:border-b-0">
      <button
        aria-expanded={isOpen}
        className={
          "flex w-full items-center justify-between gap-4 px-3 py-5 " +
          "text-left transition-colors duration-[200ms] " +
          "ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[var(--color-surface)]/35"
        }
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <h3 className="font-sans text-base font-semibold text-[var(--color-text)]">
          {item.question}
        </h3>
        <svg
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-[var(--color-text-muted)] transition-transform ` +
            `duration-[200ms] ease-[cubic-bezier(0.23,1,0.32,1)] ${
              isOpen ? "rotate-180" : ""
            }`}
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <div
        className={`grid px-3 transition-[grid-template-rows] duration-[250ms] ` +
          `ease-[cubic-bezier(0.23,1,0.32,1)] ${
            isOpen ? "mb-5 grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
      >
        <p className="overflow-hidden text-base leading-7 text-[var(--color-text-muted)]">
          {item.answer}
        </p>
      </div>
    </article>
  );
}

function ScanScreen() {
  return (
    <>
      <div
        className={
          "relative aspect-[3/4] w-full overflow-hidden rounded-2xl border " +
          "border-[var(--color-text-muted)]/15 bg-[var(--color-surface)]/60"
        }
      >
        <div
          className={
            "absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 bg-[var(--color-accent)]"
          }
        />
      </div>
      <p className="text-center font-sans text-sm font-semibold text-[var(--color-text-muted)]">
        Scanning your item...
      </p>
    </>
  );
}

function VerdictScreen() {
  return (
    <>
      <div className="flex justify-center gap-2">
        <span
          className={`${BADGE_CLASS} bg-[var(--color-sage-badge)] text-[var(--color-on-dark)]`}
        >
          Buy
        </span>
        <span
          className={
            `${BADGE_CLASS} bg-[var(--color-ochre)]/55 ` +
            "text-[var(--color-text)]"
          }
        >
          Maybe
        </span>
        <span
          className={
            `${BADGE_CLASS} bg-[var(--color-accent-dark)]/35 ` +
            "text-[var(--color-text-muted)]"
          }
        >
          Skip
        </span>
      </div>
      <p className="text-center font-serif text-3xl font-semibold text-[var(--color-text)]">
        Buy
      </p>
      <p className="text-center text-sm leading-6 text-[var(--color-text-muted)]">
        Navy fits the palette you saved.
      </p>
    </>
  );
}

function PairingScreen() {
  return (
    <div
      className={
        "rounded-2xl border border-[var(--color-text-muted)]/15 " +
        "bg-[var(--color-bg)] p-4"
      }
    >
      <div className="mb-3 h-20 rounded-xl bg-[var(--color-surface)]/70" />
      <p className="text-sm leading-6 text-[var(--color-text-muted)]">
        Pair it with tan or white pieces for an easy repeat outfit.
      </p>
    </div>
  );
}

const PHONE_SCREENS = [
  { Screen: ScanScreen, key: "scan" },
  { Screen: VerdictScreen, key: "verdict" },
  { Screen: PairingScreen, key: "pairing" },
];

function PhoneMockup({ activeStep }: Readonly<{ activeStep: number }>) {
  return (
    <div className="mx-auto w-full max-w-[280px]">
      <div
        className={
          "relative overflow-hidden rounded-[2.5rem] border-[10px] " +
          "border-[var(--color-accent-dark)] bg-[var(--color-accent-dark)] " +
          "shadow-[0_32px_80px_rgba(62,46,41,0.25)]"
        }
      >
        <div
          className={
            "absolute left-1/2 top-0 z-10 h-6 w-32 -translate-x-1/2 " +
            "rounded-b-2xl bg-[var(--color-accent-dark)]"
          }
        />
        <div
          className={
            "relative aspect-[9/19.5] overflow-hidden rounded-[2rem] " +
            "bg-[var(--color-bg)]"
          }
        >
          {PHONE_SCREENS.map(({ Screen, key }, index) => (
            <div
              className={
                "absolute inset-0 flex flex-col justify-center gap-4 p-6 " +
                "transition-all duration-[420ms] ease-[cubic-bezier(0.23,1,0.32,1)] " +
                (activeStep === index
                  ? "translate-y-0 scale-100 opacity-100"
                  : "translate-y-3 scale-95 opacity-0")
              }
              key={key}
            >
              <Screen />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex justify-center gap-2">
        {PHONE_SCREENS.map(({ key }, index) => (
          <span
            aria-hidden="true"
            className={
              "h-2 rounded-full transition-[width,background-color] " +
              "duration-[300ms] ease-[cubic-bezier(0.23,1,0.32,1)] " +
              (activeStep === index
                ? "w-6 bg-[var(--color-accent)]"
                : "w-2 bg-[var(--color-text-muted)]/20")
            }
            key={key}
          />
        ))}
      </div>
    </div>
  );
}

function HowItWorksScroll() {
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          const index = Number(entry.target.getAttribute("data-step-index"));
          setActiveStep(index);
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );

    const currentStepEls = stepRefs.current;
    currentStepEls.forEach((stepEl) => {
      if (stepEl) {
        observer.observe(stepEl);
      }
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="grid gap-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
      <div className="flex flex-col gap-16 sm:gap-24 lg:gap-40 lg:py-32">
        {HOW_IT_WORKS_STEPS.map((step, index) => (
          <div
            className={`transition-opacity duration-[300ms] ${
              activeStep === index ? "opacity-100" : "opacity-40"
            }`}
            data-step-index={index}
            key={step.title}
            ref={(el) => {
              stepRefs.current[index] = el;
            }}
          >
            <div className="flex items-center gap-4">
              <span
                className={
                  "flex h-12 w-12 shrink-0 items-center justify-center " +
                  "rounded-full bg-[var(--color-accent-button)] font-serif text-xl " +
                  "font-semibold text-[var(--color-on-dark)]"
                }
              >
                {index + 1}
              </span>
              <h3
                className={
                  "font-serif text-4xl font-semibold tracking-normal " +
                  "text-[var(--color-text)]"
                }
              >
                {step.title}
              </h3>
            </div>
            <p className="mt-3 max-w-md text-lg leading-8 text-[var(--color-text-muted)]">
              {step.copy}
            </p>
          </div>
        ))}
      </div>

      <div className="hidden lg:sticky lg:top-24 lg:block lg:self-start">
        <PhoneMockup activeStep={activeStep} />
      </div>
    </div>
  );
}

function LandingPage() {
  const currentYear = new Date().getFullYear();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <div aria-hidden="true" className="grain-overlay" />

      <div
        className={
          "sticky top-0 z-50 border-b border-[var(--color-text-muted)]/10 " +
          "bg-[var(--color-bg)]/85 backdrop-blur-md"
        }
      >
        <nav className={LANDING_NAV_CLASS}>
          <Link
            className="font-serif text-5xl font-semibold tracking-normal text-[var(--color-text)]"
            href="/"
          >
            Preeve
          </Link>

          <div className="hidden items-center gap-8 sm:flex">
            {LANDING_NAV_LINKS.map((navLink) => (
              <a
                className={
                  "font-sans text-sm font-semibold text-[var(--color-text-muted)] " +
                  "transition-colors duration-[160ms] hover:text-[var(--color-accent)]"
                }
                href={navLink.href}
                key={navLink.href}
              >
                {navLink.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              aria-controls="landing-mobile-nav"
              aria-expanded={isMobileNavOpen}
              aria-label="Toggle landing navigation"
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
            <ThemeToggle />
            <Link className={SIGN_IN_BUTTON_CLASS} href="/sign-in">
              Sign in
            </Link>
          </div>

          <div
            className={
              `basis-full flex-col gap-2 border-t ` +
              `border-[var(--color-text-muted)]/10 pt-3 sm:hidden ${
                isMobileNavOpen ? "flex" : "hidden"
              }`
            }
            id="landing-mobile-nav"
          >
            {LANDING_NAV_LINKS.map((navLink) => (
              <a
                className={
                  "rounded-xl px-3 py-3 font-sans text-sm font-semibold " +
                  "text-[var(--color-text-muted)] transition-colors duration-[160ms] " +
                  "hover:bg-[var(--color-surface)]/45 hover:text-[var(--color-accent)]"
                }
                href={navLink.href}
                key={navLink.href}
                onClick={() => setIsMobileNavOpen(false)}
              >
                {navLink.label}
              </a>
            ))}
          </div>
        </nav>
      </div>

      <section
        className={
          "relative flex min-h-[calc(100dvh-6rem)] flex-col justify-center " +
          "overflow-hidden py-12"
        }
      >
        <div aria-hidden="true" className="absolute inset-0 z-0">
          <Image
            alt=""
            className="object-cover object-center"
            fill
            priority
            src="/preeve-branding.png"
          />
          <div
            className={
              "absolute inset-0 bg-gradient-to-b from-[#241a16]/45 " +
              "via-[#241a16]/60 to-[#241a16]/75"
            }
          />
          <div
            className={
              "absolute inset-0 bg-[radial-gradient(ellipse_75%_60%_at_50%_48%," +
              "rgba(20,14,12,0.55)_0%,rgba(20,14,12,0.3)_45%," +
              "rgba(20,14,12,0.05)_75%,rgba(20,14,12,0)_100%)]"
            }
          />
          <svg
            aria-hidden="true"
            className="absolute inset-x-0 bottom-0 h-16 w-full"
            preserveAspectRatio="none"
            viewBox="0 0 1440 100"
          >
            <path
              d={
                "M0,50 C120,20 240,80 360,50 C480,20 600,80 720,50 " +
                "C840,20 960,80 1080,50 C1200,20 1320,80 1440,50 " +
                "L1440,100 L0,100 Z"
              }
              fill="var(--color-bg)"
            />
            <path
              className={
                "[filter:drop-shadow(0_14px_10px_rgba(0,0,0,0.55))_" +
                "drop-shadow(0_28px_32px_rgba(0,0,0,0.4))]"
              }
              d={
                "M0,50 C120,20 240,80 360,50 C480,20 600,80 720,50 " +
                "C840,20 960,80 1080,50 C1200,20 1320,80 1440,50"
              }
              fill="none"
              stroke="var(--color-sage)"
              strokeLinecap="round"
              strokeWidth={16}
            />
          </svg>
        </div>

        <div
          className={`${LANDING_SECTION_CLASS} relative z-10 flex flex-col items-center gap-10`}
        >
          <div className="flex max-w-2xl flex-col items-center gap-6 text-center">
            <h1 className={`animate-fade-up ${HERO_HEADLINE_CLASS}`}>
              Preeve it before you buy it.
            </h1>
            <p
              className={
                "animate-fade-up max-w-lg text-xl leading-9 " +
                "text-[var(--color-on-dark)]/85"
              }
              style={{ animationDelay: "90ms" }}
            >
              Ready to skip the regret? Enter your email to get started.
            </p>
            <div
              className="animate-fade-up flex w-full justify-center"
              style={{ animationDelay: "160ms" }}
            >
              <EmailSignupForm />
            </div>
          </div>
        </div>
      </section>

      <section
        className={
          `${LANDING_SECTION_CLASS} scroll-mt-28 py-24 text-center`
        }
        id="why-preeve"
      >
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5">
          <p
            className={
              "font-sans text-sm font-semibold uppercase " +
              "tracking-[0.28em] text-[var(--color-accent)]"
            }
          >
            Why Preeve
          </p>
          <h2
            className={
              "font-serif text-5xl font-semibold tracking-normal " +
              "text-[var(--color-text)]"
            }
          >
            Built for the pause before you buy.
          </h2>
          <p className="text-xl leading-9 text-[var(--color-text-muted)]">
            Impulse buys pile up fast: in a cart, in a fitting room, in a
            closet you already forgot about. Preeve gives you one honest
            look before a piece is yours, so you know it actually fits the
            wardrobe you&apos;re building, not just the moment you&apos;re
            standing in.
          </p>
        </div>
      </section>

      <section className={LANDING_BAND_CLASS} id="how-it-works">
        <div className={LANDING_SECTION_CLASS}>
          <div className="mb-4 space-y-3">
            <h2
              className={
                "font-serif text-5xl font-semibold tracking-normal " +
                "text-[var(--color-text)]"
              }
            >
              How Preeve works
            </h2>
          </div>

          <HowItWorksScroll />
        </div>
      </section>

      <section
        className={
          `${LANDING_SECTION_CLASS} scroll-mt-28 py-24 text-center`
        }
        id="privacy"
      >
        <div className="mx-auto flex max-w-2xl flex-col items-center gap-5">
          <svg
            aria-hidden="true"
            className="h-9 w-9 text-[var(--color-sage)]"
            fill="none"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <rect height="11" rx="2" width="16" x="4" y="10" />
            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          </svg>
          <p
            className={
              "font-sans text-sm font-semibold uppercase " +
              "tracking-[0.28em] text-[var(--color-sage)]"
            }
          >
            Privacy
          </p>
          <h2
            className={
              "font-serif text-5xl font-semibold tracking-normal " +
              "text-[var(--color-text)]"
            }
          >
            Your photos stay private, by design.
          </h2>
          <p className="text-xl leading-9 text-[var(--color-text-muted)]">
            Every photo you scan is stored in a private bucket that only
            Preeve&apos;s backend can reach. When you need to see it again,
            we generate a short-lived link just for you. There&apos;s no
            public URL for any photo, ever, and nothing you scan is shared
            with other users.
          </p>
        </div>
      </section>

      <section className={LANDING_BAND_CLASS} id="faq">
        <div className={LANDING_SECTION_CLASS}>
          <h2
            className={
              "mb-10 font-serif text-5xl font-semibold tracking-normal " +
              "text-[var(--color-text)]"
            }
          >
            Frequently Asked Questions
          </h2>
          <div className="mx-auto flex max-w-2xl flex-col">
            {FAQ_ITEMS.map((item) => (
              <FaqItem item={item} key={item.question} />
            ))}
          </div>
        </div>
      </section>

      <section className={`${LANDING_SECTION_CLASS} py-24`}>
        <div className={CTA_BANNER_CLASS}>
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
            <h2
              className={
                "font-serif text-5xl font-semibold tracking-normal " +
                "text-[var(--color-text)]"
              }
            >
              Preeve it before you bring it home.
            </h2>
            <p className="text-lg leading-8 text-[var(--color-text-muted)]">
              Snap a pic, get the verdict, skip the regret.
            </p>
            <EmailSignupForm compact />
          </div>
        </div>
      </section>

      <footer className="bg-[var(--color-accent-dark)] py-14">
        <div className={LANDING_SECTION_CLASS}>
          <div className={FOOTER_LAYOUT_CLASS}>
            <div className="space-y-2">
              <p
                className={
                  "font-serif text-4xl font-semibold tracking-normal " +
                  "text-[var(--color-on-dark)]"
                }
              >
                Preeve
              </p>
              <p className="text-base text-[var(--color-on-dark-muted)]">
                A pause before every purchase.
              </p>
              <p className="font-sans text-sm text-[var(--color-on-dark-muted)]/70">
                {currentYear} Preeve
              </p>
            </div>

            <div className="flex gap-4 font-sans text-sm font-semibold">
              <a
                className={
                  "text-[var(--color-on-dark-muted)] transition " +
                  "hover:text-[var(--color-accent)]"
                }
                href="https://github.com/justenhilliard"
                rel="noreferrer"
                target="_blank"
              >
                GitHub
              </a>
              <a
                className={
                  "text-[var(--color-on-dark-muted)] transition " +
                  "hover:text-[var(--color-accent)]"
                }
                href="https://www.linkedin.com/in/justen-hilliard"
                rel="noreferrer"
                target="_blank"
              >
                LinkedIn
              </a>
              <a
                className={
                  "text-[var(--color-on-dark-muted)] transition " +
                  "hover:text-[var(--color-accent)]"
                }
                href="mailto:justenkhilliard@gmail.com"
              >
                Contact
              </a>
              <Link
                className={
                  "text-[var(--color-on-dark-muted)] transition " +
                  "hover:text-[var(--color-accent)]"
                }
                href="/privacy"
              >
                Privacy
              </Link>
              <Link
                className={
                  "text-[var(--color-on-dark-muted)] transition " +
                  "hover:text-[var(--color-accent)]"
                }
                href="/terms"
              >
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}

function LoadingHome() {
  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className={LOADING_HOME_CLASS}>
        <p className="font-sans text-sm font-medium text-[var(--color-text-muted)]">
          Loading Preeve...
        </p>
      </div>
    </main>
  );
}

export default function Home() {
  const { isLoaded, isSignedIn } = useAuth();

  if (!isLoaded) {
    return <LoadingHome />;
  }

  return isSignedIn ? <HomeDashboard /> : <LandingPage />;
}
