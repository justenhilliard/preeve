"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { PrimaryLink } from "./preferences/components";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/wardrobe", label: "Wardrobe" },
  { href: "/preferences/colors", label: "Preferences" },
  { href: "/settings", label: "Settings" },
];

const HOW_IT_WORKS_STEPS = [
  {
    title: "Scan",
    copy: "Snap or upload the piece while you are still deciding.",
  },
  {
    title: "Verdict",
    copy: "Get a Buy, Maybe, or Skip based on your saved preferences.",
  },
  {
    title: "Pairing",
    copy: "See a simple styling idea when Preeve has a matching suggestion.",
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
const LANDING_NAV_CLASS =
  "mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6";
const LANDING_CTA_BUTTON_CLASS =
  "rounded-xl bg-[#B8674A] px-6 py-3 font-sans text-sm font-semibold " +
  "text-[#FAF9F8] transition hover:bg-[#a95c42]";
const CLIPPED_CTA_CLASS =
  LANDING_CTA_BUTTON_CLASS + " [clip-path:polygon(0_0,calc(100%-14px)_0," +
  "100%_14px,100%_100%,0_100%)]";
const EMAIL_INPUT_CLASS =
  "min-h-12 flex-1 rounded-xl border border-[#4A413C]/20 bg-[#FAF9F8] px-4 " +
  "font-sans text-sm text-[#3E2E29] outline-none transition " +
  "placeholder:text-[#4A413C]/65 focus:border-[#B8674A]";
const LANDING_CARD_CLASS =
  "rounded-2xl border border-[#4A413C]/15 bg-[#D8D3CC]/45 p-6 " +
  "shadow-[0_18px_48px_rgba(62,46,41,0.08)]";
const LANDING_PREVIEW_CLASS =
  "relative min-h-[420px] overflow-hidden rounded-2xl border " +
  "border-[#4A413C]/15 bg-[#D8D3CC]/45 p-6 " +
  "shadow-[0_24px_70px_rgba(62,46,41,0.12)]";
const LANDING_PREVIEW_WASH_CLASS =
  "absolute inset-0 " +
  "bg-[linear-gradient(135deg,rgba(250,249,248,0.9),rgba(216,211,204,0.55))]";
const HERO_HEADLINE_CLASS =
  "max-w-3xl font-serif text-6xl font-semibold tracking-normal " +
  "text-[#3E2E29] sm:text-7xl";
const CTA_BANNER_CLASS =
  "rounded-2xl border border-[#4A413C]/15 bg-[#D8D3CC]/45 p-8 " +
  "shadow-[0_24px_70px_rgba(62,46,41,0.10)]";
const FOOTER_LAYOUT_CLASS =
  "flex flex-col gap-6 border-t border-[#4A413C]/15 pt-8 sm:flex-row " +
  "sm:items-end sm:justify-between";
const LOADING_HOME_CLASS =
  "mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center " +
  "justify-center";
const BADGE_CLASS =
  "rounded-full px-4 py-2 font-sans text-sm font-semibold text-[#FAF9F8]";

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
      Hey{firstName ? `, ${firstName}` : ""}
    </h1>
  );
}

function EmptyStateCard() {
  return (
    <section className={EMPTY_STATE_CARD_CLASS}>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-6 text-center">
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
        <PrimaryLink href="/capture">Scan item</PrimaryLink>
      </div>
    </section>
  );
}

function HomeDashboard() {
  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col gap-10">
        <HomeTopBar />

        <section className="flex flex-1 flex-col justify-center gap-10 py-8">
          <div className="space-y-4">
            <HomeGreeting />
            <p className="max-w-2xl text-lg leading-8 text-[#4A413C]">
              A quiet place to check whether a piece belongs with the style you
              are building.
            </p>
          </div>

          <EmptyStateCard />
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

function LandingPreview() {
  return (
    <div className={LANDING_PREVIEW_CLASS}>
      <div className={LANDING_PREVIEW_WASH_CLASS} />
      <div className="relative grid h-full gap-4">
        <div className="overflow-hidden rounded-2xl border border-[#4A413C]/15 bg-[#FAF9F8]">
          <div className="grid aspect-[4/3] grid-cols-[0.8fr_1.2fr]">
            <div className="bg-[#8A9A7B]" />
            <div className="grid grid-rows-[1.1fr_0.9fr]">
              <div className="bg-[#3E2E29]" />
              <div className="bg-[#C9A66B]" />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-[#4A413C]/15 bg-[#FAF9F8]/95 p-5">
          <div className="mb-4 flex gap-2">
            <span className={`${BADGE_CLASS} bg-[#8A9A7B]`}>Buy</span>
            <span className={`${BADGE_CLASS} bg-[#C9A66B]`}>Maybe</span>
            <span className={`${BADGE_CLASS} bg-[#3E2E29]`}>Skip</span>
          </div>
          <p className="text-base leading-7 text-[#4A413C]">
            Navy works with your palette. Pair it with tan or white pieces for
            an easy repeat outfit.
          </p>
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  const currentYear = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <nav className={LANDING_NAV_CLASS}>
        <Link
          className="font-serif text-4xl font-semibold tracking-normal text-[#3E2E29]"
          href="/"
        >
          Preeve
        </Link>
        <Link className="auth-back-link" href="/sign-in">
          Sign in
        </Link>
      </nav>

      <section className={`${LANDING_SECTION_CLASS} pb-20 pt-12`}>
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.78fr]">
          <div className="space-y-8">
            <div className="space-y-5">
              <h1 className={HERO_HEADLINE_CLASS}>Preeve it before you buy it.</h1>
              <p className="max-w-xl text-xl leading-9 text-[#4A413C]">
                Snap a pic, get the verdict, skip the regret.
              </p>
            </div>
            <EmailSignupForm />
          </div>

          <LandingPreview />
        </div>
      </section>

      <section className={`${LANDING_SECTION_CLASS} py-16`}>
        <div className="mb-8 space-y-3">
          <h2 className="font-serif text-5xl font-semibold tracking-normal text-[#3E2E29]">
            How it works
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map((step, index) => (
            <article className={LANDING_CARD_CLASS} key={step.title}>
              <p className="mb-6 font-sans text-sm font-semibold text-[#4A413C]">
                0{index + 1}
              </p>
              <h3 className="font-serif text-4xl font-semibold tracking-normal text-[#3E2E29]">
                {step.title}
              </h3>
              <p className="mt-4 text-base leading-7 text-[#4A413C]">
                {step.copy}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${LANDING_SECTION_CLASS} py-16`}>
        <h2 className="mb-8 font-serif text-5xl font-semibold tracking-normal text-[#3E2E29]">
          FAQ
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {FAQ_ITEMS.map((item) => (
            <article className={LANDING_CARD_CLASS} key={item.question}>
              <h3 className="font-sans text-base font-semibold text-[#3E2E29]">
                {item.question}
              </h3>
              <p className="mt-3 text-base leading-7 text-[#4A413C]">
                {item.answer}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${LANDING_SECTION_CLASS} py-16`}>
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

      <footer className={`${LANDING_SECTION_CLASS} py-10`}>
        <div className={FOOTER_LAYOUT_CLASS}>
          <div className="space-y-2">
            <p className="font-serif text-4xl font-semibold tracking-normal text-[#3E2E29]">
              Preeve
            </p>
            <p className="text-base text-[#4A413C]">
              Snap a pic, get the verdict, skip the regret.
            </p>
            <p className="font-sans text-sm text-[#4A413C]">
              {currentYear} Preeve
            </p>
          </div>

          <div className="flex gap-4 font-sans text-sm font-semibold">
            <a
              className="text-[#4A413C] transition hover:text-[#3E2E29]"
              href="https://github.com/justenhilliard/preeve"
              rel="noreferrer"
              target="_blank"
            >
              GitHub
            </a>
            <a
              className="text-[#4A413C] transition hover:text-[#3E2E29]"
              href="mailto:justenkhilliard@gmail.com"
            >
              Contact
            </a>
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
