"use client";

type InlineErrorProps = Readonly<{
  actionLabel?: string;
  message: string;
  onAction?: () => void;
}>;

const INLINE_ERROR_CLASS =
  "flex flex-col gap-3 rounded-xl border border-[var(--color-ochre-badge)]/35 " +
  "bg-[var(--color-ochre)]/15 px-4 py-3 text-left font-sans text-sm " +
  "text-[var(--color-text)] sm:flex-row sm:items-center sm:justify-between";
const INLINE_ERROR_MESSAGE_CLASS =
  "flex min-w-0 items-start gap-2 leading-6";
const INLINE_ERROR_ACTION_CLASS =
  "w-fit rounded-md bg-[var(--color-ochre-badge)] px-4 py-2 font-sans text-sm " +
  "font-semibold text-[var(--color-on-dark)] transition hover:brightness-105";

export function InlineError({
  actionLabel,
  message,
  onAction,
}: InlineErrorProps) {
  return (
    <div className={INLINE_ERROR_CLASS} role="alert">
      <p className={INLINE_ERROR_MESSAGE_CLASS}>
        <svg
          aria-hidden="true"
          className="mt-0.5 h-5 w-5 flex-shrink-0 text-[var(--color-ochre-badge)]"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        <span>{message}</span>
      </p>

      {actionLabel && onAction ? (
        <button
          className={INLINE_ERROR_ACTION_CLASS}
          onClick={onAction}
          type="button"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
