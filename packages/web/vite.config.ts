import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  define: {
    __BUILD_TIMESTAMP__: JSON.stringify(new Date().toISOString().replace("T", " ").slice(0, 19)),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Force service worker update by changing this version
      // when deploying breaking changes
      selfDestroying: false,
      includeAssets: [
        "favicon.png",
        "icon-192x192.svg",
        "icon-512x512.svg",
        "icons/*.png",
      ],
      manifest: {
        name: "CODE Mobile",
        short_name: "CODE",
        description: "Your AI-powered terminal, everywhere.",
        theme_color: "#08090d",
        background_color: "#08090d",
        display: "standalone",
        orientation: "any",
        start_url: "/",
        scope: "/",
        id: "/",
        categories: ["developer", "productivity"],
        prefer_related_applications: false,
        shortcuts: [
          {
            name: "New Session",
            url: "/sessions?new=true",
            description: "Start a new AI coding session",
          },
        ],
        icons: [
          { src: "/icons/icon-72.png", sizes: "72x72", type: "image/png" },
          { src: "/icons/icon-96.png", sizes: "96x96", type: "image/png" },
          { src: "/icons/icon-128.png", sizes: "128x128", type: "image/png" },
          { src: "/icons/icon-144.png", sizes: "144x144", type: "image/png" },
          { src: "/icons/icon-152.png", sizes: "152x152", type: "image/png" },
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/icon-192x192.svg", sizes: "any", type: "image/svg+xml" },
        ],
        screenshots: [
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            form_factor: "wide",
            label: "CODE Mobile Terminal",
          },
          {
            src: "/icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            form_factor: "narrow",
            label: "CODE Mobile Terminal",
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ["**/*.{js,css,html,svg,woff2,png,ico}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/ws/, /^\/internal\//],
        runtimeCaching: [
          {
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
  build: {
    target: "esnext",
    rollupOptions: {
      output: {
        manualChunks: {
          "xterm": ["@xterm/xterm", "@xterm/addon-fit", "@xterm/addon-web-links"],
          "xterm-webgl": ["@xterm/addon-webgl"],
          "framer": ["framer-motion"],
          "react-vendor": ["react", "react-dom", "react-router-dom"],
          "query": ["@tanstack/react-query"],
        },
      },
    },
  },
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
