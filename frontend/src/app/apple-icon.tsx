import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#9d583f",
          color: "#faf9f8",
          display: "flex",
          fontFamily: "Georgia, Times New Roman, serif",
          fontSize: 101,
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
