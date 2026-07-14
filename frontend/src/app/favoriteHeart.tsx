export const HEART_PATH =
  "M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 " +
  "7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z";

export function FavoriteHeart({
  isFavorited,
}: Readonly<{ isFavorited: boolean }>) {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5"
      fill={isFavorited ? "#B8674A" : "none"}
      stroke={isFavorited ? "#B8674A" : "#3E2E29"}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      <path d={HEART_PATH} />
    </svg>
  );
}
