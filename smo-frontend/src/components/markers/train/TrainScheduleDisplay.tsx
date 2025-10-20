import Step, { stepClasses } from "@mui/joy/Step";
import Stepper from "@mui/joy/Stepper";
import { type FunctionComponent, useEffect, useMemo, useRef } from "react";

import { calculateLastKnownDelay, calculatePredictedDelay } from "../../../utils/delay-prediction";
import { Timetable } from "../../../utils/types";
import StationDisplay from "../station/StationDisplay";

export interface TrainScheduleDisplayProps {
  timetable: Timetable;
  delays: Record<number, number>;
  trainTimetableIndex: number;

  highlightedStationIndex?: number;
  /**
   * Whether to hide the time until arrival.
   */
  hideTimeUntil?: boolean;
}

const TrainScheduleDisplay: FunctionComponent<TrainScheduleDisplayProps> = ({
  timetable,
  delays,
  trainTimetableIndex,
  highlightedStationIndex = trainTimetableIndex,
  hideTimeUntil,
}) => {
  const stepperRef = useRef<HTMLLIElement>(null);

  // Calculate the last known delay for prediction at upcoming stations
  const lastKnownDelay = useMemo(
    () => calculateLastKnownDelay(delays, trainTimetableIndex),
    [delays, trainTimetableIndex],
  );

  // Calculate predicted delay for a station accounting for layover times
  const getPredictedDelay = useMemo(
    () => (stationIndex: number) =>
      calculatePredictedDelay(stationIndex, lastKnownDelay, trainTimetableIndex, timetable),
    [lastKnownDelay, trainTimetableIndex, timetable],
  );

  useEffect(() => {
    if (highlightedStationIndex > 0) {
      stepperRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [highlightedStationIndex]);

  return (
    <Stepper
      sx={{
        width: "100%",
        [`& .${stepClasses.active}`]: {
          "--Step-indicatorDotSize": "0.6rem",
          [`& .${stepClasses.indicator}`]: {
            color: "var(--joy-palette-success-solidBg)",
          },
        },
        [`& .${stepClasses.completed}`]: {
          [`& .${stepClasses.indicator}`]: {
            color: "var(--joy-palette-success-solidDisabledColor)",
          },
        },
      }}
      orientation="vertical">
      {timetable.TimetableEntries.map((x, i) => {
        // This is the next station if:
        // 1. The train's next station is this station (highlightedStationIndex === i) and there is **no** delay registered at this station
        // 2. The train's next station is the previous station (highlightedStationIndex === i - 1) and there is a delay registered at the previous station
        const current =
          (highlightedStationIndex === i && !delays[i]) || (!!delays[i - 1] && highlightedStationIndex === i - 1);

        const isUpcomingStation = i > trainTimetableIndex && !delays[i];
        const isCurrentStation = i === trainTimetableIndex;

        // Use actual delay if available, otherwise use predicted delay for upcoming stations
        // For the current station, use its calculated delay if it's greater than the last known delay
        let stationDelay = delays[i];
        let isPredicted = false;

        if (stationDelay === undefined) {
          if (isCurrentStation || isUpcomingStation) {
            // Calculate predicted delay accounting for layover times (including current station)
            const predictedDelay = getPredictedDelay(i);
            if (predictedDelay !== null) {
              stationDelay = predictedDelay;
              isPredicted = true;
            }
          }
        } else if (isCurrentStation && lastKnownDelay !== null && stationDelay < lastKnownDelay) {
          // If current station's calculated delay is less than last known, use last known instead (predicted)
          stationDelay = lastKnownDelay;
          isPredicted = true;
        }

        // Only consider a station as "past" if it has an actual delay (not predicted)
        const isPastStation = trainTimetableIndex > i || (!!delays[i] && !isPredicted);

        return (
          <Step
            key={`${i}-${x.PointId}`}
            completed={trainTimetableIndex > i}
            active={current}
            ref={current ? stepperRef : undefined}>
            <StationDisplay
              station={x}
              pastStation={isPastStation}
              mainStation={x.SupervisedBy === x.NameOfPoint}
              delay={stationDelay}
              predictedDelay={isPredicted}
              current={current}
              hideTimeUntil={hideTimeUntil}
            />
          </Step>
        );
      })}
    </Stepper>
  );
};

export default TrainScheduleDisplay;
