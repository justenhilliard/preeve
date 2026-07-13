"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ApiRequestError, useAuthenticatedApi } from "../../apiClient";
import { PrimaryAction } from "../../preferences/components";

type Verdict = "buy" | "maybe" | "skip";

type ScannedItemResponse = {
  classificationFailed?: boolean;
  id: string;
  photoUrl: string;
  rationale: string | null;
  savedToWardrobe: boolean;
  verdict: Verdict | null;
};

type SaveItemResponse = {
  id: string;
  savedToWardrobe: boolean;
};

const PREVIEW_FRAME_CLASS =
  "overflow-hidden rounded-2xl border border-[#4A413C]/15 bg-[#D8D3CC]/45 " +
  "shadow-[0_24px_70px_rgba(62,46,41,0.10)]";
const RESULT_PANEL_CLASS =
  "rounded-2xl border border-[#4A413C]/15 bg-[#D8D3CC]/45 p-8 " +
  "shadow-[0_24px_70px_rgba(62,46,41,0.10)]";
const SPINNER_CLASS =
  "h-9 w-9 animate-spin rounded-full border-[3px] border-[#4A413C]/15 " +
  "border-t-[#B8674A]";
const DISCARD_BUTTON_CLASS =
  "rounded-xl border border-[#4A413C]/20 px-6 py-3 font-sans text-sm " +
  "font-semibold text-[#3E2E29] transition hover:bg-[#D8D3CC]/45";
const RESULT_HEADING_CLASS =
  "font-serif text-5xl font-semibold tracking-normal text-[#3E2E29]";
const VERDICT_BADGE_CLASS =
  "inline-flex rounded-full px-5 py-2 font-sans text-sm font-semibold";
const VERDICT_STYLES: Record<Verdict, string> = {
  buy: "bg-[#8A9A7B] text-[#FAF9F8]",
  maybe: "bg-[#C9A66B] text-[#FAF9F8]",
  skip: "bg-[#3E2E29] text-[#FAF9F8]",
};

function getRouteItemId(itemIdParam: string | string[] | undefined) {
  return Array.isArray(itemIdParam) ? itemIdParam[0] : itemIdParam;
}

function formatVerdict(verdict: Verdict) {
  return verdict.charAt(0).toUpperCase() + verdict.slice(1);
}

export default function ItemResultPage() {
  const authenticatedApi = useAuthenticatedApi();
  const params = useParams();
  const router = useRouter();
  const itemId = getRouteItemId(params.id);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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

  return (
    <main className="min-h-screen bg-background px-6 py-8 text-foreground">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col">
        <nav>
          <Link href="/" className="auth-back-link">
            Back
          </Link>
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
                    alt="Scanned item"
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
                    <span
                      className={`${VERDICT_BADGE_CLASS} ${
                        VERDICT_STYLES[item.verdict]
                      }`}
                    >
                      {formatVerdict(item.verdict)}
                    </span>

                    <div className="space-y-4">
                      <h1 className={RESULT_HEADING_CLASS}>Your verdict</h1>
                      <p className="text-lg leading-8 text-[#4A413C]">
                        {item.rationale}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <PrimaryAction
                      disabled={item.savedToWardrobe || isSaving}
                      onClick={saveToWardrobe}
                    >
                      {item.savedToWardrobe ? "Saved" : "Save to wardrobe"}
                    </PrimaryAction>
                    <button
                      className={DISCARD_BUTTON_CLASS}
                      onClick={() => router.push("/")}
                      type="button"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              </section>
            </div>
          ) : (
            <p className="text-center font-sans text-sm text-[#4A413C]">
              {errorMessage ?? "No item found with that ID for this user."}
            </p>
          )}

          {errorMessage && item ? (
            <p className="text-center font-sans text-sm text-[#4A413C]">
              {errorMessage}
            </p>
          ) : null}
        </section>
      </div>
    </main>
  );
}
