"use client";

import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { PrimaryLink } from "./preferences/components";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/wardrobe", label: "Wardrobe" },
  { href: "/preferences/colors", label: "Preferences" },
  { href: "/settings", label: "Settings" },
];

const TOP_BAR_CLASS =
  "flex flex-col gap-6 border-b border-[#4A413C]/15 pb-6 sm:flex-row " +
  "sm:items-center sm:justify-between";
const EMPTY_STATE_CARD_CLASS =
  "rounded-2xl border border-[#4A413C]/15 bg-[#D8D3CC]/45 p-8 " +
  "shadow-[0_24px_70px_rgba(62,46,41,0.10)]";

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

export default function Home() {
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
