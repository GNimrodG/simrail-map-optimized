import moment, { type Moment } from "moment";
import { useEffect, useMemo, useState } from "react";

import { dataProvider } from "../utils/data-manager";
import useBehaviorSubj from "./useBehaviorSubj";

/**
 * Restart predictions are only shown when they are right at least this often (the backend's confidence is calibrated
 * on the real restart history).
 */
export const MIN_RESTART_CONFIDENCE = 0.9;

/**
 * The confident next restart predictions by server code.
 */
export function useServerRestarts(): Map<string, Moment> {
  const predictions = useBehaviorSubj(dataProvider.nextServerRestarts$);

  return useMemo(
    () =>
      new Map(
        predictions
          .filter((p) => p.NextProbableRestartTime && (p.Confidence ?? 0) >= MIN_RESTART_CONFIDENCE)
          .map((p) => [p.ServerCode, moment(p.NextProbableRestartTime)]),
      ),
    [predictions],
  );
}

/**
 * The current time, updated every `intervalMs`, so relative times ("in 5 minutes") stay current.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return now;
}
