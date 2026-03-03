import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: [
        "favicon.ico",
        "icon-192x192.svg",
        "icon-512x512.svg",
        "apple-touch-icon.png",
      ],
      manifest: {
        name: "CODE Mobile",
        short_name: "CODE",
        description: "Your AI-powered terminal, everywhere.",
        theme_color: "#1a1b26",
        background_color: "#1a1b26",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        categories: ["developer", "productivity"],
        shortcuts: [
          {
            name: "New Session",
            url: "/sessions?new=true",
            description: "Start a new AI coding session",
          },
        ],
        icons: [
          { src: "/icons/icon-72.svg", sizes: "72x72", type: "image/svg+xml" },
          { src: "/icons/icon-96.svg", sizes: "96x96", type: "image/svg+xml" },
          { src: "/icons/icon-128.svg", sizes: "128x128", type: "image/svg+xml" },
          { src: "/icons/icon-144.svg", sizes: "144x144", type: "image/svg+xml" },
          { src: "/icons/icon-152.svg", sizes: "152x152", type: "image/svg+xml" },
          { src: "/icons/icon-192.svg", sizes: "192x192", type: "image/svg+xml" },
          { src: "/icons/icon-384.svg", sizes: "384x384", type: "image/svg+xml" },
          { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml" },
          { src: "/icons/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
          { src: "/icon-192x192.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2,png,ico}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/ws/, /^\/internal\//],
        runtimeCaching: [
          {
            // API calls: NetworkFirst with 5s timeout
            urlPattern: /^.*\/api\/.*/i,
            handler: "NetworkFirst",
            options: {
              cacheName: "api-cache",
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 100, maxAgeSeconds: 300 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Static assets: CacheFirst with 30-day expiry
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|eot)$/i,
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3000",
        ws: true,
      },
    },
  },
});
