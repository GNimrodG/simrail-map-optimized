import Chip from "@mui/joy/Chip";
import Divider from "@mui/joy/Divider";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import { styled } from "@mui/joy/styles";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Train } from "../../utils/types";
import { getColorTrainMarker, getDistanceColorForSignal } from "../../utils/ui";
import InfoIcon from "../icons/InfoIcon";
import MapMarkerIcon from "../icons/map-location-dot-solid.svg?react";
import LengthIcon from "../markers/icons/LengthIcon";
import SpeedIcon from "../markers/icons/SpeedIcon";
import WeightIcon from "../markers/icons/WeightIcon";
import TrainConsistDisplay from "../markers/train/TrainConsistDisplay";
import TrainMarkerPopup from "../markers/train/TrainMarkerPopup";
import DelayDisplay from "../utils/DelayDisplay";
import StopTypeDisplay from "../utils/StopTypeDisplay";
import TimeDiffDisplay from "../utils/TimeDiffDisplay";
import TimeDisplay from "../utils/TimeDisplay";
import TrainTypeDisplay from "../utils/TrainTypeDisplay";
import type { EntryRenderState } from "./StationTimetableTableView";
import TrainTimetableModal from "./TrainTimetableModal";

export interface StationTimetableCardsViewProps {
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

const StationTimetableCardsView: FunctionComponent<StationTimetableCardsViewProps> = ({
  entryStates,
  onPanToTrain,
}) => {
  const { t } = useTranslation("translation", { keyPrefix: "TrainTimetable" });
  const { t: tServerList } = useTranslation("translation", { keyPrefix: "ServerTrainList" });

  return (
    <Stack spacing={1.5}>
      {entryStates.map((state) => {
        const {
          entry,
          train,
          trainTimetable,
          departureDelay,
          isPredictedDelay,
          lastDelay,
          passedEarly,
          isInsideStation,
          isCurrentStationTheNextStation,
          isPrevStationTheNextStation,
          past,
          delayed,
          prevStations,
          nextStations,
          shouldLeave,
        } = state;

        const prevStationLabel = prevStations.at(0) || null;
        const earlierPrevStations = prevStations.slice(1);
        const nextStationLabel = nextStations.at(-1) || null;
        const remainingNextStations = nextStations.slice(0, -1);

        const statusBadges: ReactNode[] = [
          ...(passedEarly
            ? [
                <Chip key="status-passed-early" size="sm" variant="soft" color="success">
                  {t("PassedEarly")}
                </Chip>,
              ]
            : []),
          ...(delayed
            ? [
                <Chip key="status-delayed" size="sm" variant="soft" color="warning">
                  {t("Delayed")}
                </Chip>,
              ]
            : []),
          ...(isPrevStationTheNextStation
            ? [
                <Tooltip
                  key="status-prev-next"
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
                  <Chip size="sm" variant="outlined" color="neutral">
                    {t("PrevStationIsNext.Short")}
                  </Chip>
                </Tooltip>,
              ]
            : []),
          ...(!isInsideStation && isCurrentStationTheNextStation
            ? [
                <Tooltip
                  key="status-current-next"
                  arrow
                  variant="outlined"
                  title={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <InfoIcon />
                      <Typography>{t("CurrentStationIsNext.Full", { stationName: entry.stationName })}</Typography>
                    </Stack>
                  }>
                  <Chip size="sm" variant="outlined" color="success">
                    {t("CurrentStationIsNext.Short")}
                  </Chip>
                </Tooltip>,
              ]
            : []),
          ...(isInsideStation
            ? [
                <Tooltip
                  key="status-inside"
                  arrow
                  variant="outlined"
                  title={
                    <Stack direction="row" spacing={1} alignItems="center">
                      <InfoIcon />
                      <Typography>{t("InsideStation.Full", { stationName: entry.stationName })}</Typography>
                    </Stack>
                  }>
                  <Chip size="sm" variant="solid" color="primary">
                    {t("InsideStation.Short")}
                  </Chip>
                </Tooltip>,
              ]
            : []),
        ];

        const consistSummary = (() => {
          if (!train?.Vehicles?.length) return null;

          const counts = train.Vehicles.reduce((acc, vehicle) => {
            const [shortName] = vehicle.split("/");
            const key = (shortName ?? vehicle).trim();
            if (!key) return acc;
            const current = acc.get(key) ?? 0;
            acc.set(key, current + 1);
            return acc;
          }, new Map<string, number>());

          if (counts.size === 0) return null;

          return Array.from(counts.entries())
            .map(([name, count]) => (count > 1 ? `${count}x ${name}` : name))
            .join(" + ");
        })();

        const infoChips: ReactNode[] = [
          ...(trainTimetable
            ? [
                <Chip key="info-route" size="sm" variant="outlined">
                  {`${trainTimetable.StartStation} -> ${trainTimetable.EndStation}`}
                </Chip>,
                <Chip key="info-length" size="sm" variant="soft" startDecorator={<LengthIcon />}>
                  {`${trainTimetable.TrainLength} m`}
                </Chip>,
                <Chip key="info-weight" size="sm" variant="soft" startDecorator={<WeightIcon />}>
                  {`${trainTimetable.TrainWeight} t`}
                </Chip>,
              ]
            : []),
          ...(train
            ? [
                <Chip key="info-speed" size="sm" variant="soft" startDecorator={<SpeedIcon />}>
                  {`${Math.round(train.TrainData.Velocity)} km/h`}
                </Chip>,
                <Chip
                  key="info-control"
                  size="sm"
                  variant="soft"
                  color={train.TrainData.ControlledBySteamID ? "success" : "neutral"}>
                  {train.TrainData.ControlledBySteamID ? "Player controlled" : "AI controlled"}
                </Chip>,
                ...(consistSummary
                  ? [
                      <Tooltip
                        key="consist"
                        arrow
                        variant="outlined"
                        placement="right"
                        describeChild
                        title={<TrainConsistDisplay consist={train.Vehicles} />}>
                        <Chip size="sm" variant="soft" startDecorator={<InfoIcon />}>
                          {tServerList("ConsistLabel", { summary: consistSummary })}
                        </Chip>
                      </Tooltip>,
                    ]
                  : []),
                ...(train.TrainData.SignalInFront
                  ? (() => {
                      const baseSignalName = train.TrainData.SignalInFront.split("@")[0];
                      const signalDistanceColor = getDistanceColorForSignal(train.TrainData.DistanceToSignalInFront);
                      const signalSpeed = train.TrainData.SignalInFrontSpeed;

                      return [
                        <Chip
                          key="info-signal"
                          size="sm"
                          variant="outlined"
                          sx={{ "& .distance": { color: signalDistanceColor, fontWeight: 600 } }}>
                          {baseSignalName}
                          {signalSpeed === null ? null : <> ({signalSpeed} km/h)</>}
                          <span className="distance">{` ${Math.round(train.TrainData.DistanceToSignalInFront)} m`}</span>
                        </Chip>,
                      ];
                    })()
                  : []),
              ]
            : []),
        ];

        const scheduleDetails: ReactNode[] = [];

        if (entry.arrivalTime || entry.departureTime) {
          scheduleDetails.push(
            <Typography level="body-sm" sx={{ color: "inherit" }} key="times" fontFamily="monospace">
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
            </Typography>,
          );
        }

        if (entry.note) {
          scheduleDetails.push(
            <Typography key="note" level="body-xs" fontFamily="monospace" sx={{ color: "neutral.500" }}>
              {entry.note}
            </Typography>,
          );
        }

        if (entry.stopType) {
          scheduleDetails.push(
            <Typography key="stop-type" fontFamily="monospace" level="body-sm">
              <StopTypeDisplay stopType={entry.stopType as "NoStopOver" | "CommercialStop" | "NoncommercialStop"} />
            </Typography>,
          );
        }

        // Show platform/track in card view similar to the table view
        // compute platform/track display string to avoid nested ternaries in JSX
        if (entry.platform && entry.track) {
          scheduleDetails.push(
            <Typography key="platform-track" fontFamily="monospace" level="body-sm" sx={{ color: "inherit" }}>
              {entry.platform}/{entry.track}
            </Typography>,
          );
        }

        const delayDisplay =
          entry.departureTime && (departureDelay !== null || (!past && !!lastDelay)) ? (
            <DelayDisplay
              delay={departureDelay ?? lastDelay}
              scheduledDeparture={isPredictedDelay ? entry.departureTime : departureDelay ? entry.departureTime : null}
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
              p: 1.5,
              color: cardColor,
              borderColor: cardColor,
              display: "flex",
              flexDirection: "column",
              gap: 1,
            }}>
            <Stack spacing={1.25} useFlexGap>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                useFlexGap
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}>
                <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                  <Stack direction="row" spacing={1} useFlexGap alignItems="center" flexWrap="wrap">
                    <Typography
                      fontFamily="monospace"
                      level="h4"
                      variant="outlined"
                      color={train ? getColorTrainMarker(train.TrainData.Velocity) : "neutral"}>
                      {entry.trainNoLocal}
                    </Typography>
                    <Typography fontFamily="monospace" level="body-lg" component="div" sx={{ color: "inherit" }}>
                      <TrainTypeDisplay type={entry.trainType} hideTooltip />
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
                  </Stack>

                  <Stack direction="row" spacing={1} useFlexGap alignItems="center" flexWrap="wrap">
                    {statusBadges}

                    {delayDisplay}
                  </Stack>
                </Stack>
                <Stack spacing={1} alignItems={{ xs: "flex-start", sm: "flex-end" }}>
                  {prevStationLabel && (
                    <Stack spacing={0.25} alignItems={{ xs: "flex-start", sm: "flex-end" }}>
                      <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                        {t("PrevStationLabel")}
                      </Typography>
                      <Typography fontFamily="monospace" level="title-md" sx={{ color: "inherit" }}>
                        {prevStationLabel}
                      </Typography>
                      {earlierPrevStations.length > 0 && (
                        <Typography fontFamily="monospace" level="body-sm" sx={{ color: "neutral.500" }}>
                          {earlierPrevStations.join(", ")}
                        </Typography>
                      )}
                    </Stack>
                  )}
                  {nextStationLabel && (
                    <Stack spacing={0.25} alignItems={{ xs: "flex-start", sm: "flex-end" }}>
                      <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                        {t("NextStationLabel")}
                      </Typography>
                      <Typography fontFamily="monospace" level="title-md" sx={{ color: "inherit" }}>
                        {nextStationLabel}
                      </Typography>
                      {remainingNextStations.length > 0 && (
                        <Typography fontFamily="monospace" level="body-sm" sx={{ color: "neutral.500" }}>
                          {remainingNextStations.join(", ")}
                        </Typography>
                      )}
                    </Stack>
                  )}
                </Stack>
              </Stack>

              {(infoChips.length > 0 || scheduleDetails.length > 0) && <Divider />}

              {(infoChips.length > 0 || scheduleDetails.length > 0) && (
                <Stack
                  direction={{ xs: "column", sm: "row" }}
                  spacing={1}
                  useFlexGap
                  justifyContent="space-between"
                  alignItems={{ xs: "flex-start", sm: "center" }}>
                  {infoChips.length > 0 && (
                    <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                      {infoChips}
                    </Stack>
                  )}
                  {scheduleDetails.length > 0 && (
                    <Stack spacing={1} alignItems={{ xs: "flex-start", sm: "flex-end" }} direction="row">
                      {scheduleDetails}
                    </Stack>
                  )}
                </Stack>
              )}
            </Stack>
          </FlashingCard>
        );
      })}
    </Stack>
  );
};

export default StationTimetableCardsView;
