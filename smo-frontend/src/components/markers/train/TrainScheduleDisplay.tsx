import Step, { stepClasses } from "@mui/joy/Step";
import Stepper from "@mui/joy/Stepper";
import { type FunctionComponent, useEffect, useRef } from "react";

import { Timetable } from "../../../utils/types";
import StationDisplay from "../station/StationDisplay";

export interface TrainScheduleDisplayProps {
  timetable: Timetable;
  delays: Record<number, number>;
  trainTimetableIndex: number;
}

const TrainScheduleDisplay: FunctionComponent<TrainScheduleDisplayProps> = ({
  timetable,
  delays,
  trainTimetableIndex,
}) => {
  const stepperRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (trainTimetableIndex > 0) {
      stepperRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [trainTimetableIndex]);

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
        const current = (trainTimetableIndex === i && !delays[i]) || (!!delays[i - 1] && trainTimetableIndex === i - 1);

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
            />
          </Step>
        );
      })}
    </Stepper>
  );
};

export default TrainScheduleDisplay;
