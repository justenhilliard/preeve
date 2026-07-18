"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  formatItemDisplayLabel,
  formatVisualAttribute,
  type VisualAttributes,
} from "../../../../lib/itemLabel";
import { ApiRequestError, useAuthenticatedApi } from "../../../apiClient";
import { InlineError } from "../../../inlineError";
import {
  ColorSwatchButton,
  formatOptionLabel,
  OptionButton,
  PrimaryAction,
} from "../../../preferences/components";
import {
  COLOR_OPTIONS,
  COLOR_SWATCHES,
  type ColorOption,
} from "../../../preferences/preferencesContext";
import { ThemeToggle } from "../../../themeToggle";

const CATEGORY_OPTIONS = [
  "top",
  "bottom",
  "dress",
  "outerwear",
  "shoes",
  "accessory",
] as const;

type CategoryOption = (typeof CATEGORY_OPTIONS)[number];

type VerdictSignal = {
  matches: boolean;
  name: string;
};

type ScannedItemResponse = {
  closetInsight: string | null;
  correctedCategory: CategoryOption | null;
  correctedColor: ColorOption | null;
  detectedCategory: CategoryOption | null;
  detectedColor: ColorOption | null;
  fitStylingNote: string | null;
  id: string;
  photoUrl: string;
  visualAttributes: VisualAttributes | null;
  verdictSignals: VerdictSignal[];
};

type CorrectionPayload = {
  correctedCategory: CategoryOption;
  correctedColor: ColorOption;
};

const PREVIEW_FRAME_CLASS =
  "overflow-hidden rounded-2xl border border-[var(--color-text-muted)]/15 " +
  "bg-[var(--color-surface)]/45 shadow-[0_24px_70px_rgba(62,46,41,0.10)]";
const SPINNER_CLASS =
  "h-9 w-9 animate-spin rounded-full border-[3px] border-[var(--color-text-muted)]/15 " +
  "border-t-[var(--color-accent)]";

function getRouteItemId(itemIdParam: string | string[] | undefined) {
  return Array.isArray(itemIdParam) ? itemIdParam[0] : itemIdParam;
}

function getEffectiveAttribute<Value>(
  correctedValue: Value | null,
  detectedValue: Value | null,
) {
  return correctedValue ?? detectedValue;
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

function VerdictSignalChecklist({
  signals,
}: Readonly<{ signals: VerdictSignal[] }>) {
  if (signals.length === 0) {
    return null;
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {signals.map((signal) => (
        <li
          className={
            "inline-flex items-center gap-1.5 rounded-md border " +
            "border-[var(--color-text-muted)]/15 px-3 py-1.5 " +
            "font-sans text-xs font-semibold text-[var(--color-text-muted)]"
          }
          key={signal.name}
        >
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${
              signal.matches
                ? "bg-[var(--color-sage)]"
                : "bg-[var(--color-ochre)]"
            }`}
          />
          <span className="text-[var(--color-text)]">
            {formatVisualAttribute(signal.name)}:
          </span>{" "}
          {signal.matches ? "Matches" : "Needs attention"}
        </li>
      ))}
    </ul>
  );
}

export default function CorrectItemPage() {
  const authenticatedApi = useAuthenticatedApi();
  const params = useParams();
  const router = useRouter();
  const itemId = getRouteItemId(params.id);
  const [category, setCategory] = useState<CategoryOption | null>(null);
  const [color, setColor] = useState<ColorOption | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [item, setItem] = useState<ScannedItemResponse | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);

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

        setItem(itemResponse);
        setCategory(
          getEffectiveAttribute(
            itemResponse.correctedCategory,
            itemResponse.detectedCategory,
          ),
        );
        setColor(
          getEffectiveAttribute(
            itemResponse.correctedColor,
            itemResponse.detectedColor,
          ),
        );
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
  }, [authenticatedApi, itemId, loadAttempt]);

  async function submitCorrection() {
    if (!itemId || !category || !color || isSubmitting) {
      return;
    }

    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      await authenticatedApi<ScannedItemResponse>(`/api/items/${itemId}/correct`, {
        body: JSON.stringify({
          correctedCategory: category,
          correctedColor: color,
        } satisfies CorrectionPayload),
        method: "PATCH",
      });
      router.push(`/items/${itemId}`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to save this correction.";
      setErrorMessage(message);
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-4xl flex-col">
        <nav className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="auth-back-link">
            Back
          </Link>

          <ThemeToggle />
        </nav>

        <section className="flex flex-1 flex-col justify-center gap-8 py-10">
          <header className="space-y-4 text-center">
            <h1
              className={
                "font-serif text-5xl font-semibold tracking-normal " +
                "text-[var(--color-text)]"
              }
            >
              Tell us what it is
            </h1>
            <p className="mx-auto max-w-md text-base leading-7 text-[var(--color-text-muted)]">
              Pick one category and one color so Preeve can keep going.
            </p>
          </header>

          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-10" role="status">
              <span className={SPINNER_CLASS} />
              <span className="sr-only">Loading item...</span>
            </div>
          ) : item ? (
            <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className={PREVIEW_FRAME_CLASS}>
                <div className="relative aspect-[3/4] w-full">
                  <Image
                    alt={formatScannedItemAlt(item)}
                    className="object-cover"
                    fill
                    sizes="(min-width: 1024px) 380px, 100vw"
                    src={item.photoUrl}
                    unoptimized
                  />
                </div>
                <div className="space-y-2 px-4 py-4 text-center">
                  <p
                    className={
                      "font-sans text-sm font-semibold " +
                      "text-[var(--color-text-muted)]"
                    }
                  >
                    {formatItemDisplayLabel(item)}
                  </p>
                  <PatternDetailLine pattern={item.visualAttributes?.pattern} />
                </div>
              </div>

              <div className="space-y-8">
                <VerdictSignalChecklist signals={item.verdictSignals} />
                <FitStylingNoteLine note={item.fitStylingNote} />
                {item.closetInsight ? (
                  <p className="text-base leading-7 text-[var(--color-text-muted)]">
                    {item.closetInsight}
                  </p>
                ) : null}
                <section className="space-y-4">
                  <h2
                    className={
                      "font-serif text-3xl font-semibold tracking-normal " +
                      "text-[var(--color-text)]"
                    }
                  >
                    Category
                  </h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {CATEGORY_OPTIONS.map((categoryOption) => (
                      <OptionButton
                        isSelected={category === categoryOption}
                        key={categoryOption}
                        onClick={() => setCategory(categoryOption)}
                      >
                        {formatOptionLabel(categoryOption)}
                      </OptionButton>
                    ))}
                  </div>
                </section>

                <section className="space-y-4">
                  <h2
                    className={
                      "font-serif text-3xl font-semibold tracking-normal " +
                      "text-[var(--color-text)]"
                    }
                  >
                    Color
                  </h2>
                  <div className="grid grid-cols-3 gap-5 sm:grid-cols-4">
                    {COLOR_OPTIONS.map((colorOption) => (
                      <ColorSwatchButton
                        colorName={colorOption}
                        hex={COLOR_SWATCHES[colorOption]}
                        isSelected={color === colorOption}
                        key={colorOption}
                        onClick={() => setColor(colorOption)}
                      />
                    ))}
                  </div>
                </section>

                <div className="flex flex-col gap-3 sm:items-end">
                  <PrimaryAction
                    disabled={!category || !color || isSubmitting}
                    onClick={submitCorrection}
                  >
                    Save correction
                  </PrimaryAction>
                  {errorMessage ? (
                    <InlineError message={errorMessage} />
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <InlineError
              actionLabel="Retry"
              message={errorMessage ?? "No item found with that ID for this user."}
              onAction={() => setLoadAttempt((currentValue) => currentValue + 1)}
            />
          )}
        </section>
      </div>
    </main>
  );
}
