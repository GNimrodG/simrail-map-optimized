import { type ComponentType, lazy, type LazyExoticComponent } from "react";

// After a deploy, an open tab may still reference chunks that no longer exist. Reload to get the new build
// instead of crashing. If we already reloaded recently, let the error through (ErrorFallback shows a dialog),
// so a chunk that is really missing can't cause a reload loop.
const PRELOAD_RELOAD_KEY = "vitePreloadErrorReloadAt";
const PRELOAD_RELOAD_COOLDOWN_MS = 30_000;

let reloadPending = false;

/** True once a reload for a new build has started: errors until the page unloads are side effects of it. */
export function isReloadingForNewBuild() {
  return reloadPending;
}

function onPreloadError(event: Event) {
  // several lazy chunks can fail at once: the first one starts the reload, the rest just wait for it
  if (reloadPending) {
    event.preventDefault();
    return;
  }

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

  reloadPending = true;
  event.preventDefault();
  globalThis.location.reload();
}

export function installChunkReloadHandler() {
  globalThis.addEventListener("vite:preloadError", onPreloadError);
}

/**
 * React.lazy for the app's own chunks. When the preload error handler cancels a failed import to reload the page,
 * Vite resolves the import to undefined, which React.lazy would turn into a "_result.default" crash; this keeps the
 * component suspended until the reload replaces the page instead.
 */
// same constraint as React.lazy
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyChunk<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
  return lazy(() =>
    factory().then((module: { default: T } | undefined) => module ?? new Promise<{ default: T }>(() => undefined)),
  );
}
