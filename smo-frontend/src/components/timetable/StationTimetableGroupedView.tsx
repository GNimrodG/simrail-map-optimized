import { useMediaQuery } from "@mantine/hooks";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import { styled } from "@mui/joy/styles";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useMemo } from "react";
import { useTranslation } from "react-i18next";

import UnplayableStations from "../../assets/unplayable-stations.json";
import { useSetting } from "../../hooks/useSetting";
import { Train } from "../../utils/types";
import { getColorTrainMarker } from "../../utils/ui";
import ArrowRightIcon from "../icons/arrow-right-solid.svg?react";
import InfoIcon from "../icons/InfoIcon";
import MapMarkerIcon from "../icons/map-location-dot-solid.svg?react";
import TrainMarkerPopup from "../markers/train/TrainMarkerPopup";
import DelayDisplay from "../utils/DelayDisplay";
import StopTypeDisplay from "../utils/StopTypeDisplay";
import TimeDiffDisplay from "../utils/TimeDiffDisplay";
import TimeDisplay from "../utils/TimeDisplay";
import TrainTypeDisplay from "../utils/TrainTypeDisplay";
import type { EntryRenderState } from "./StationTimetableTableView";
import TrainTimetableModal from "./TrainTimetableModal";

export interface StationTimetableGroupedViewProps {
  entryStates: EntryRenderState[];
  onPanToTrain: (train: Train) => void;
  isCollapsed?: boolean;
}

const FlashingCard = styled(Sheet, { shouldForwardProp: (p) => p !== "shouldLeave" })<{
  shouldLeave: boolean;
}>(({ shouldLeave, theme }) => ({
  "animation": shouldLeave ? `pulse 1.5s infinite` : "none",

  "@keyframes pulse": {
    "0%,100%": {},
    "50%": {
      color: theme.palette.success.plainColor,
      borderColor: theme.palette.success.plainColor,
    },
  },

  "transition": "color 0.75s",
}));

interface GroupedEntries {
  stationKey: string;
  displayStation: string;
  stationPrefix: string | null;
  nextStationLine: number[] | null;
  entries: EntryRenderState[];
}

const StationTimetableGroupedView: FunctionComponent<StationTimetableGroupedViewProps> = ({
  entryStates,
  onPanToTrain,
  isCollapsed,
}) => {
  const { t } = useTranslation("translation", { keyPrefix: "TrainTimetable" });
  const [groupByLineNumber] = useSetting("groupTimetableByLineNumber");
  const [maxEntriesDefault] = useSetting("timetableGroupedMaxEntriesDefault");
  const [maxEntriesSmall] = useSetting("timetableGroupedMaxEntriesSmall");
  const [maxEntriesLarge] = useSetting("timetableGroupedMaxEntriesLarge");
  const [hidePassed] = useSetting("timetableGroupedHidePassed");

  const groupedEntries = useMemo(() => {
    const groups = new Map<string, GroupedEntries>();

    for (const state of entryStates) {
      // Skip passed trains if setting is enabled
      if (hidePassed && state.past) {
        continue;
      }

      // Get the next station (last one in the list)
      const nextStation = state.nextStations.at(-1) ?? t("N/A");

      // Get line numbers from the timetable
      let nextStationLine: number | null = null;

      if (state.trainTimetable) {
        const currentIndex = state.trainTimetable.TimetableEntries.findIndex(
          (e) => e.NameForPerson === state.entry.stationName,
        );

        if (currentIndex >= 0 && currentIndex < state.trainTimetable.TimetableEntries.length - 1) {
          nextStationLine = state.trainTimetable.TimetableEntries[currentIndex + 1].Line;
        }
      }

      // Create station key: if grouping by line number, include it in the key
      const stationKey =
        groupByLineNumber && nextStationLine !== null ? `${nextStation}-${nextStationLine}` : nextStation;

      if (!groups.has(stationKey)) {
        groups.set(stationKey, {
          stationKey,
          displayStation: nextStation,
          stationPrefix: UnplayableStations.find((station) => station.Name === nextStation)?.Prefix || null,
          nextStationLine: nextStationLine ? [nextStationLine] : null,
          entries: [],
        });
      }

      groups.get(stationKey)!.entries.push(state);

      if (nextStationLine !== null && !groups.get(stationKey)!.nextStationLine?.includes(nextStationLine)) {
        groups.get(stationKey)!.nextStationLine ||= [];
        groups.get(stationKey)!.nextStationLine!.push(nextStationLine);
      }
    }

    // Sort entries within each group by departure time
    for (const group of groups.values()) {
      group.entries.sort((a, b) => {
        const aTime = new Date(a.entry.departureTime ?? "").getTime();
        const bTime = new Date(b.entry.departureTime ?? "").getTime();
        return aTime - bTime;
      });
    }

    // Convert to array and sort by station name
    return Array.from(groups.values()).sort(
      (a, b) =>
        a.displayStation.localeCompare(b.displayStation) -
        (a.entries.length < 10 || b.entries.length < 10 ? a.entries.length - b.entries.length : 0), // Move groups with few entries to the end
    );
  }, [entryStates, t, groupByLineNumber, hidePassed]);

  const isXlHeight = useMediaQuery("(min-height: 1000px)");

  return (
    <Stack
      sx={{
        display: "grid",
        gridTemplateColumns:
          groupedEntries.length === 1
            ? "1fr"
            : {
                sm: "1fr",
                md: "repeat(2, 1fr)",
                xl:
                  groupedEntries.length !== 2 &&
                  (isCollapsed || groupedEntries.length === 3 || groupedEntries.length > 4)
                    ? "repeat(3, 1fr)"
                    : "repeat(2, 1fr)",
              },
        gap: 2,
      }}>
      {groupedEntries.map((group) => {
        const maxEntries =
          groupedEntries.length <= 2
            ? maxEntriesDefault
            : isXlHeight && !isCollapsed
              ? maxEntriesLarge
              : maxEntriesSmall;
        const visibleEntries = group.entries.slice(0, maxEntries);
        const hiddenCount = group.entries.length - visibleEntries.length;

        return (
          <Stack key={group.stationKey} spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{
                  position: "sticky",
                  top: 0,
                  bgcolor: "background.surface",
                  zIndex: 1,
                  py: 0.5,
                  px: 1,
                  borderRadius: "sm",
                }}>
                <ArrowRightIcon style={{ width: 16, height: 16 }} />
                <Typography level="h4">
                  {group.displayStation}
                  {group.stationPrefix && (
                    <Typography component="span" level="body-sm" sx={{ ml: 0.5, color: "neutral.500" }}>
                      {group.stationPrefix}
                    </Typography>
                  )}
                  {!!group.nextStationLine?.length && (
                    <Typography component="span" level="body-sm" sx={{ ml: 0.5, color: "neutral.500" }}>
                      ({group.nextStationLine.sort((a, b) => a - b).join(", ")})
                    </Typography>
                  )}
                </Typography>
              </Stack>
              <Chip size="sm" variant="soft">
                {group.entries.length}
              </Chip>
            </Stack>
            <Stack spacing={0.75}>
              {visibleEntries.map((state) => {
                const {
                  entry,
                  train,
                  departureDelay,
                  isPredictedDelay,
                  lastDelay,
                  passedEarly,
                  isInsideStation,
                  isCurrentStationTheNextStation,
                  past,
                  delayed,
                  shouldLeave,
                } = state;

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

                const cardColor = past
                  ? passedEarly
                    ? "success.solidBg"
                    : "neutral.plainDisabledColor"
                  : isInsideStation
                    ? "primary.solidHoverBg"
                    : delayed
                      ? "warning.plainColor"
                      : undefined;

                return (
                  <FlashingCard
                    key={`${entry.trainNoLocal}-${entry.index}`}
                    shouldLeave={shouldLeave}
                    variant="outlined"
                    sx={{
                      borderRadius: "sm",
                      p: 1,
                      color: cardColor,
                      borderColor: cardColor,
                      display: "flex",
                      flexDirection: "row",
                      gap: 1,
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap sx={{ flex: 1 }}>
                      <Typography
                        fontFamily="monospace"
                        level="title-md"
                        variant="outlined"
                        color={train ? getColorTrainMarker(train.TrainData.Velocity) : "neutral"}>
                        {entry.trainNoLocal}
                      </Typography>
                      <Typography fontFamily="monospace" level="body-sm" sx={{ color: "inherit" }}>
                        <TrainTypeDisplay type={entry.trainType} hideTooltip />
                      </Typography>
                      {entry.arrivalTime || entry.departureTime ? (
                        <Typography fontFamily="monospace" level="body-sm" sx={{ color: "inherit" }}>
                          {entry.arrivalTime && <TimeDisplay time={entry.arrivalTime} />}
                          {entry.departureTime && entry.departureTime !== entry.arrivalTime && (
                            <>
                              {entry.arrivalTime && " - "}
                              <TimeDisplay time={entry.departureTime} />
                              {entry.arrivalTime && (
                                <>
                                  {" "}
                                  <TimeDiffDisplay start={entry.arrivalTime} end={entry.departureTime} />
                                </>
                              )}
                            </>
                          )}
                        </Typography>
                      ) : null}
                      {delayDisplay}
                      {entry.platform && entry.track && (
                        <Typography fontFamily="monospace" level="body-sm" sx={{ color: "inherit" }}>
                          {entry.platform}/{entry.track}
                        </Typography>
                      )}
                      {entry.stopType && (
                        <Typography fontFamily="monospace" level="body-sm" sx={{ color: "inherit" }}>
                          <StopTypeDisplay
                            stopType={entry.stopType as "NoStopOver" | "CommercialStop" | "NoncommercialStop"}
                          />
                        </Typography>
                      )}
                      {entry.note && (
                        <Typography level="body-xs" fontFamily="monospace" sx={{ color: "neutral.500" }}>
                          {entry.note}
                        </Typography>
                      )}
                      {train && (
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
                      )}
                      {train && (
                        <Tooltip variant="outlined" describeChild title={t("PanToTrain")} arrow>
                          <Stack
                            alignItems="center"
                            justifyContent="center"
                            sx={{ cursor: "pointer" }}
                            onClick={() => onPanToTrain(train)}>
                            <MapMarkerIcon />
                          </Stack>
                        </Tooltip>
                      )}
                      {!train && (
                        <TrainTimetableModal
                          trainNoLocal={entry.trainNoLocal}
                          hideTimeUntil={past}
                          scrollToStation={entry.stationName}
                        />
                      )}
                      {(group.nextStationLine?.length ?? 0) > 1 && !!entry.line && (
                        <Tooltip
                          title={t("LineNumberTooltip", { line: entry.line })}
                          arrow
                          color="neutral"
                          variant="outlined">
                          <Chip size="sm" variant="outlined" color="neutral">
                            {t("LineNumber", { line: entry.line })}
                          </Chip>
                        </Tooltip>
                      )}
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                      {passedEarly && (
                        <Chip size="sm" variant="soft" color="success">
                          {t("PassedEarly")}
                        </Chip>
                      )}
                      {delayed && (
                        <Chip size="sm" variant="soft" color="warning">
                          {t("Delayed")}
                        </Chip>
                      )}
                      {isInsideStation && (
                        <Chip size="sm" variant="solid" color="primary">
                          {t("InsideStation.Short")}
                        </Chip>
                      )}
                      {!isInsideStation && isCurrentStationTheNextStation && (
                        <Chip size="sm" variant="outlined" color="success">
                          {t("CurrentStationIsNext.Short")}
                        </Chip>
                      )}
                    </Stack>
                  </FlashingCard>
                );
              })}
              {hiddenCount > 0 && (
                <Typography level="body-sm" sx={{ color: "neutral.500", px: 1, py: 0.5 }}>
                  {t("MoreTrains", { count: hiddenCount })}
                </Typography>
              )}
            </Stack>
          </Stack>
        );
      })}
    </Stack>
  );
};

export default StationTimetableGroupedView;
