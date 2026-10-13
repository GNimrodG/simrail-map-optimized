import "core-js/actual/array/to-sorted";
import "./i18n.ts";

import React from "react";
import ReactDOM from "react-dom/client";

import App from "./App.tsx";

// After a deploy, an open tab may still reference chunks that no longer exist. Reload to get the new build
// instead of crashing. If we already reloaded recently, let the error through (ErrorFallback shows a dialog),
// so a chunk that is really missing can't cause a reload loop.
const PRELOAD_RELOAD_KEY = "vitePreloadErrorReloadAt";
const PRELOAD_RELOAD_COOLDOWN_MS = 30_000;

window.addEventListener("vite:preloadError", (event) => {
  let lastReloadAt = 0;
  try {
    lastReloadAt = Number(sessionStorage.getItem(PRELOAD_RELOAD_KEY)) || 0;
  } catch {
    // storage unavailable, reloading once is still fine
  }

  if (Date.now() - lastReloadAt < PRELOAD_RELOAD_COOLDOWN_MS) return;

  try {
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(Date.now()));
  } catch {
    // without storage there is no loop guard, so don't risk reloading
    return;
  }

  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
