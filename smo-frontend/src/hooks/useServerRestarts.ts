import moment, { type Moment } from "moment";
import { useMemo } from "react";

import { dataProvider } from "../utils/data-manager";
import useBehaviorSubj from "./useBehaviorSubj";

/**
 * Scheduled restart times are shown only when the same slot happened this often in the server's history.
 */
export const MIN_RESTART_SCHEDULE_CONFIDENCE = 0.9;

/** The minimum chance that a predicted restart is the next actual restart before showing a warning. */
export const MIN_RESTART_WARNING_CONFIDENCE = 0.9;

/**
 * The reliable scheduled restart times by server code.
 */
export function useServerRestarts(): Map<string, Moment> {
  const predictions = useBehaviorSubj(dataProvider.nextServerRestarts$);

  return useMemo(
    () =>
      new Map(
        predictions
          .filter(
            (p) =>
              p.NextProbableRestartTime &&
              (p.ScheduleConfidence ?? p.Confidence ?? 0) >= MIN_RESTART_SCHEDULE_CONFIDENCE,
          )
          .map((p) => [p.ServerCode, moment(p.NextProbableRestartTime)]),
      ),
    [predictions],
  );
}

/**
 * The restart predictions that are reliable enough to warn about by server code.
 */
export function useServerRestartWarnings(): Map<string, Moment> {
  const predictions = useBehaviorSubj(dataProvider.nextServerRestarts$);

  return useMemo(
    () =>
      new Map(
        predictions
          .filter((p) => p.NextProbableRestartTime && (p.Confidence ?? 0) >= MIN_RESTART_WARNING_CONFIDENCE)
          .map((p) => [p.ServerCode, moment(p.NextProbableRestartTime)]),
      ),
    [predictions],
  );
}
