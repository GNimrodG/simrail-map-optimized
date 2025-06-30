import Box from "@mui/joy/Box";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import { type FunctionComponent } from "react";

import { useTrainTimetable } from "../../hooks/useTrainTimetable";
import CalendarIcon from "../markers/icons/calendar.svg?react";
import TrainScheduleDisplay from "../markers/train/TrainScheduleDisplay";

export interface TrainTimetableModalProps {
  trainNoLocal: string;
  hideTimeUntil?: boolean;
  scrollToStation?: string;
}

const TrainTimetableModal: FunctionComponent<TrainTimetableModalProps> = ({
  trainNoLocal,
  hideTimeUntil,
  scrollToStation,
}) => {
  const timetable = useTrainTimetable(trainNoLocal);

  if (!timetable?.TimetableEntries?.length) return null;

  const trainTimetableIndex = timetable.TimetableEntries.findIndex((entry) => entry.NameOfPoint === scrollToStation);

  return (
    <Tooltip
      variant="outlined"
      describeChild
      title={
        <Box sx={{ maxHeight: "min(400px, 60vh)", overflowY: "auto" }}>
          <TrainScheduleDisplay
            timetable={timetable}
            delays={[]}
            trainTimetableIndex={-1}
            highlightedStationIndex={trainTimetableIndex}
            hideTimeUntil={hideTimeUntil}
          />
        </Box>
      }
      arrow>
      <Stack alignItems="center" justifyContent="center">
        <CalendarIcon />
      </Stack>
    </Tooltip>
  );
};

export default TrainTimetableModal;
