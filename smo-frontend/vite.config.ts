import { sentryVitePlugin } from "@sentry/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import svgr from "vite-plugin-svgr";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [["babel-plugin-react-compiler", { target: "18" }]],
      },
    }),
    sentryVitePlugin({
      org: "data-unknown",
      project: "smo",
    }),
    svgr(),
    VitePWA({
      registerType: "autoUpdate",
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
      },
      manifest: {
        name: "SMO",
        short_name: "SMO",
        categories: ["games", "utilities", "maps", "transportation"],
        description: "An optimized and feature rich online map for the game Simrail",
        background_color: "#0b0d0e",
        theme_color: "#185ea5",
      },
    }),
  ],

  build: {
    sourcemap: true,
  },
});
