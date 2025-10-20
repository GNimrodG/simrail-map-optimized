import { timeSubj$ } from "./time";
import { Timetable } from "./types";

/**
 * Calculate the last known delay for prediction at upcoming stations
 * @param delays - Record of delays indexed by station index
 * @param trainTimetableIndex - Current station index
 * @returns The most recent delay from past stations, or null if none
 */
export function calculateLastKnownDelay(delays: Record<number, number>, trainTimetableIndex: number): number | null {
  const delayEntries = Object.entries(delays)
    .map(([index, delay]) => ({ index: Number(index), delay }))
    .filter(({ index }) => index < trainTimetableIndex); // Only consider past stations (before current)

  if (delayEntries.length === 0) return null;

  // Get the most recent delay from past stations
  const sortedDelays = delayEntries.sort((a, b) => b.index - a.index);
  return sortedDelays[0].delay;
}

/**
 * Calculate predicted delay for a station accounting for layover times
 * @param stationIndex - Target station index
 * @param lastKnownDelay - Most recent known delay
 * @param trainTimetableIndex - Current station index
 * @param timetable - Train timetable with all entries
 * @returns Predicted delay in seconds, or null if cannot be calculated
 */
export function calculatePredictedDelay(
  stationIndex: number,
  lastKnownDelay: number | null,
  trainTimetableIndex: number,
  timetable: Timetable,
): number | null {
  if (stationIndex < trainTimetableIndex) {
    return null;
  }

  if (lastKnownDelay === null) {
    // check if the train should already be at the next station
    // if so, we can calculate the delay based on the arrival time
    const nextEntry = timetable.TimetableEntries[trainTimetableIndex];
    if (nextEntry?.ArrivalTime) {
      const arrivalTime = new Date(nextEntry.ArrivalTime).getTime();
      const currentTime = timeSubj$.value;
      if (currentTime < arrivalTime) {
        lastKnownDelay = 0;
      } else {
        lastKnownDelay = (arrivalTime - currentTime) / 1000;
      }
    } else {
      // No last known delay and no arrival time to infer from
      return null;
    }
  }

  let currentDelay = lastKnownDelay;

  // Process layover times from current station to the target station (inclusive)
  // This ensures we account for layovers at all stations including the target
  for (let i = trainTimetableIndex; i <= stationIndex; i++) {
    const entry = timetable.TimetableEntries[i];

    if (!entry) continue;

    if (entry.ArrivalTime && entry.DepartureTime) {
      const arrivalTime = new Date(entry.ArrivalTime).getTime();
      const departureTime = new Date(entry.DepartureTime).getTime();
      const layoverSeconds = (departureTime - arrivalTime) / 1000;

      if (layoverSeconds > 0) {
        // If train is early (negative delay) and there's a layover, reset to on-time
        // because the train would wait during the layover
        if (currentDelay < 0) {
          currentDelay = 0;
        } else {
          // For delayed trains, reduce the delay by the layover time
          // but never below 0 (can't make up more time than the delay)
          currentDelay = Math.max(currentDelay - layoverSeconds, 0);
        }
      }
    }
  }

  return currentDelay;
}
