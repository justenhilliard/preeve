"use client";

import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  formatItemDisplayLabel,
  formatVisualAttribute,
  type VisualAttributes,
} from "../../../lib/itemLabel";
import { ApiRequestError, useAuthenticatedApi } from "../../apiClient";
import { FavoriteHeart } from "../../favoriteHeart";
import { PrimaryAction, PrimaryLink } from "../../preferences/components";
import { ThemeToggle } from "../../themeToggle";

type Verdict = "buy" | "maybe" | "skip";

type PairingSuggestion = {
  id: string;
  imageUrl: string | null;
  suggestionText: string;
};

type ScannedItemResponse = {
  classificationFailed?: boolean;
  closetInsight: string | null;
  correctedCategory: string | null;
  correctedColor: string | null;
  detectedCategory: string | null;
  detectedColor: string | null;
  fitStylingNote: string | null;
  id: string;
  isFavorited: boolean;
  pairingSuggestions: PairingSuggestion[];
  photoUrl: string;
  rationale: string | null;
  savedToWardrobe: boolean;
  visualAttributes: VisualAttributes | null;
  verdict: Verdict | null;
  createdAt: string;
};

type SaveItemResponse = {
  id: string;
  savedToWardrobe: boolean;
};

type FavoriteItemResponse = {
  id: string;
  isFavorited: boolean;
};

const PREVIEW_FRAME_CLASS =
  "overflow-hidden rounded-2xl border border-[var(--color-text-muted)]/15 " +
  "bg-[var(--color-surface)]/45 shadow-[0_24px_70px_rgba(62,46,41,0.10)]";
const RESULT_PANEL_CLASS =
  "rounded-2xl border border-[var(--color-text-muted)]/15 bg-[var(--color-surface)]/45 p-8 " +
  "shadow-[0_24px_70px_rgba(62,46,41,0.10)]";
const SPINNER_CLASS =
  "h-9 w-9 animate-spin rounded-full border-[3px] border-[var(--color-text-muted)]/15 " +
  "border-t-[var(--color-accent)]";
const DISCARD_BUTTON_CLASS =
  "rounded-md border border-[var(--color-text-muted)]/20 px-6 py-3 font-sans text-sm " +
  "font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-surface)]/45";
const DELETE_BUTTON_CLASS =
  "rounded-md border border-[var(--color-accent)]/45 px-6 py-3 font-sans text-sm " +
  "font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-accent)]/10";
const OVERRIDE_BUTTON_CLASS =
  "w-fit rounded-full border border-[var(--color-text-muted)]/20 px-4 py-2 font-sans " +
  "text-sm font-semibold text-[var(--color-text)] transition hover:bg-[var(--color-bg)]/70";
const FAVORITE_BUTTON_CLASS =
  "flex h-11 w-11 items-center justify-center rounded-full border " +
  "border-[var(--color-text-muted)]/15 bg-[var(--color-bg)]/85 " +
  "text-[var(--color-text)] transition hover:bg-[var(--color-surface)]";
const PAIRING_CARD_CLASS =
  "overflow-hidden rounded-2xl border border-[var(--color-text-muted)]/15 bg-[var(--color-bg)] " +
  "shadow-[0_10px_28px_rgba(62,46,41,0.08)]";
const PAIRING_EMPTY_CLASS =
  "rounded-xl border border-[var(--color-text-muted)]/15 bg-[var(--color-bg)]/70 px-4 py-3 " +
  "text-sm leading-6 text-[var(--color-text-muted)]";
const SECTION_LABEL_CLASS =
  "font-sans text-sm font-semibold uppercase tracking-[0.14em] text-[var(--color-text-muted)]";
const RESULT_HEADING_CLASS =
  "font-serif text-5xl font-semibold tracking-normal text-[var(--color-text)]";
const VERDICT_BADGE_CLASS =
  "inline-flex rounded-full px-5 py-2 font-sans text-sm font-semibold";
const VERDICT_STYLES: Record<Verdict, string> = {
  buy: "bg-[var(--color-sage-badge)] text-[var(--color-on-dark)]",
  maybe: "bg-[var(--color-ochre-badge)] text-[var(--color-on-dark)]",
  skip: "bg-[var(--color-accent-dark)] text-[var(--color-on-dark)]",
};

function getRouteItemId(itemIdParam: string | string[] | undefined) {
  return Array.isArray(itemIdParam) ? itemIdParam[0] : itemIdParam;
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

function formatScannedItemAlt(item: ScannedItemResponse) {
  return formatItemDisplayLabel(item);
}

function PatternDetailLine({
  pattern,
}: Readonly<{ pattern: string | null | undefined }>) {
  if (!pattern) {
    return null;
  }

  return (
    <p className="font-sans text-sm font-medium text-[var(--color-text-muted)]">
      <span className="font-semibold text-[var(--color-text)]">Pattern:</span>{" "}
      {formatVisualAttribute(pattern)}
    </p>
  );
}

function FitStylingNoteLine({
  note,
}: Readonly<{ note: string | null }>) {
  if (!note) {
    return null;
  }

  return (
    <p className="text-base leading-7 text-[var(--color-text-muted)]">
      <span className="font-semibold text-[var(--color-text)]">Fit tip:</span>{" "}
      {note}
    </p>
  );
}

function formatPairingSuggestionAlt(suggestion: PairingSuggestion) {
  return `Suggested pairing: ${suggestion.suggestionText}`;
}

function PairingSuggestions({
  suggestions,
}: Readonly<{ suggestions: PairingSuggestion[] }>) {
  return (
    <section className="space-y-3">
      <h2 className={SECTION_LABEL_CLASS}>Styling idea</h2>

      {suggestions.length > 0 ? (
        <div className="grid gap-3">
          {suggestions.map((suggestion) => (
            <article className={PAIRING_CARD_CLASS} key={suggestion.id}>
              {suggestion.imageUrl ? (
                <div className="relative aspect-[16/9] w-full">
                  <Image
                    alt={formatPairingSuggestionAlt(suggestion)}
                    className="object-cover"
                    fill
                    sizes="(min-width: 1024px) 520px, 100vw"
                    src={suggestion.imageUrl}
                    unoptimized
                  />
                </div>
              ) : null}

              <p className="px-4 py-4 text-sm leading-6 text-[var(--color-text-muted)]">
                {suggestion.suggestionText}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <p className={PAIRING_EMPTY_CLASS}>
          No pairing suggestions yet for this combination.
        </p>
      )}
    </section>
  );
}

export default function ItemResultPage() {
  const authenticatedApi = useAuthenticatedApi();
  const params = useParams();
  const router = useRouter();
  const itemId = getRouteItemId(params.id);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [item, setItem] = useState<ScannedItemResponse | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchItem() {
      if (!itemId) {
        setErrorMessage("No item found with that ID for this user.");
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);

      try {
        const itemResponse = await authenticatedApi<ScannedItemResponse>(
          `/api/items/${itemId}`,
        );

        if (!isMounted) {
          return;
        }

        if (itemResponse.classificationFailed && itemResponse.verdict === null) {
          router.replace(`/items/${itemId}/correct`);
          return;
        }

        setItem(itemResponse);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message =
          error instanceof ApiRequestError && error.status === 404
            ? "No item found with that ID for this user."
            : error instanceof Error
              ? error.message
              : "Unable to load this item.";
        setErrorMessage(message);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void fetchItem();

    return () => {
      isMounted = false;
    };
  }, [authenticatedApi, itemId, router]);

  async function saveToWardrobe() {
    if (!itemId || !item || item.savedToWardrobe || isSaving) {
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    try {
      const saveResponse = await authenticatedApi<SaveItemResponse>(
        `/api/items/${itemId}/save`,
        { method: "PATCH" },
      );
      setItem({
        ...item,
        savedToWardrobe: saveResponse.savedToWardrobe,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save this item.";
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleFavorite() {
    if (!itemId || !item || isFavoriting) {
      return;
    }

    setErrorMessage(null);
    setIsFavoriting(true);

    try {
      const favoriteResponse = await authenticatedApi<FavoriteItemResponse>(
        `/api/items/${itemId}/favorite`,
        {
          body: JSON.stringify({ isFavorited: !item.isFavorited }),
          method: "PATCH",
        },
      );
      setItem({
        ...item,
        isFavorited: favoriteResponse.isFavorited,
      });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to update favorite status.";
      setErrorMessage(message);
    } finally {
      setIsFavoriting(false);
    }
  }

  async function deleteCurrentItem() {
    if (!itemId || isDeleting) {
      return;
    }

    setErrorMessage(null);
    setIsDeleting(true);

    try {
      await authenticatedApi<void>(`/api/items/${itemId}`, {
        method: "DELETE",
      });
      router.push(item?.savedToWardrobe ? "/wardrobe" : "/");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to delete this item.";
      setErrorMessage(message);
      setIsDeleting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <button
            className="auth-back-link"
            onClick={() => {
              if (typeof window !== "undefined" && window.history.length > 1) {
                router.back();
              } else {
                router.push("/");
              }
            }}
            type="button"
          >
            Back
          </button>

          <ThemeToggle />
        </nav>

        <section className="flex flex-1 flex-col justify-center gap-8 py-10">
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-10" role="status">
              <span className={SPINNER_CLASS} />
              <span className="sr-only">Loading item...</span>
            </div>
          ) : item && item.verdict && item.rationale ? (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className={PREVIEW_FRAME_CLASS}>
                <div className="relative aspect-[3/4] w-full">
                  <Image
                    alt={formatScannedItemAlt(item)}
                    className="object-cover"
                    fill
                    sizes="(min-width: 1024px) 460px, 100vw"
                    src={item.photoUrl}
                    unoptimized
                  />
                </div>
              </div>

              <section className={RESULT_PANEL_CLASS}>
                <div className="flex h-full flex-col justify-between gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-4">
                        <h1 className={RESULT_HEADING_CLASS}>Your Analysis</h1>
                        <button
                          aria-label={
                            item.isFavorited
                              ? "Remove favorite"
                              : "Mark favorite"
                          }
                          className={FAVORITE_BUTTON_CLASS}
                          disabled={isFavoriting}
                          onClick={toggleFavorite}
                          type="button"
                        >
                          <FavoriteHeart isFavorited={item.isFavorited} />
                        </button>
                      </div>
                      <p
                        className={
                          "font-sans text-base font-semibold " +
                          "text-[var(--color-text-muted)]"
                        }
                      >
                        {formatItemDisplayLabel(item)}
                      </p>
                      <p className="font-sans text-sm font-medium text-[var(--color-text-muted)]">
                        Scanned {formatScanDate(item.createdAt)}
                      </p>
                      <PatternDetailLine
                        pattern={item.visualAttributes?.pattern}
                      />
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={SECTION_LABEL_CLASS}>Verdict</span>
                      <span
                        className={`${VERDICT_BADGE_CLASS} ${
                          VERDICT_STYLES[item.verdict]
                        }`}
                      >
                        {formatVerdict(item.verdict)}
                      </span>
                    </div>

                    <p className="text-lg leading-8 text-[var(--color-text-muted)]">
                      {item.rationale}
                    </p>
                    <FitStylingNoteLine note={item.fitStylingNote} />
                    {item.closetInsight ? (
                      <p className="text-base leading-7 text-[var(--color-text-muted)]">
                        {item.closetInsight}
                      </p>
                    ) : null}

                    <button
                      className={OVERRIDE_BUTTON_CLASS}
                      onClick={() => router.push(`/items/${item.id}/correct`)}
                      type="button"
                    >
                      This looks wrong
                    </button>

                    <PairingSuggestions suggestions={item.pairingSuggestions} />
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <PrimaryAction
                      disabled={item.savedToWardrobe || isSaving}
                      onClick={saveToWardrobe}
                    >
                      {item.savedToWardrobe ? "Saved" : "Save to wardrobe"}
                    </PrimaryAction>
                    {item.savedToWardrobe ? (
                      <PrimaryLink href="/wardrobe">View wardrobe</PrimaryLink>
                    ) : null}
                    {item.savedToWardrobe ? (
                      <button
                        className={DELETE_BUTTON_CLASS}
                        disabled={isDeleting}
                        onClick={() => {
                          if (confirmingDelete) {
                            void deleteCurrentItem();
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
                              : "Delete"}
                      </button>
                    ) : (
                      <button
                        className={DISCARD_BUTTON_CLASS}
                        disabled={isDeleting}
                        onClick={() => void deleteCurrentItem()}
                        type="button"
                      >
                        {isDeleting ? "Discarding..." : "Discard"}
                      </button>
                    )}
                  </div>
                  {confirmingDelete && item.savedToWardrobe ? (
                    <p className="font-sans text-sm text-[var(--color-text-muted)]">
                      Delete this item? This cannot be undone.
                    </p>
                  ) : null}
                </div>
              </section>
            </div>
          ) : (
            <p className="text-center font-sans text-sm text-[var(--color-text-muted)]">
              {errorMessage ?? "No item found with that ID for this user."}
            </p>
          )}

          {errorMessage && item ? (
            <p className="text-center font-sans text-sm text-[var(--color-text-muted)]">
              {errorMessage}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
