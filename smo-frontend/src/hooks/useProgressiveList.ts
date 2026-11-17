import { useEffect, useState } from "react";

/**
 * How many new markers may be mounted per animation frame, shared by every layer. Creating a Leaflet marker and adding
 * its element to the map costs ~0.3 ms, and React commits a whole list at once: the first data (~500 markers) blocked
 * the page for ~190 ms in one task (Sentry SMO-AG). Splitting the commit is the only way to shorten it (a transition
 * only splits React's render, which was measured to change nothing).
 */
const MARKERS_PER_FRAME = 100;

type Grant = (count: number) => void;

const waiting = new Set<Grant>();
let frameRequested = false;

function distribute() {
  frameRequested = false;
  let budget = MARKERS_PER_FRAME;
  // round-robin, so every layer gets something on the screen early
  const share = Math.max(1, Math.ceil(budget / Math.max(1, waiting.size)));
  for (const grant of waiting) {
    if (budget <= 0) break;
    waiting.delete(grant);
    const count = Math.min(share, budget);
    budget -= count;
    grant(count);
  }
  if (waiting.size > 0) requestFrame();
}

function requestFrame() {
  if (frameRequested) return;
  frameRequested = true;
  // the next frame, or a timeout where no frames are drawn (an embedded view that is hidden but says it is visible)
  let timeout = 0;
  const frame = requestAnimationFrame(() => {
    clearTimeout(timeout);
    distribute();
  });
  timeout = window.setTimeout(() => {
    cancelAnimationFrame(frame);
    distribute();
  }, 50);
}

/**
 * The first items of the list, growing over the following frames until the whole list is shown, when the list grows by
 * a lot at once (the first data, zooming out). Updates of items already shown are not delayed: the list is only cut
 * after the number of items it showed before.
 */
function useProgressiveList<T>(items: T[]): T[] {
  // starts empty: even the first items come from the shared budget, one frame later
  const [limit, setLimit] = useState(0);
  const shown = Math.min(items.length, limit);

  // the list got a lot shorter (e.g. zoomed in): a later jump is spread out again, from the new size
  if (items.length + MARKERS_PER_FRAME < limit) {
    setLimit(items.length);
  }

  useEffect(() => {
    if (items.length <= limit) return;

    const grant: Grant = (count) => setLimit((l) => l + count);
    waiting.add(grant);
    requestFrame();
    return () => {
      waiting.delete(grant);
    };
  }, [items.length, limit]);

  return shown === items.length ? items : items.slice(0, shown);
}

export default useProgressiveList;
