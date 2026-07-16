"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import { useAuthenticatedApi } from "./apiClient";
import { formatOptionLabel } from "./preferences/components";

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
  "flex flex-col gap-6 border-b border-[#4A413C]/15 pb-6 sm:flex-row " +
  "sm:items-center sm:justify-between";
const EMPTY_STATE_CARD_CLASS =
  "rounded-2xl border border-[#4A413C]/15 bg-[#D8D3CC]/45 p-8 " +
  "shadow-[0_24px_70px_rgba(62,46,41,0.10)]";
const LANDING_SECTION_CLASS =
  "mx-auto w-full max-w-5xl px-6";
const LANDING_BAND_CLASS =
  "scroll-mt-28 border-y border-[#4A413C]/10 bg-[#D8D3CC]/30 py-24";
const LANDING_NAV_CLASS =
  "mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6";
const LANDING_CTA_BUTTON_CLASS =
  "rounded-xl bg-[#B8674A] px-6 py-3 font-sans text-sm font-semibold " +
  "text-[#FAF9F8] transition-[background-color,transform] duration-[160ms] " +
  "ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#a95c42] active:scale-[0.97]";
const CLIPPED_CTA_CLASS =
  LANDING_CTA_BUTTON_CLASS + " [clip-path:polygon(0_0,calc(100%-14px)_0," +
  "100%_14px,100%_100%,0_100%)]";
const SIGN_IN_BUTTON_CLASS =
  "rounded-xl bg-[#3E2E29] px-5 py-2.5 font-sans text-sm font-semibold " +
  "text-[#FAF9F8] transition-[background-color,transform] duration-[160ms] " +
  "ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#2f2320] active:scale-[0.97] " +
  "[clip-path:polygon(0_0,calc(100%-10px)_0,100%_10px,100%_100%,0_100%)]";
const EMAIL_INPUT_CLASS =
  "min-h-12 flex-1 rounded-xl border border-[#4A413C]/20 bg-[#FAF9F8] px-4 " +
  "font-sans text-sm text-[#3E2E29] outline-none transition " +
  "placeholder:text-[#4A413C]/65 focus:border-[#B8674A]";
const HERO_HEADLINE_CLASS =
  "font-serif text-6xl font-semibold leading-[1.05] tracking-normal " +
  "text-[#FAF9F8] sm:text-7xl lg:text-8xl";
const CTA_BANNER_CLASS =
  "rounded-2xl border border-[#4A413C]/15 bg-[#D8D3CC]/45 p-8 " +
  "shadow-[0_24px_70px_rgba(62,46,41,0.10)]";
const FOOTER_LAYOUT_CLASS =
  "flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between";
const LOADING_HOME_CLASS =
  "mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center " +
  "justify-center";
const BADGE_CLASS =
  "rounded-full px-4 py-2 font-sans text-sm font-semibold text-[#FAF9F8]";
const VERDICT_BADGE_CLASS =
  "inline-flex rounded-full px-3 py-1 font-sans text-xs font-semibold";
const VERDICT_STYLES: Record<Verdict, string> = {
  buy: "bg-[#8A9A7B] text-[#FAF9F8]",
  maybe: "bg-[#C9A66B] text-[#FAF9F8]",
  skip: "bg-[#3E2E29] text-[#FAF9F8]",
};
const VERDICT_BORDER_STYLES: Record<Verdict, string> = {
  buy: "border-[#8A9A7B]",
  maybe: "border-[#C9A66B]",
  skip: "border-[#3E2E29]",
};
const SCAN_CTA_CLASS =
  "flex items-center gap-4 rounded-xl bg-[#B8674A] px-6 py-4 text-left " +
  "text-[#FAF9F8] transition-[background-color,transform] duration-[160ms] " +
  "ease-[var(--ease-out)] hover:bg-[#a95c42] active:scale-[0.97]";
const DASHBOARD_SPINNER_CLASS =
  "h-9 w-9 animate-spin rounded-full border-[3px] border-[#4A413C]/15 " +
  "border-t-[#B8674A]";

function HomeTopBar() {
  return (
    <nav className={TOP_BAR_CLASS}>
      <Link
        className="font-serif text-4xl font-semibold tracking-normal text-[#3E2E29]"
        href="/"
      >
        Preeve
      </Link>

      <div className="flex flex-wrap gap-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/";

          return (
            <Link
              className={`rounded-full px-4 py-2 font-sans text-sm font-semibold transition ${
                isActive
                  ? "bg-[#B8674A] text-[#FAF9F8]"
                  : "text-[#4A413C] hover:bg-[#D8D3CC]/45"
              }`}
              href={item.href}
              key={item.href}
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
      <p className="font-sans text-sm font-medium text-[#4A413C]">
        Loading your style space...
      </p>
    );
  }

  return (
    <h1 className="font-serif text-5xl font-semibold tracking-normal text-[#3E2E29] sm:text-6xl">
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
        <span className="font-sans text-xs font-medium text-[#FAF9F8]/75">
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
          <h2 className="font-serif text-3xl font-semibold tracking-normal text-[#3E2E29]">
            Heading out to shop?
          </h2>
          <p className="max-w-md text-base leading-7 text-[#4A413C]">
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
          className="h-9 w-9 text-[#8A9A7B]"
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
        <p className="font-sans text-sm font-semibold uppercase tracking-[0.18em] text-[#4A413C]">
          Ready when you are
        </p>
        <h2 className="font-serif text-4xl font-semibold tracking-normal text-[#3E2E29]">
          Scan your first item.
        </h2>
        <p className="max-w-md text-base leading-7 text-[#4A413C]">
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
        <p className="font-sans text-sm font-semibold uppercase tracking-[0.18em] text-[#4A413C]">
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

function formatCategoryColor(item: WardrobeItem) {
  if (!item.detectedCategory || !item.detectedColor) {
    return "Unlabeled item";
  }

  return `${formatOptionLabel(item.detectedColor)} ${formatOptionLabel(
    item.detectedCategory,
  )}`;
}

function formatScanDate(createdAt: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(createdAt));
}

function RecentActivityItem({ item }: Readonly<{ item: WardrobeItem }>) {
  return (
    <Link
      aria-label={`Open ${formatCategoryColor(item)}`}
      className={
        "group block overflow-hidden rounded-2xl border " +
        "border-[#4A413C]/15 bg-[#FAF9F8] transition duration-[200ms] " +
        "ease-[var(--ease-out)] hover:shadow-[0_18px_48px_rgba(62,46,41,0.14)]"
      }
      href={`/items/${item.id}`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <Image
          alt={formatCategoryColor(item)}
          className={
            "object-cover transition duration-[300ms] " +
            "ease-[var(--ease-out)] group-hover:scale-[1.03]"
          }
          fill
          sizes="(min-width: 1024px) 320px, (min-width: 640px) 45vw, 100vw"
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

      <div className="space-y-3 p-4">
        <div className="space-y-0.5">
          <p className="font-sans text-base font-semibold text-[#3E2E29]">
            {formatCategoryColor(item)}
          </p>
          <p className="font-sans text-xs text-[#4A413C]">
            {formatScanDate(item.createdAt)}
          </p>
        </div>

        {item.rationale ? (
          <p
            className={`border-l-2 py-1 pl-3 text-sm leading-6 text-[#4A413C] ${
              item.verdict ? VERDICT_BORDER_STYLES[item.verdict] : "border-[#4A413C]/20"
            }`}
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
              "uppercase tracking-[0.18em] text-[#4A413C]"
            }
          >
            <ClockIcon />
            Recent activity
          </p>
          <Link
            className={
              "font-sans text-sm font-semibold text-[#B8674A] " +
              "transition hover:text-[#a95c42]"
            }
            href="/wardrobe"
          >
            View your wardrobe &rarr;
          </Link>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <RecentActivityItem item={item} key={item.id} />
          ))}
        </div>
      </div>
    </section>
  );
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
  const hasActivity = !wardrobeQuery.isLoading && recentItems.length > 0;
  const subtitleText = hasActivity
    ? "Welcome back. Here's what you've been circling lately."
    : "A quiet place to check whether a piece belongs with the style you " +
      "are building.";

  return (
    <main className="relative min-h-screen overflow-hidden bg-background px-6 py-8 text-foreground">
      <div aria-hidden="true" className="grain-overlay" />

      <svg
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 z-0 h-[48vh] w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1440 100"
      >
        <path
          d={
            "M0,50 C120,20 240,80 360,50 C480,20 600,80 720,50 " +
            "C840,20 960,80 1080,50 C1200,20 1320,80 1440,50 " +
            "L1440,100 L0,100 Z"
          }
          fill="#3E2E29"
        />
        <path
          className={
            "[filter:drop-shadow(0_10px_8px_rgba(36,26,22,0.6))_" +
            "drop-shadow(0_24px_28px_rgba(36,26,22,0.4))]"
          }
          d={
            "M0,50 C120,20 240,80 360,50 C480,20 600,80 720,50 " +
            "C840,20 960,80 1080,50 C1200,20 1320,80 1440,50"
          }
          fill="none"
          stroke="#8A9A7B"
          strokeLinecap="round"
          strokeWidth={5}
        />
      </svg>

      <div
        className={
          "relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full " +
          "max-w-5xl flex-col gap-10"
        }
      >
        <HomeTopBar />

        <section className="flex flex-1 flex-col justify-center gap-10 py-8">
          <div className="space-y-4">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-4">
                <HomeGreeting />
                <p className="max-w-2xl text-lg leading-8 text-[#4A413C]">
                  {subtitleText}
                </p>
              </div>

              <ScanItemCta />
            </div>

            {needsPreferences ? (
              <Link
                className={
                  "inline-block font-sans text-sm font-semibold " +
                  "text-[#B8674A] transition hover:text-[#a95c42]"
                }
                href="/preferences/colors"
              >
                Set your style preferences for personalized verdicts &rarr;
              </Link>
            ) : null}
          </div>

          {wardrobeQuery.isLoading ? (
            <DashboardActivityLoading />
          ) : recentItems.length > 0 ? (
            <>
              <RecentActivityRow items={recentItems} />
              <ScanNowBanner />
            </>
          ) : (
            <EmptyStateCard />
          )}
        </section>
      </div>
    </main>
  );
}

function EmailSignupForm({ compact = false }: Readonly<{ compact?: boolean }>) {
  const router = useRouter();
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
      <input
        className={EMAIL_INPUT_CLASS}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email address"
        type="email"
        value={email}
      />
      <button className={CLIPPED_CTA_CLASS} type="submit">
        Preeve it
      </button>
    </form>
  );
}

function FaqItem({ item }: Readonly<{ item: (typeof FAQ_ITEMS)[number] }>) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <article className="border-b border-[#4A413C]/15 first:pt-0 last:border-b-0">
      <button
        aria-expanded={isOpen}
        className={
          "flex w-full items-center justify-between gap-4 px-3 py-5 " +
          "text-left transition-colors duration-[200ms] " +
          "ease-[cubic-bezier(0.23,1,0.32,1)] hover:bg-[#D8D3CC]/35"
        }
        onClick={() => setIsOpen((currentValue) => !currentValue)}
        type="button"
      >
        <h3 className="font-sans text-base font-semibold text-[#3E2E29]">
          {item.question}
        </h3>
        <svg
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-[#4A413C] transition-transform ` +
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
        <p className="overflow-hidden text-base leading-7 text-[#4A413C]">
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
          "border-[#4A413C]/15 bg-[#D8D3CC]/60"
        }
      >
        <div
          className={
            "absolute inset-x-6 top-1/2 h-0.5 -translate-y-1/2 bg-[#B8674A]"
          }
        />
      </div>
      <p className="text-center font-sans text-sm font-semibold text-[#4A413C]">
        Scanning your item...
      </p>
    </>
  );
}

function VerdictScreen() {
  return (
    <>
      <div className="flex justify-center gap-2">
        <span className={`${BADGE_CLASS} bg-[#8A9A7B]`}>Buy</span>
        <span className={`${BADGE_CLASS} bg-[#C9A66B]/55 text-[#4A413C]`}>
          Maybe
        </span>
        <span className={`${BADGE_CLASS} bg-[#3E2E29]/35 text-[#4A413C]`}>
          Skip
        </span>
      </div>
      <p className="text-center font-serif text-3xl font-semibold text-[#3E2E29]">
        Buy
      </p>
      <p className="text-center text-sm leading-6 text-[#4A413C]">
        Navy fits the palette you saved.
      </p>
    </>
  );
}

function PairingScreen() {
  return (
    <div className="rounded-2xl border border-[#4A413C]/15 bg-[#FAF9F8] p-4">
      <div className="mb-3 h-20 rounded-xl bg-[#D8D3CC]/70" />
      <p className="text-sm leading-6 text-[#4A413C]">
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
    <div className="order-first mx-auto w-full max-w-[280px] lg:order-none">
      <div
        className={
          "relative overflow-hidden rounded-[2.5rem] border-[10px] " +
          "border-[#3E2E29] bg-[#3E2E29] " +
          "shadow-[0_32px_80px_rgba(62,46,41,0.25)]"
        }
      >
        <div
          className={
            "absolute left-1/2 top-0 z-10 h-6 w-32 -translate-x-1/2 " +
            "rounded-b-2xl bg-[#3E2E29]"
          }
        />
        <div className="relative aspect-[9/19.5] overflow-hidden rounded-[2rem] bg-[#FAF9F8]">
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
                ? "w-6 bg-[#B8674A]"
                : "w-2 bg-[#4A413C]/20")
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
      <div className="flex flex-col gap-40 lg:py-32">
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
                  "rounded-full bg-[#B8674A] font-serif text-xl " +
                  "font-semibold text-[#FAF9F8]"
                }
              >
                {index + 1}
              </span>
              <h3 className="font-serif text-4xl font-semibold tracking-normal text-[#3E2E29]">
                {step.title}
              </h3>
            </div>
            <p className="mt-3 max-w-md text-lg leading-8 text-[#4A413C]">
              {step.copy}
            </p>
          </div>
        ))}
      </div>

      <div className="lg:sticky lg:top-24 lg:self-start">
        <PhoneMockup activeStep={activeStep} />
      </div>
    </div>
  );
}

function LandingPage() {
  const currentYear = new Date().getFullYear();

  return (
    <main className="relative min-h-screen bg-background text-foreground">
      <div aria-hidden="true" className="grain-overlay" />

      <div
        className={
          "sticky top-0 z-50 border-b border-[#4A413C]/10 " +
          "bg-[#FAF9F8]/85 backdrop-blur-md"
        }
      >
        <nav className={LANDING_NAV_CLASS}>
          <Link
            className="font-serif text-5xl font-semibold tracking-normal text-[#3E2E29]"
            href="/"
          >
            Preeve
          </Link>

          <div className="hidden items-center gap-8 sm:flex">
            {LANDING_NAV_LINKS.map((navLink) => (
              <a
                className={
                  "font-sans text-sm font-semibold text-[#4A413C] " +
                  "transition-colors duration-[160ms] hover:text-[#B8674A]"
                }
                href={navLink.href}
                key={navLink.href}
              >
                {navLink.label}
              </a>
            ))}
          </div>

          <Link className={SIGN_IN_BUTTON_CLASS} href="/sign-in">
            Sign in
          </Link>
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
            src="/preeveherobackground.png"
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
              fill="#FAF9F8"
            />
            <path
              className={
                "[filter:drop-shadow(0_10px_8px_rgba(36,26,22,0.6))_" +
                "drop-shadow(0_24px_28px_rgba(36,26,22,0.4))]"
              }
              d={
                "M0,50 C120,20 240,80 360,50 C480,20 600,80 720,50 " +
                "C840,20 960,80 1080,50 C1200,20 1320,80 1440,50"
              }
              fill="none"
              stroke="#8A9A7B"
              strokeLinecap="round"
              strokeWidth={9}
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
                "text-[#FAF9F8]/85"
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
              "tracking-[0.28em] text-[#B8674A]"
            }
          >
            Why Preeve
          </p>
          <h2 className="font-serif text-5xl font-semibold tracking-normal text-[#3E2E29]">
            Built for the pause before you buy.
          </h2>
          <p className="text-xl leading-9 text-[#4A413C]">
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
            <h2 className="font-serif text-5xl font-semibold tracking-normal text-[#3E2E29]">
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
            className="h-9 w-9 text-[#8A9A7B]"
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
              "tracking-[0.28em] text-[#8A9A7B]"
            }
          >
            Privacy
          </p>
          <h2 className="font-serif text-5xl font-semibold tracking-normal text-[#3E2E29]">
            Your photos stay private, by design.
          </h2>
          <p className="text-xl leading-9 text-[#4A413C]">
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
          <h2 className="mb-10 font-serif text-5xl font-semibold tracking-normal text-[#3E2E29]">
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
            <h2 className="font-serif text-5xl font-semibold tracking-normal text-[#3E2E29]">
              Preeve it before you bring it home.
            </h2>
            <p className="text-lg leading-8 text-[#4A413C]">
              Snap a pic, get the verdict, skip the regret.
            </p>
            <EmailSignupForm compact />
          </div>
        </div>
      </section>

      <footer className="bg-[#3E2E29] py-14">
        <div className={LANDING_SECTION_CLASS}>
          <div className={FOOTER_LAYOUT_CLASS}>
            <div className="space-y-2">
              <p className="font-serif text-4xl font-semibold tracking-normal text-[#FAF9F8]">
                Preeve
              </p>
              <p className="text-base text-[#D8D3CC]">
                A pause before every purchase.
              </p>
              <p className="font-sans text-sm text-[#D8D3CC]/70">
                {currentYear} Preeve
              </p>
            </div>

            <div className="flex gap-4 font-sans text-sm font-semibold">
              <a
                className="text-[#D8D3CC] transition hover:text-[#B8674A]"
                href="https://github.com/justenhilliard"
                rel="noreferrer"
                target="_blank"
              >
                GitHub
              </a>
              <a
                className="text-[#D8D3CC] transition hover:text-[#B8674A]"
                href="https://www.linkedin.com/in/justen-hilliard"
                rel="noreferrer"
                target="_blank"
              >
                LinkedIn
              </a>
              <a
                className="text-[#D8D3CC] transition hover:text-[#B8674A]"
                href="mailto:justenkhilliard@gmail.com"
              >
                Contact
              </a>
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
        <p className="font-sans text-sm font-medium text-[#4A413C]">
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
