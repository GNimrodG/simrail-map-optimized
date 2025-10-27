import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import { styled } from "@mui/joy/styles";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

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
  prevStationLine: number[] | null;
  nextStationLine: number[] | null;
  entries: EntryRenderState[];
  reverseRouteKey?: string; // Key of the reverse route (B->A when this is A->B)
}

const StationTimetableGroupedView: FunctionComponent<StationTimetableGroupedViewProps> = ({
  entryStates,
  onPanToTrain,
}) => {
  const { t } = useTranslation("translation", { keyPrefix: "TrainTimetable" });
  const [hoveredRouteKey, setHoveredRouteKey] = useState<string | null>(null);

  const groupedEntries = useMemo(() => {
    const groups = new Map<string, GroupedEntries>();

    for (const state of entryStates) {
      // Get the previous station (first one in the list) and next station (last one in the list)
      const prevStation = state.prevStations.at(0) ?? t("N/A");
      const nextStation = state.nextStations.at(-1) ?? t("N/A");
      const stationKey = `${prevStation};${nextStation}`;

      // Get line numbers from the timetable
      let prevStationLine: number | null = null;
      let nextStationLine: number | null = null;

      if (state.trainTimetable) {
        const currentIndex = state.trainTimetable.TimetableEntries.findIndex(
          (e) => e.NameForPerson === state.entry.stationName,
        );

        if (currentIndex > 0) {
          prevStationLine = state.trainTimetable.TimetableEntries[currentIndex - 1].Line;
        }

        if (currentIndex >= 0 && currentIndex < state.trainTimetable.TimetableEntries.length - 1) {
          nextStationLine = state.trainTimetable.TimetableEntries[currentIndex + 1].Line;
        }
      }

      if (!groups.has(stationKey)) {
        groups.set(stationKey, {
          stationKey,
          displayStation: stationKey,
          prevStationLine: prevStationLine ? [prevStationLine] : null,
          nextStationLine: nextStationLine ? [nextStationLine] : null,
          entries: [],
        });
      }

      groups.get(stationKey)!.entries.push(state);

      if (prevStationLine !== null && !groups.get(stationKey)!.prevStationLine?.includes(prevStationLine)) {
        groups.get(stationKey)!.prevStationLine ||= [];
        groups.get(stationKey)!.prevStationLine!.push(prevStationLine);
      }

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

    // Detect reverse routes and mark them
    for (const group of groups.values()) {
      const [prevStation, nextStation] = group.displayStation.split(";");
      const reverseKey = `${nextStation};${prevStation}`;
      if (groups.has(reverseKey)) {
        group.reverseRouteKey = reverseKey;
      }
    }

    // Convert to array and sort to keep bidirectional routes together
    const groupArray = Array.from(groups.values());
    const processed = new Set<string>();
    const sorted: GroupedEntries[] = [];

    for (const group of groupArray) {
      if (processed.has(group.stationKey)) continue;

      sorted.push(group);
      processed.add(group.stationKey);

      // If there's a reverse route, add it immediately after
      if (group.reverseRouteKey && !processed.has(group.reverseRouteKey)) {
        const reverseGroup = groups.get(group.reverseRouteKey);
        if (reverseGroup) {
          sorted.push(reverseGroup);
          processed.add(group.reverseRouteKey);
        }
      }
    }

    return sorted;
  }, [entryStates, t]);

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
                xl: groupedEntries.length === 3 || groupedEntries.length > 4 ? "repeat(3, 1fr)" : "repeat(2, 1fr)",
              },
        gap: 2,
      }}>
      {groupedEntries.map((group) => {
        const maxEntries = groupedEntries.length <= 2 ? 20 : 5;
        const visibleEntries = group.entries.slice(0, maxEntries);
        const hiddenCount = group.entries.length - visibleEntries.length;

        // Split the display station to get prev and next
        const [prevStation, nextStation] = group.displayStation.split(";");

        const isHovered = hoveredRouteKey === group.stationKey || hoveredRouteKey === group.reverseRouteKey;

        return (
          <Stack key={group.stationKey} spacing={1}>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                onMouseEnter={() => setHoveredRouteKey(group.stationKey)}
                onMouseLeave={() => setHoveredRouteKey(null)}
                sx={{
                  position: "sticky",
                  top: 0,
                  bgcolor: "background.surface",
                  zIndex: 1,
                  py: 0.5,
                  px: 1,
                  borderRadius: "sm",
                  transition: "all 0.2s",
                  cursor: group.reverseRouteKey ? "pointer" : "default",
                  ...(group.reverseRouteKey && {
                    borderWidth: 1,
                    borderStyle: "solid",
                    borderColor: isHovered ? "primary.solidBg" : "primary.outlinedBorder",
                    bgcolor: isHovered ? "primary.softBg" : "background.surface",
                  }),
                }}>
                <Typography level="h4">
                  {prevStation}
                  {!!group.prevStationLine?.length && (
                    <Typography component="span" level="body-sm" sx={{ ml: 0.5, color: "neutral.500" }}>
                      ({group.prevStationLine.sort((a, b) => a - b).join(", ")})
                    </Typography>
                  )}
                </Typography>
                <ArrowRightIcon style={{ width: 16, height: 16 }} />
                <Typography level="h4">
                  {nextStation}
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
              {group.reverseRouteKey && (
                <Tooltip title={t("BidirectionalRoute")} arrow>
                  <Chip size="sm" variant="outlined" color="primary" sx={{ fontSize: "0.75rem" }}>
                    ⇄
                  </Chip>
                </Tooltip>
              )}
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
