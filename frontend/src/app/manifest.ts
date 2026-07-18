import type { MetadataRoute } from "next";

const APP_DESCRIPTION =
  "Snap a photo of anything you're about to buy and get an instant " +
  "Buy, Maybe, or Skip verdict based on your wardrobe and style.";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Preeve",
    short_name: "Preeve",
    description: APP_DESCRIPTION,
    start_url: "/",
    display: "standalone",
    background_color: "#faf9f8",
    theme_color: "#9d583f",
    icons: [
      {
        src: "/icon/192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon/512",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
