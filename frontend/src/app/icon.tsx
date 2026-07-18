import { ImageResponse } from "next/og";

const ICON_SIZES = {
  "192": { width: 192, height: 192 },
  "512": { width: 512, height: 512 },
} as const;

type IconSizeId = keyof typeof ICON_SIZES;

function isIconSizeId(value: string | number): value is IconSizeId {
  return value === "192" || value === "512";
}

export function generateImageMetadata() {
  return Object.entries(ICON_SIZES).map(([id, size]) => ({
    id,
    size,
    alt: "Preeve app icon",
    contentType: "image/png",
  }));
}

export default async function Icon({
  id,
}: Readonly<{ id: Promise<string | number> }>) {
  const resolvedId = await id;
  const size = isIconSizeId(resolvedId) ? ICON_SIZES[resolvedId] : ICON_SIZES["512"];
  const fontSize = Math.round(size.width * 0.56);

  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#9d583f",
          color: "#faf9f8",
          display: "flex",
          fontFamily: "Georgia, Times New Roman, serif",
          fontSize,
          fontWeight: 700,
          height: "100%",
          justifyContent: "center",
          letterSpacing: "-0.02em",
          lineHeight: 1,
          width: "100%",
        }}
      >
        P
      </div>
    ),
    size,
  );
}
