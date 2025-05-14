import Box from "@mui/joy/Box";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Table from "@mui/joy/Table";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent } from "react";

import { dataProvider } from "../../utils/data-manager";
import { timeSubj$ } from "../../utils/time";
import { SimplifiedTimtableEntry } from "../../utils/types";
import useBehaviorSubj from "../../utils/use-behaviorSubj";
import InfoIcon from "../icons/InfoIcon";
import DelayDisplay from "../utils/DelayDisplay";
import StopTypeDisplay from "../utils/StopTypeDisplay";
import TimeDiffDisplay from "../utils/TimeDiffDisplay";
import TimeDisplay from "../utils/TimeDisplay";
import TrainTypeDisplay from "../utils/TrainTypeDisplay";
import TrainMarkerPopup from "./TrainMarkerPopup";

export interface StationTimetableDisplayProps {
  timetable: SimplifiedTimtableEntry[];
}

const BUFFER_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds

function isPastStation(entry: SimplifiedTimtableEntry, currentTime: Date): boolean {
  if (!entry.departureTime) return false;

  const departureTime = new Date(entry.departureTime);
  return departureTime < currentTime;
}

const StationTimetableDisplay: FunctionComponent<StationTimetableDisplayProps> = ({ timetable }) => {
  const currentTimeEpoch = useBehaviorSubj(timeSubj$);
  const currentTimeBuffered = new Date(currentTimeEpoch - BUFFER_TIME);
  const currentTime = new Date(currentTimeEpoch);

  const relevantTimetable = timetable
    .filter((entry) => {
      if (!entry.departureTime) return false;

      const departureTime = new Date(entry.departureTime);
      return departureTime >= currentTimeBuffered;
    })
    .toSorted((a, b) => {
      const aTime = new Date(a.departureTime ?? "").getTime();
      const bTime = new Date(b.departureTime ?? "").getTime();
      return aTime - bTime;
    })
    .slice(0, 100); // Limit to 100 entries

  return (
    <Sheet sx={{ overflow: "auto", width: "100%" }}>
      <Table
        size="sm"
        stickyHeader
        stickyFooter
        aria-label="sticky table"
        sx={{
          "& th:nth-child(1), & td:nth-child(1)": { width: 100 },
          "& th:nth-child(2), & td:nth-child(2)": { width: 60 },
          "& th:nth-child(3), & td:nth-child(3)": { width: 100 },
          "& th:nth-child(4), & td:nth-child(4)": { width: 180 },
          "& th:nth-child(5), & td:nth-child(5)": { width: 40 },
          "& th:nth-child(6), & td:nth-child(6)": { width: 130 },
        }}>
        <thead>
          <tr>
            <th>Train No</th>
            <th>Type</th>
            <th>Arrival</th>
            <th>Departure</th>
            <th>Line</th>
            <th>Stop</th>
          </tr>
        </thead>
        <tbody>
          {relevantTimetable.map((entry) => {
            const train = dataProvider.trainsData$.value.find((x) => x.TrainNoLocal === entry.trainNoLocal);
            const trainDelays = train ? dataProvider.getDelaysForTrainSync(train.Id) : null;
            const lastDelay = Object.values(trainDelays ?? {}).slice(-1)[0] ?? null;
            const departureDelay = trainDelays?.[entry.index] ?? null;
            const passedBasedOnDepartureTime = isPastStation(entry, currentTime);
            const past = (train && train.TrainData.VDDelayedTimetableIndex > entry.index) || passedBasedOnDepartureTime;
            const delayed = !past && train && train.TrainData.VDDelayedTimetableIndex > entry.index;
            const passedEarly = train && !passedBasedOnDepartureTime && departureDelay && departureDelay <= -60;

            return (
              <Box
                component="tr"
                key={entry.trainNoLocal}
                sx={{
                  color: past
                    ? passedEarly
                      ? "success.solidBg"
                      : "neutral.plainDisabledColor"
                    : delayed
                      ? "warning.plainColor"
                      : "",
                }}>
                <td>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography fontFamily="monospace" level="body-sm" sx={{ color: "inherit" }}>
                      {entry.trainNoLocal}
                    </Typography>
                    {train && (
                      <Tooltip
                        variant="outlined"
                        describeChild
                        enterDelay={500}
                        title={<TrainMarkerPopup train={train} hideButtons />}
                        arrow>
                        <Stack alignItems="center" justifyContent="center">
                          <InfoIcon />
                        </Stack>
                      </Tooltip>
                    )}
                    {passedEarly && <span>(Passed Early)</span>}
                    {delayed && <span>(Delayed)</span>}
                  </Stack>
                </td>
                <td>
                  <Typography fontFamily="monospace" level="body-sm" sx={{ color: "inherit" }} component="div">
                    <TrainTypeDisplay type={entry.trainType} />
                  </Typography>
                </td>
                <td>
                  <Typography fontFamily="monospace" level="body-sm" sx={{ color: "inherit" }}>
                    {entry.arrivalTime ? (
                      <TimeDisplay time={entry.arrivalTime} />
                    ) : entry.departureTime ? (
                      <TimeDisplay time={entry.departureTime} />
                    ) : (
                      "N/A"
                    )}
                  </Typography>
                </td>
                <td>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {entry.departureTime ? (
                      <Typography fontFamily="monospace" level="body-sm" sx={{ color: "inherit" }}>
                        <TimeDisplay time={entry.departureTime} />
                      </Typography>
                    ) : (
                      "N/A"
                    )}
                    {entry.departureTime && (
                      <DelayDisplay
                        delay={departureDelay ?? lastDelay}
                        scheduledDeparture={departureDelay ? entry.departureTime : null}
                        translationKey={!departureDelay ? "LastDelay" : undefined}
                      />
                    )}
                  </Stack>
                </td>
                <td>
                  <Typography fontFamily="monospace" level="body-sm" sx={{ color: "inherit" }}>
                    {entry.line}
                  </Typography>
                </td>
                <td>
                  <Box
                    sx={{
                      display: "inline-grid",
                      gridTemplateColumns: "1rem 4rem 2rem",
                      gap: 0.5,
                      alignItems: "center",
                    }}>
                    {entry.arrivalTime && entry.departureTime && (
                      <Typography sx={{ gridColumn: "1", color: "inherit" }} fontFamily="monospace" level="body-sm">
                        <TimeDiffDisplay start={entry.arrivalTime} end={entry.departureTime} />
                      </Typography>
                    )}
                    {entry.platform && entry.track !== null ? (
                      <Typography
                        sx={{ gridColumn: "2", color: "inherit" }}
                        fontFamily="monospace"
                        level="body-sm"
                        textAlign="center">
                        {entry.platform}/{entry.track}
                      </Typography>
                    ) : (
                      ""
                    )}
                    {entry.stopType && (
                      <Box sx={{ gridColumn: "3", display: "flex", justifyContent: "center" }}>
                        <StopTypeDisplay stopType={entry.stopType} />
                      </Box>
                    )}
                  </Box>
                </td>
              </Box>
            );
          })}
        </tbody>
      </Table>
    </Sheet>
  );
};

export default StationTimetableDisplay;
