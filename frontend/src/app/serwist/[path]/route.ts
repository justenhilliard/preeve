import { createSerwistRoute } from "@serwist/turbopack";

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    additionalPrecacheEntries: [
      { url: "/manifest.webmanifest", revision: "preeve-pwa-v1" },
      { url: "/icon/192", revision: "preeve-pwa-v1" },
      { url: "/icon/512", revision: "preeve-pwa-v1" },
      { url: "/apple-icon", revision: "preeve-pwa-v1" },
    ],
    swSrc: "src/app/sw.ts",
    useNativeEsbuild: true,
  });
