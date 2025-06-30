import Step, { stepClasses } from "@mui/joy/Step";
import Stepper from "@mui/joy/Stepper";
import { type FunctionComponent, useEffect, useRef } from "react";

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

        return (
          <Step
            key={`${i}-${x.PointId}`}
            completed={trainTimetableIndex > i}
            active={current}
            ref={current ? stepperRef : undefined}>
            <StationDisplay
              station={x}
              pastStation={trainTimetableIndex > i || !!delays[i]}
              mainStation={x.SupervisedBy === x.NameOfPoint}
              delay={delays[i]}
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
