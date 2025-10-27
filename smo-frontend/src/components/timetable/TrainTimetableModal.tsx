import Box from "@mui/joy/Box";
import CircularProgress from "@mui/joy/CircularProgress";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import { type FunctionComponent, useState } from "react";

import { dataProvider } from "../../utils/data-manager";
import type { Timetable } from "../../utils/types";
import CalendarIcon from "../markers/icons/calendar.svg?react";
import TrainScheduleDisplay from "../markers/train/TrainScheduleDisplay";

export interface TrainTimetableModalProps {
  trainNoLocal: string;
  hideTimeUntil?: boolean;
  scrollToStation?: string;
  delays?: number[];
  timetableIndex?: number;
}

const TrainTimetableModal: FunctionComponent<TrainTimetableModalProps> = ({
  trainNoLocal,
  hideTimeUntil,
  scrollToStation,
  delays,
  timetableIndex,
}) => {
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpen = () => {
    setIsOpen(true);
    if (!timetable && !isLoading) {
      setIsLoading(true);
      dataProvider
        .fetchTimetable(trainNoLocal)
        .then((data) => {
          setTimetable(data);
          setIsLoading(false);
        })
        .catch((e) => {
          console.error("Failed to fetch timetable: ", e);
          setIsLoading(false);
        });
    }
  };

  const trainTimetableIndex =
    timetable?.TimetableEntries && scrollToStation
      ? timetable.TimetableEntries.findIndex((entry) => entry.NameOfPoint === scrollToStation)
      : -1;

  return (
    <Tooltip
      variant="outlined"
      describeChild
      open={isOpen}
      onOpen={handleOpen}
      onClose={() => setIsOpen(false)}
      title={
        <Box sx={{ maxHeight: "min(400px, 60vh)", overflowY: "auto" }}>
          {isLoading || !timetable?.TimetableEntries?.length ? (
            <Stack alignItems="center" justifyContent="center" sx={{ p: 2 }}>
              <CircularProgress size="sm" />
            </Stack>
          ) : (
            <TrainScheduleDisplay
              timetable={timetable}
              delays={delays || []}
              trainTimetableIndex={timetableIndex ?? -1}
              highlightedStationIndex={timetableIndex ?? trainTimetableIndex}
              hideTimeUntil={hideTimeUntil}
            />
          )}
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
