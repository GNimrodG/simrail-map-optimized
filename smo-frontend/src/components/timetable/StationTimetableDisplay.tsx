import Box from "@mui/joy/Box";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import { styled } from "@mui/joy/styles";
import Table from "@mui/joy/Table";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useMap } from "react-leaflet";
import { filter } from "rxjs";

import useSubject from "../../hooks/useSubject";
import { dataProvider } from "../../utils/data-manager";
import { findStationForSignal } from "../../utils/geom-utils";
import SelectedTrainContext from "../../utils/selected-train-context";
import { timeSubj$ } from "../../utils/time";
import { SimplifiedTimtableEntry, Train } from "../../utils/types";
import { getColorTrainMarker } from "../../utils/ui";
import ArrowDownIcon from "../icons/arrow-down-solid.svg?react";
import InfoIcon from "../icons/InfoIcon";
import MapMarkerIcon from "../icons/map-location-dot-solid.svg?react";
import TrainMarkerPopup from "../markers/train/TrainMarkerPopup";
import DelayDisplay from "../utils/DelayDisplay";
import StopTypeDisplay from "../utils/StopTypeDisplay";
import TimeDiffDisplay from "../utils/TimeDiffDisplay";
import TimeDisplay from "../utils/TimeDisplay";
import TrainTypeDisplay from "../utils/TrainTypeDisplay";
import TrainTimetableModal from "./TrainTimetableModal";

export interface StationTimetableDisplayProps {
  timetable: SimplifiedTimtableEntry[];
  onClose?: () => void;
}

const BUFFER_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds

function isPastStation(entry: SimplifiedTimtableEntry, currentTime: Date): boolean {
  if (!entry.departureTime) return false;

  const departureTime = new Date(entry.departureTime);
  return departureTime < currentTime;
}

const timeSubjEvery10s$ = timeSubj$.pipe(filter((_, index) => index % 10 === 0));

const FlashingBox = styled(Box, { shouldForwardProp: (p) => p !== "shouldLeave" })<{
  shouldLeave: boolean;
}>(({ shouldLeave, theme }) => ({
  "animation": shouldLeave ? `pulse 1.5s infinite` : "none",
  // this is a fix for the animation getting stuck on the light theme if you toggle the theme

  "@keyframes pulse": {
    "0%,100%": {},
    "50%": {
      color: theme.palette.success.plainColor,
    },
  },

  "transition": "color 0.75s",
}));

const StationTimetableDisplay: FunctionComponent<StationTimetableDisplayProps> = ({ timetable, onClose }) => {
  const map = useMap();
  const { setSelectedTrain } = useContext(SelectedTrainContext);
  const { t } = useTranslation("translation", { keyPrefix: "TrainTimetable" });
  const currentTimeEpoch = useSubject(timeSubjEvery10s$, timeSubj$.value);
  const currentTimeBuffered = new Date(currentTimeEpoch - BUFFER_TIME);
  const currentTime = new Date(currentTimeEpoch);

  const relevantTimetable = timetable
    .filter((entry) => {
      // Always ignore entries without departure or arrival time
      if (!entry.departureTime && !entry.arrivalTime) return false;

      // Find the train in the data provider
      const train = dataProvider.trainsData$.value.find((x) => x.TrainNoLocal === entry.trainNoLocal);

      // If train exists in the system, check if it has passed this station
      if (train) {
        // If the train index is greater than this station's index, it means the train has passed
        return (
          train.TrainData.VDDelayedTimetableIndex <= entry.index ||
          entry?.subStationEntries?.some((subEntry) => train.TrainData.VDDelayedTimetableIndex <= subEntry.index)
        );
      }

      // For trains not in the system (not currently running), use the time-based filter
      const departureTime = new Date(entry.departureTime ?? entry.arrivalTime!);
      return departureTime >= currentTimeBuffered;
    })
    .toSorted((a, b) => {
      const aTime = new Date(a.departureTime ?? "").getTime();
      const bTime = new Date(b.departureTime ?? "").getTime();
      return aTime - bTime;
    })
    .slice(0, 100); // Limit to 100 entries

  const panToTrain = (train: Train) => {
    onClose?.();
    map?.panTo([train.TrainData.Latitude, train.TrainData.Longitude], {
      animate: true,
      duration: 1,
    });
    setSelectedTrain({ trainNo: train.TrainNoLocal, follow: true, paused: false });
  };

  return (
    <Sheet sx={{ overflow: "auto", width: "100%" }}>
      <Table
        size="sm"
        stickyHeader
        stickyFooter
        aria-label="sticky table"
        sx={{
          "& th:nth-of-type(1), & td:nth-of-type(1)": { width: 150 }, // Train No (has extra info text sometimes)
          "& th:nth-of-type(2), & td:nth-of-type(2)": { width: 60 }, // Type
          "& th:nth-of-type(3), & td:nth-of-type(3)": { width: 140 }, // From
          "& th:nth-of-type(4), & td:nth-of-type(4)": { width: 70 }, // Arrival
          "& th:nth-of-type(5), & td:nth-of-type(5)": { width: 190 }, // Departure
          "& th:nth-of-type(6), & td:nth-of-type(6)": { width: 120 }, // To
          "& th:nth-of-type(7), & td:nth-of-type(7)": { width: 40 }, // Line
          "& th:nth-of-type(8), & td:nth-of-type(8)": { width: 125 }, // Stop
        }}>
        <thead>
          <tr>
            <th>{t("TrainNo")}</th>
            <th>{t("Type")}</th>
            <th style={{ textAlign: "center" }}>{t("From")}</th>
            <th>{t("Arrival")}</th>
            <th>{t("Departure")}</th>
            <th style={{ textAlign: "center" }}>{t("To")}</th>
            <th>{t("Line")}</th>
            <th>{t("Stop")}</th>
          </tr>
        </thead>
        <tbody>
          {relevantTimetable.map((entry) => {
            const localStationNames = new Set([
              entry.stationName,
              ...(entry.subStationEntries?.map((subEntry) => subEntry.stationName) ?? []),
            ]);

            const train = dataProvider.trainsData$.value.find((x) => x.TrainNoLocal === entry.trainNoLocal);
            const trainDelays = train ? dataProvider.getDelaysForTrainSync(train.Id) : null;
            const lastDelay = Object.values(trainDelays ?? {}).slice(-1)[0] ?? null;
            const departureDelay = trainDelays?.[entry.index] ?? null;
            const passedBasedOnDepartureTime = isPastStation(entry, currentTime);
            const passedEarly = train && !passedBasedOnDepartureTime && departureDelay && departureDelay <= -60;

            const isInsideStation =
              !!train?.TrainData.SignalInFront &&
              localStationNames.has(findStationForSignal(train.TrainData.SignalInFront.split("@")[0])?.Name ?? "");

            const isCurrentStationTheNextStation = isTrainAtPrevStation(train, entry, trainDelays);
            const isPrevStationTheNextStation =
              !isCurrentStationTheNextStation &&
              train?.TrainData.VDDelayedTimetableIndex === entry.index - 1 &&
              !trainDelays?.[entry.index - 1];

            const past =
              !isInsideStation &&
              (departureDelay !== null ||
                (train && train.TrainData.VDDelayedTimetableIndex > entry.index) ||
                (!train && passedBasedOnDepartureTime));

            const delayed = !past && !isInsideStation && passedBasedOnDepartureTime && train;

            const prevStations = entry.previousStation?.includes(",\n")
              ? entry.previousStation.split(",\n")
              : [entry.previousStation || t("N/A")];

            const nextStations = entry.nextStation?.includes(",\n")
              ? entry.nextStation.split(",\n")
              : [entry.nextStation || t("N/A")];

            const shouldLeave = isInsideStation && passedBasedOnDepartureTime;

            return (
              <FlashingBox
                key={entry.trainNoLocal}
                component="tr"
                shouldLeave={shouldLeave}
                sx={{
                  color: past
                    ? passedEarly
                      ? "success.solidBg"
                      : "neutral.plainDisabledColor"
                    : isInsideStation
                      ? "primary.solidHoverBg"
                      : delayed
                        ? "warning.plainColor"
                        : "",
                }}>
                {/* Train No */}
                <td>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Typography
                      fontFamily="monospace"
                      level="body-md"
                      variant="outlined"
                      color={train ? getColorTrainMarker(train.TrainData.Velocity) : "neutral"}>
                      {entry.trainNoLocal}
                    </Typography>
                    {train && (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Tooltip
                          variant="outlined"
                          describeChild
                          enterDelay={300}
                          title={<TrainMarkerPopup train={train} hideButtons />}
                          arrow>
                          <Stack
                            alignItems="center"
                            justifyContent="center"
                            sx={{
                              color: train.TrainData.ControlledBySteamID ? "success.plainColor" : "neutral.500",
                              cursor: "pointer",
                            }}>
                            <InfoIcon />
                          </Stack>
                        </Tooltip>
                        <Tooltip variant="outlined" describeChild title={t("PanToTrain")} arrow>
                          <Stack
                            alignItems="center"
                            justifyContent="center"
                            sx={{ cursor: "pointer" }}
                            onClick={() => panToTrain(train)}>
                            <MapMarkerIcon />
                          </Stack>
                        </Tooltip>
                      </Stack>
                    )}
                    {!train && (
                      <TrainTimetableModal
                        trainNoLocal={entry.trainNoLocal}
                        hideTimeUntil={past}
                        scrollToStation={entry.stationName}
                      />
                    )}
                    {passedEarly && (
                      <Typography level="body-sm" color="success">
                        {t("PassedEarly")}
                      </Typography>
                    )}
                    {delayed && (
                      <Typography level="body-sm" color="warning">
                        {t("Delayed")}
                      </Typography>
                    )}
                  </Stack>
                </td>
                {/* Type */}
                <td>
                  <Typography fontFamily="monospace" level="body-sm" sx={{ color: "inherit" }} component="div">
                    <TrainTypeDisplay type={entry.trainType} />
                  </Typography>
                </td>
                {/* From */}
                <td>
                  <Stack direction="column">
                    {prevStations.map((station, index) => (
                      <>
                        <Typography
                          key={station + index}
                          fontFamily="monospace"
                          level="body-sm"
                          textAlign="center"
                          sx={{ color: "inherit" }}>
                          {station || t("N/A")}
                        </Typography>
                        {index < prevStations.length - 1 && (
                          <Divider sx={{ width: "80%", margin: "0 auto" }}>
                            <ArrowDownIcon />
                          </Divider>
                        )}
                      </>
                    ))}
                  </Stack>
                </td>
                {/* Arrival */}
                <td>
                  <Typography fontFamily="monospace" level="body-sm" sx={{ color: "inherit" }}>
                    {entry.arrivalTime ? (
                      <TimeDisplay time={entry.arrivalTime} />
                    ) : entry.departureTime ? (
                      <TimeDisplay time={entry.departureTime} />
                    ) : (
                      t("N/A")
                    )}
                  </Typography>
                </td>
                {/* Departure */}
                <td>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {entry.departureTime ? (
                      <Typography
                        fontFamily="monospace"
                        level="body-sm"
                        sx={{ color: "inherit", fontWeight: passedBasedOnDepartureTime ? "bold" : "normal" }}>
                        <TimeDisplay time={entry.departureTime} />
                      </Typography>
                    ) : (
                      t("N/A")
                    )}

                    {entry.departureTime && (departureDelay || (!past && !!lastDelay)) && (
                      <DelayDisplay
                        delay={departureDelay ?? lastDelay}
                        scheduledDeparture={departureDelay ? entry.departureTime : null}
                        translationKey={!departureDelay ? "LastDelay" : undefined}
                        alwaysShowTime
                      />
                    )}

                    {isPrevStationTheNextStation && (
                      <Tooltip
                        arrow
                        variant="outlined"
                        title={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <InfoIcon />
                            <Typography>
                              {t("PrevStationIsNext.Full", {
                                stationName: entry.previousStation,
                              })}
                            </Typography>
                          </Stack>
                        }>
                        <Typography fontFamily="monospace" level="body-sm" color="neutral" variant="outlined">
                          {t("PrevStationIsNext.Short")}
                        </Typography>
                      </Tooltip>
                    )}
                    {!isInsideStation && isCurrentStationTheNextStation && (
                      <Tooltip
                        arrow
                        variant="outlined"
                        title={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <InfoIcon />
                            <Typography>
                              {t("CurrentStationIsNext.Full", { stationName: entry.stationName })}
                            </Typography>
                          </Stack>
                        }>
                        <Typography fontFamily="monospace" level="body-sm" color="success" variant="outlined">
                          {t("CurrentStationIsNext.Short")}
                        </Typography>
                      </Tooltip>
                    )}
                    {isInsideStation && (
                      <Tooltip
                        arrow
                        variant="outlined"
                        title={
                          <Stack direction="row" spacing={1} alignItems="center">
                            <InfoIcon />
                            <Typography>{t("InsideStation.Full", { stationName: entry.stationName })}</Typography>
                          </Stack>
                        }>
                        <Typography fontFamily="monospace" level="body-sm" color="primary" variant="outlined">
                          {t("InsideStation.Short")}
                        </Typography>
                      </Tooltip>
                    )}
                  </Stack>
                </td>
                {/* To */}
                <td>
                  <Stack direction="column">
                    {nextStations.map((station, index) => (
                      <>
                        <Typography
                          key={station + index}
                          fontFamily="monospace"
                          level="body-sm"
                          textAlign="center"
                          sx={{ color: "inherit" }}>
                          {station || t("N/A")}
                        </Typography>
                        {index < nextStations.length - 1 && (
                          <Divider sx={{ width: "80%", margin: "0 auto" }}>
                            <ArrowDownIcon />
                          </Divider>
                        )}
                      </>
                    ))}
                  </Stack>
                </td>
                {/* Line */}
                <td>
                  <Typography fontFamily="monospace" level="body-sm" sx={{ color: "inherit" }}>
                    <Stack>
                      {[entry.line, ...(entry.subStationEntries?.map((subEntry) => subEntry.line) ?? [])]
                        .filter((x, i, arr) => arr.indexOf(x) === i)
                        .map((line, index) => (
                          <span key={line + index}>{line}</span>
                        ))}
                    </Stack>
                  </Typography>
                </td>
                {/* Stop */}
                <td>
                  {entry.arrivalTime && entry.departureTime && (
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
                  )}

                  {entry.note && (
                    <Typography level="body-sm" sx={{ color: "neutral.500" }} fontFamily="monospace">
                      {entry.note}
                    </Typography>
                  )}
                </td>
              </FlashingBox>
            );
          })}
        </tbody>
      </Table>
    </Sheet>
  );
};

export default StationTimetableDisplay;
function isTrainAtPrevStation(
  train: Train | undefined,
  entry: SimplifiedTimtableEntry,
  trainDelays: Record<number, number> | null,
) {
  return (
    (train?.TrainData.VDDelayedTimetableIndex === entry.index && !trainDelays?.[entry.index]) ||
    (train?.TrainData.VDDelayedTimetableIndex === entry.index - 1 && !!trainDelays?.[entry.index - 1]) ||
    !!entry.subStationEntries?.some(
      (subEntry) => subEntry.index === entry.index && !trainDelays?.[subEntry.index] && !trainDelays?.[subEntry.index],
    ) ||
    !!entry.subStationEntries?.some(
      (subEntry) => subEntry.index === entry.index - 1 && !!trainDelays?.[subEntry.index - 1],
    )
  );
}
