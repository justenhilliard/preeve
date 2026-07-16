"use client";

import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery } from "@tanstack/react-query";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuthenticatedApi } from "../apiClient";
import { FavoriteHeart, HEART_PATH } from "../favoriteHeart";
import { formatOptionLabel, PrimaryLink } from "../preferences/components";
import { ThemeToggle } from "../themeToggle";

type Verdict = "buy" | "maybe" | "skip";

type VerdictFilter = Verdict | "all";

type WardrobeItem = {
  createdAt: string;
  detectedCategory: string | null;
  detectedColor: string | null;
  id: string;
  isFavorited: boolean;
  photoUrl: string;
  verdict: Verdict | null;
};

type WardrobeItemsResponse = {
  items: WardrobeItem[];
};

type FavoriteItemResponse = {
  id: string;
  isFavorited: boolean;
};

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/wardrobe", label: "Wardrobe" },
  { href: "/preferences/colors", label: "Preferences" },
  { href: "/settings", label: "Settings" },
];

const VERDICT_FILTERS: { label: string; value: VerdictFilter }[] = [
  { label: "All", value: "all" },
  { label: "Buy", value: "buy" },
  { label: "Maybe", value: "maybe" },
  { label: "Skip", value: "skip" },
];

const TOP_BAR_CLASS =
  "flex flex-col gap-6 border-b border-[var(--color-text-muted)]/15 pb-6 sm:flex-row " +
  "sm:items-center sm:justify-between";
const CHIP_BASE_CLASS =
  "rounded-full px-4 py-2 font-sans text-sm font-semibold transition";
const CARD_CLASS =
  "group relative overflow-hidden rounded-2xl border border-[var(--color-text-muted)]/15 " +
  "bg-[var(--color-surface)]/45 shadow-[0_18px_48px_rgba(62,46,41,0.10)]";
const HANG_TAG_CLASS =
  "absolute bottom-3 left-3 rounded-xl border border-[var(--color-text-muted)]/15 " +
  "bg-[var(--color-bg)]/95 px-3 py-2 font-sans text-xs font-semibold " +
  "text-[var(--color-text)] shadow-[0_8px_20px_rgba(62,46,41,0.14)]";
const FAVORITE_BUTTON_CLASS =
  "absolute right-3 top-3 flex h-11 w-11 items-center justify-center " +
  "rounded-full border border-[var(--color-text-muted)]/15 bg-[var(--color-bg)]/95 " +
  "text-[var(--color-text)] shadow-[0_8px_20px_rgba(62,46,41,0.14)] transition " +
  "hover:bg-[var(--color-surface)]";
const EMPTY_STATE_CLASS =
  "rounded-2xl border border-[var(--color-text-muted)]/15 " +
  "bg-[var(--color-surface)]/45 p-8 text-center " +
  "shadow-[0_24px_70px_rgba(62,46,41,0.10)]";
const CLEAR_FILTERS_BUTTON_CLASS =
  "rounded-md bg-[var(--color-accent)] px-6 py-3 font-sans text-sm font-semibold " +
  "text-[var(--color-on-dark)] transition hover:bg-[var(--color-accent-hover)]";
const PAGE_HEADING_CLASS =
  "font-serif text-5xl font-semibold tracking-normal text-[var(--color-text)] " +
  "sm:text-6xl";
const SPINNER_CLASS =
  "h-9 w-9 animate-spin rounded-full border-[3px] border-[var(--color-text-muted)]/15 " +
  "border-t-[var(--color-accent)]";
const VERDICT_BADGE_CLASS =
  "inline-flex rounded-full px-3 py-1 font-sans text-xs font-semibold";
const VERDICT_STYLES: Record<Verdict, string> = {
  buy: "bg-[var(--color-sage)] text-[var(--color-on-dark)]",
  maybe: "bg-[var(--color-ochre)] text-[var(--color-on-dark)]",
  skip: "bg-[var(--color-accent-dark)] text-[var(--color-on-dark)]",
};
function WardrobeTopBar() {
  return (
    <nav className={TOP_BAR_CLASS}>
      <Link
        className="font-serif text-4xl font-semibold tracking-normal text-[var(--color-text)]"
        href="/"
      >
        Preeve
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/wardrobe";

          return (
            <Link
              className={`rounded-full px-4 py-2 font-sans text-sm font-semibold transition ${
                isActive
                  ? "bg-[var(--color-accent)] text-[var(--color-on-dark)]"
                  : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface)]/45"
              }`}
              href={item.href}
              key={item.href}
            >
              {item.label}
            </Link>
          );
        })}
        <ThemeToggle />
      </div>
    </nav>
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

function WardrobeCard({
  item,
  onToggleFavorite,
}: Readonly<{
  item: WardrobeItem;
  onToggleFavorite: (item: WardrobeItem) => void;
}>) {
  return (
    <article className={CARD_CLASS}>
      <Link aria-label={`Open ${formatCategoryColor(item)}`} href={`/items/${item.id}`}>
        <div className="relative aspect-[3/4] w-full">
          <Image
            alt={formatCategoryColor(item)}
            className="object-cover transition duration-300 group-hover:scale-[1.03]"
            fill
            sizes="(min-width: 1024px) 300px, (min-width: 640px) 45vw, 100vw"
            src={item.photoUrl}
            unoptimized
          />
          <span className={HANG_TAG_CLASS}>{formatCategoryColor(item)}</span>
        </div>

        <div className="flex items-center justify-end px-4 py-4">
          {item.verdict ? (
            <span className={`${VERDICT_BADGE_CLASS} ${VERDICT_STYLES[item.verdict]}`}>
              {formatVerdict(item.verdict)}
            </span>
          ) : (
            <span className="font-sans text-sm font-semibold text-[var(--color-text-muted)]">
              No verdict
            </span>
          )}
        </div>
      </Link>

      <button
        aria-label={item.isFavorited ? "Remove favorite" : "Mark favorite"}
        className={FAVORITE_BUTTON_CLASS}
        onClick={() => onToggleFavorite(item)}
        type="button"
      >
        <FavoriteHeart isFavorited={item.isFavorited} />
      </button>
    </article>
  );
}

function EmptyWardrobeState() {
  return (
    <section className={EMPTY_STATE_CLASS}>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5">
        <h2 className="font-serif text-4xl font-semibold tracking-normal text-[var(--color-text)]">
          Your saved pieces will land here.
        </h2>
        <p className="max-w-md text-base leading-7 text-[var(--color-text-muted)]">
          Scan an item, save the verdict, and build a wardrobe log you can
          revisit while shopping.
        </p>
        <PrimaryLink href="/capture">Scan item</PrimaryLink>
      </div>
    </section>
  );
}

function EmptyFilterState({
  onClearFilters,
}: Readonly<{ onClearFilters: () => void }>) {
  return (
    <section className={EMPTY_STATE_CLASS}>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-5">
        <h2 className="font-serif text-4xl font-semibold tracking-normal text-[var(--color-text)]">
          No pieces match those filters.
        </h2>
        <p className="max-w-md text-base leading-7 text-[var(--color-text-muted)]">
          Clear the current filter combination to see the saved items in your
          wardrobe.
        </p>
        <button
          className={CLEAR_FILTERS_BUTTON_CLASS}
          onClick={onClearFilters}
          type="button"
        >
          Clear filters
        </button>
      </div>
    </section>
  );
}

export default function WardrobePage() {
  const authenticatedApi = useAuthenticatedApi();
  const { isLoaded, isSignedIn } = useAuth();
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const [itemsOverride, setItemsOverride] = useState<WardrobeItem[] | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [verdictFilter, setVerdictFilter] = useState<VerdictFilter>("all");

  const wardrobeQuery = useQuery({
    enabled: isLoaded && Boolean(isSignedIn),
    queryKey: ["wardrobeItems"],
    queryFn: () => authenticatedApi<WardrobeItemsResponse>("/api/items"),
  });

  const favoriteMutation = useMutation({
    mutationFn: (item: WardrobeItem) =>
      authenticatedApi<FavoriteItemResponse>(`/api/items/${item.id}/favorite`, {
        body: JSON.stringify({ isFavorited: !item.isFavorited }),
        method: "PATCH",
      }),
    onSuccess: (favoriteResponse) => {
      setFavoriteError(null);
      setItemsOverride((currentItems) =>
        (currentItems ?? wardrobeQuery.data?.items ?? []).map((item) =>
          item.id === favoriteResponse.id
            ? { ...item, isFavorited: favoriteResponse.isFavorited }
            : item,
        ),
      );
    },
    onError: (error) => {
      setFavoriteError(
        error instanceof Error
          ? error.message
          : "Unable to update favorite status.",
      );
    },
  });

  const fetchedItems = wardrobeQuery.data?.items;
  const wardrobeItems = useMemo(
    () => itemsOverride ?? fetchedItems ?? [],
    [fetchedItems, itemsOverride],
  );
  const filteredItems = useMemo(
    () =>
      wardrobeItems.filter((item) => {
        const matchesVerdict =
          verdictFilter === "all" || item.verdict === verdictFilter;
        const matchesFavorite = !favoritesOnly || item.isFavorited;

        return matchesVerdict && matchesFavorite;
      }),
    [favoritesOnly, verdictFilter, wardrobeItems],
  );
  const hasActiveFilters = verdictFilter !== "all" || favoritesOnly;
  const queryErrorMessage =
    wardrobeQuery.error instanceof Error ? wardrobeQuery.error.message : null;

  function clearFilters() {
    setFavoritesOnly(false);
    setVerdictFilter("all");
  }

  return (
    <main className="relative min-h-screen bg-background px-6 py-8 text-foreground">
      <div aria-hidden="true" className="grain-overlay" />
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col gap-10">
        <WardrobeTopBar />

        <section className="flex flex-1 flex-col gap-8 py-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              <h1 className={PAGE_HEADING_CLASS}>Your Wardrobe</h1>
              <p className="max-w-2xl text-lg leading-8 text-[var(--color-text-muted)]">
                Saved decisions, ready for a second look.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                aria-pressed={favoritesOnly}
                className={`${CHIP_BASE_CLASS} inline-flex items-center gap-2 ${
                  favoritesOnly
                    ? "bg-[var(--color-accent)] text-[var(--color-on-dark)]"
                    : "bg-[var(--color-bg)] text-[var(--color-text-muted)] " +
                      "hover:bg-[var(--color-surface)]/45"
                }`}
                onClick={() => setFavoritesOnly((currentValue) => !currentValue)}
                type="button"
              >
                <svg
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill={favoritesOnly ? "currentColor" : "none"}
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path d={HEART_PATH} />
                </svg>
                Favorites
              </button>

              {VERDICT_FILTERS.map((filter) => {
                const isActive = verdictFilter === filter.value;

                return (
                  <button
                    aria-pressed={isActive}
                    className={`${CHIP_BASE_CLASS} ${
                      isActive
                        ? "bg-[var(--color-accent)] text-[var(--color-on-dark)]"
                        : "bg-[var(--color-bg)] text-[var(--color-text-muted)] " +
                          "hover:bg-[var(--color-surface)]/45"
                    }`}
                    key={filter.value}
                    onClick={() => setVerdictFilter(filter.value)}
                    type="button"
                  >
                    {filter.label}
                  </button>
                );
              })}
            </div>
          </div>

          {wardrobeQuery.isLoading ? (
            <div className="flex flex-col items-center gap-3 py-10" role="status">
              <span className={SPINNER_CLASS} />
              <span className="sr-only">Loading wardrobe...</span>
            </div>
          ) : queryErrorMessage ? (
            <p className="text-center font-sans text-sm text-[var(--color-text-muted)]">
              {queryErrorMessage}
            </p>
          ) : wardrobeItems.length === 0 ? (
            <EmptyWardrobeState />
          ) : filteredItems.length === 0 && hasActiveFilters ? (
            <EmptyFilterState onClearFilters={clearFilters} />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <WardrobeCard
                  item={item}
                  key={item.id}
                  onToggleFavorite={(selectedItem) =>
                    favoriteMutation.mutate(selectedItem)
                  }
                />
              ))}
            </div>
          )}

          {favoriteError ? (
            <p className="text-center font-sans text-sm text-[var(--color-text-muted)]">
              {favoriteError}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
