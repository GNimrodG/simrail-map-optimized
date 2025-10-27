import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import Stack from "@mui/joy/Stack";
import { styled } from "@mui/joy/styles";
import Table from "@mui/joy/Table";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { Fragment, type FunctionComponent } from "react";
import { useTranslation } from "react-i18next";

import { Timetable, Train } from "../../utils/types";
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

export interface EntryRenderState {
  entry: {
    trainNoLocal: string;
    index: number;
    trainType: string;
    departureTime: string | null;
    arrivalTime: string | null;
    stationName: string;
    previousStation: string | null;
    nextStation: string | null;
    line: number;
    platform: string | null;
    track: number | null;
    stopType: string | null;
    note?: string | null;
    subStationEntries?: Array<{
      index: number;
      stationName: string;
      line: number;
    }>;
  };
  train: Train | undefined;
  trainDelays: Record<number, number> | null;
  trainTimetable: Timetable | undefined;
  departureDelay: number | null;
  isPredictedDelay: boolean;
  lastDelay: number | null;
  passedBasedOnDepartureTime: boolean;
  passedEarly: boolean;
  isInsideStation: boolean;
  isCurrentStationTheNextStation: boolean;
  isPrevStationTheNextStation: boolean;
  past: boolean;
  delayed: boolean;
  prevStations: string[];
  nextStations: string[];
  filteredLines: number[];
  shouldLeave: boolean;
}

export interface StationTimetableTableViewProps {
  entryStates: EntryRenderState[];
  onPanToTrain: (train: Train) => void;
}

const FlashingRow = styled("tr", { shouldForwardProp: (p) => p !== "shouldLeave" })<{
  shouldLeave: boolean;
}>(({ shouldLeave, theme }) => ({
  "animation": shouldLeave ? `pulse 1.5s infinite` : "none",

  "@keyframes pulse": {
    "0%,100%": {},
    "50%": {
      color: theme.palette.success.plainColor,
    },
  },

  "transition": "color 0.75s",
}));

const StationTimetableTableView: FunctionComponent<StationTimetableTableViewProps> = ({
  entryStates,
  onPanToTrain,
}) => {
  const { t } = useTranslation("translation", { keyPrefix: "TrainTimetable" });

  return (
    <Table
      size="sm"
      stickyHeader
      stickyFooter
      aria-label="station timetable table"
      sx={{
        "& th:nth-of-type(1), & td:nth-of-type(1)": { width: 150 },
        "& th:nth-of-type(2), & td:nth-of-type(2)": { width: 60 },
        "& th:nth-of-type(3), & td:nth-of-type(3)": { width: 140 },
        "& th:nth-of-type(4), & td:nth-of-type(4)": { width: 70 },
        "& th:nth-of-type(5), & td:nth-of-type(5)": { width: 190 },
        "& th:nth-of-type(6), & td:nth-of-type(6)": { width: 120 },
        "& th:nth-of-type(7), & td:nth-of-type(7)": { width: 40 },
        "& th:nth-of-type(8), & td:nth-of-type(8)": { width: 125 },
        "& thead th": {
          bgcolor: "background.surface",
        },
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
        {entryStates.map((state) => {
          const {
            entry,
            train,
            departureDelay,
            isPredictedDelay,
            lastDelay,
            passedBasedOnDepartureTime,
            passedEarly,
            isInsideStation,
            isCurrentStationTheNextStation,
            isPrevStationTheNextStation,
            past,
            delayed,
            prevStations,
            nextStations,
            filteredLines,
            shouldLeave,
          } = state;

          const rowColor = past
            ? passedEarly
              ? "success.solidBg"
              : "neutral.plainDisabledColor"
            : isInsideStation
              ? "primary.solidHoverBg"
              : delayed
                ? "warning.plainColor"
                : undefined;

          const delayDisplay =
            entry.departureTime && (departureDelay !== null || (!past && !!lastDelay)) ? (
              <DelayDisplay
                delay={departureDelay ?? lastDelay}
                scheduledDeparture={
                  isPredictedDelay ? entry.departureTime : departureDelay ? entry.departureTime : null
                }
                alwaysShowTime
                isPredicted={isPredictedDelay}
              />
            ) : null;

          return (
            <FlashingRow
              key={`${entry.trainNoLocal}-${entry.index}`}
              shouldLeave={shouldLeave}
              sx={{ color: rowColor }}>
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
                  {train ? (
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
                          onClick={() => onPanToTrain(train)}>
                          <MapMarkerIcon />
                        </Stack>
                      </Tooltip>
                    </Stack>
                  ) : (
                    <TrainTimetableModal
                      trainNoLocal={entry.trainNoLocal}
                      hideTimeUntil={past}
                      scrollToStation={entry.stationName}
                    />
                  )}
                  {!!passedEarly && <Chip color="success">{t("PassedEarly")}</Chip>}
                  {!!delayed && <Chip color="warning">{t("Delayed")}</Chip>}
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
                  {prevStations.length ? (
                    prevStations.map((station, index) => (
                      <Fragment key={`${entry.trainNoLocal}-prev${station}-${index}`}>
                        <Typography fontFamily="monospace" level="body-sm" textAlign="center" sx={{ color: "inherit" }}>
                          {station || t("N/A")}
                        </Typography>
                        {index < prevStations.length - 1 && (
                          <Divider sx={{ width: "80%", margin: "0 auto" }}>
                            <ArrowDownIcon />
                          </Divider>
                        )}
                      </Fragment>
                    ))
                  ) : (
                    <Typography fontFamily="monospace" level="body-sm" textAlign="center" sx={{ color: "inherit" }}>
                      {t("N/A")}
                    </Typography>
                  )}
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

                  {delayDisplay}

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
                          <Typography>{t("CurrentStationIsNext.Full", { stationName: entry.stationName })}</Typography>
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
                  {nextStations.length ? (
                    nextStations.map((station, index) => (
                      <Fragment key={`${entry.trainNoLocal}-next${station}-${index}`}>
                        <Typography fontFamily="monospace" level="body-sm" textAlign="center" sx={{ color: "inherit" }}>
                          {station || t("N/A")}
                        </Typography>
                        {index < nextStations.length - 1 && (
                          <Divider sx={{ width: "80%", margin: "0 auto" }}>
                            <ArrowDownIcon />
                          </Divider>
                        )}
                      </Fragment>
                    ))
                  ) : (
                    <Typography fontFamily="monospace" level="body-sm" textAlign="center" sx={{ color: "inherit" }}>
                      {t("N/A")}
                    </Typography>
                  )}
                </Stack>
              </td>
              {/* Line */}
              <td>
                <Typography fontFamily="monospace" level="body-sm" sx={{ color: "inherit" }}>
                  <Stack>
                    {filteredLines.map((line, index, arr) => (
                      <Fragment key={`${entry.trainNoLocal}-line${line}-${index}`}>
                        <Typography fontFamily="monospace" level="body-sm" textAlign="center" sx={{ color: "inherit" }}>
                          {line}
                        </Typography>
                        {index < arr.length - 1 && (
                          <Divider sx={{ width: "80%", margin: "0 auto" }}>
                            <ArrowDownIcon />
                          </Divider>
                        )}
                      </Fragment>
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
                    <Typography sx={{ gridColumn: "1", color: "inherit" }} fontFamily="monospace" level="body-sm">
                      <TimeDiffDisplay start={entry.arrivalTime} end={entry.departureTime} />
                    </Typography>
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
                        <StopTypeDisplay
                          stopType={entry.stopType as "NoStopOver" | "CommercialStop" | "NoncommercialStop"}
                        />
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
            </FlashingRow>
          );
        })}
      </tbody>
    </Table>
  );
};

export default StationTimetableTableView;
