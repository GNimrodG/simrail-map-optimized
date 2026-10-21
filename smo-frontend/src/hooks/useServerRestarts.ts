import moment, { type Moment } from "moment";
import { useMemo } from "react";

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
