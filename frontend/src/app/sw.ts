/// <reference lib="webworker" />

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  NetworkOnly,
  Serwist,
  StaleWhileRevalidate,
} from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const STATIC_ASSET_CACHE_SECONDS = 30 * 24 * 60 * 60;
const APP_SHELL_CACHE_SECONDS = 24 * 60 * 60;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ sameOrigin, url: { pathname } }) =>
        sameOrigin && pathname.startsWith("/api/"),
      handler: new NetworkOnly(),
    },
    {
      matcher: ({ request }) =>
        ["script", "style", "worker", "font", "image"].includes(
          request.destination,
        ),
      handler: new CacheFirst({
        cacheName: "preeve-static-assets",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 96,
            maxAgeSeconds: STATIC_ASSET_CACHE_SECONDS,
          }),
        ],
      }),
    },
    {
      matcher: ({ request, sameOrigin, url: { pathname } }) =>
        sameOrigin &&
        request.mode === "navigate" &&
        !pathname.startsWith("/api/"),
      handler: new NetworkFirst({
        cacheName: "preeve-app-shell",
        plugins: [
          new ExpirationPlugin({
            maxEntries: 24,
            maxAgeSeconds: APP_SHELL_CACHE_SECONDS,
          }),
        ],
      }),
    },
    {
      matcher: ({ sameOrigin, url: { pathname } }) =>
        sameOrigin &&
        ["/manifest.webmanifest", "/icon/192", "/icon/512", "/apple-icon"].includes(
          pathname,
        ),
      handler: new StaleWhileRevalidate({
        cacheName: "preeve-install-assets",
      }),
    },
  ],
});

serwist.addEventListeners();

export {};
