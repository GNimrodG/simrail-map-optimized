import { readLocalStorageValue, useMediaQuery } from "@mantine/hooks";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import ButtonGroup from "@mui/joy/ButtonGroup";
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import LinearProgress from "@mui/joy/LinearProgress";
import Stack from "@mui/joy/Stack";
import Step, { stepClasses } from "@mui/joy/Step";
import StepIndicator from "@mui/joy/StepIndicator";
import Stepper from "@mui/joy/Stepper";
import { styled, useTheme } from "@mui/joy/styles";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import moment from "moment";
import { type FunctionComponent, useCallback, useContext, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { useSetting } from "../../../hooks/useSetting";
import { useProfileData } from "../../../hooks/useProfileData";
import useSubject from "../../../hooks/useSubject";
import { useTrainTimetable } from "../../../hooks/useTrainTimetable";
import { dataProvider } from "../../../utils/data-manager";
import { calculateLastKnownDelay, calculatePredictedDelay } from "../../../utils/delay-prediction";
import MapLinesContext from "../../../utils/map-lines-context";
import SelectedRouteContext from "../../../utils/selected-route-context";
import SelectedTrainContext from "../../../utils/selected-train-context";
import { UserProfileResponse, Train } from "../../../utils/types";
import { getColorTrainMarker, getDistanceColorForSignal } from "../../../utils/ui";
import CollapseIcon from "../../icons/CollapseIcon";
import ExpandIcon from "../../icons/ExpandIcon";
import InfoIcon from "../../icons/InfoIcon";
import SettingCheckbox from "../../settings/SettingCheckbox";
import SteamProfileDisplay from "../../profile/SteamProfileDisplay";
import { formatVehicleName, getThumbnailUrl } from "../../utils/general-utils";
import SignalSpeedDisplay from "../../utils/SignalSpeedDisplay";
import TrainTypeDisplay from "../../utils/TrainTypeDisplay";
import CalendarIcon from "../icons/calendar.svg?react";
import LengthIcon from "../icons/LengthIcon";
import SpeedIcon from "../icons/SpeedIcon";
import WeightIcon from "../icons/WeightIcon";
import StationDisplay from "../station/StationDisplay";
import TrainConsistDisplay from "./TrainConsistDisplay";
import TrainScheduleDisplay from "./TrainScheduleDisplay";
import XboxProfileDisplay from "../../profile/XboxProfileDisplay";

export interface TrainMarkerPopupProps {
  train: Train;
  userData?: UserProfileResponse | null;
  showTrainRouteButton?: boolean;
  onToggleCollapse?: () => void;
  isCollapsed?: boolean;
  hideButtons?: boolean;
}

const Image = styled("img")(({ theme }) => ({
  width: 300,
  display: "none",
  [`@media (min-height: ${theme.breakpoints.values.md}px) and (min-width: ${theme.breakpoints.values.md}px)`]: {
    display: "block",
  },
}));

function useTrainDelays(trainId: string) {
  const delays = useSubject(
    useMemo(() => dataProvider.getDelaysForTrainId$(trainId), [trainId]),
    {},
  );

  const lastDelay = useMemo(() => {
    const sortedDelays = Object.entries(delays).sort(([a], [b]) => Number(a) - Number(b));
    return sortedDelays.length ? Math.round(sortedDelays.at(-1)![1] / 60) : null;
  }, [delays]);

  return { delays, lastDelay };
}

const TrainMarkerPopup: FunctionComponent<TrainMarkerPopupProps> = ({
  train,
  userData: _userData,
  showTrainRouteButton,
  onToggleCollapse,
  isCollapsed,
  hideButtons = false,
}) => {
  const { t } = useTranslation("translation", { keyPrefix: "TrainMakerPopup" });
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(`(max-height: ${theme.breakpoints.values.md}px)`);
  const { selectedTrain, setSelectedTrain } = useContext(SelectedTrainContext);
  const { selectedRoute, setSelectedRoute } = useContext(SelectedRouteContext);
  const { setMapLines } = useContext(MapLinesContext);
  const [isTimeTableExpanded, setIsTimeTableExpanded] = useState(
    readLocalStorageValue({ key: "expandScheduleDefault", defaultValue: false }),
  );

  const [hideTrainPictures] = useSetting("hideTrainPictures");
  const [showSpeedInfoCollapsed] = useSetting("showSpeedInfoCollapsed");
  const [showSignalInfoCollapsed] = useSetting("showSignalInfoCollapsed");
  const [showDelayInfoCollapsed] = useSetting("showDelayInfoCollapsed");
  const [showNextStationInfoCollapsed] = useSetting("showNextStationInfoCollapsed");

  const thumbnailUrl = useMemo(() => getThumbnailUrl(train.Vehicles[0]), [train.Vehicles]);

  const timetable = useTrainTimetable(train.TrainNoLocal);

  const trainTimetableIndex = useMemo(
    () => train.TrainData.VDDelayedTimetableIndex,
    [train.TrainData.VDDelayedTimetableIndex],
  );

  const { delays, lastDelay } = useTrainDelays(train.Id);

  // Calculate the last known delay for prediction at upcoming stations
  const lastKnownDelay = useMemo(
    () => calculateLastKnownDelay(delays, trainTimetableIndex),
    [delays, trainTimetableIndex],
  );

  // Calculate predicted delay for a station accounting for layover times
  const getPredictedDelay = useCallback(
    (stationIndex: number) => {
      if (!timetable) return null;
      return calculatePredictedDelay(stationIndex, lastKnownDelay, trainTimetableIndex, timetable);
    },
    [lastKnownDelay, trainTimetableIndex, timetable],
  );

  const prevStationDelay = useMemo(
    () => delays[train.TrainData.VDDelayedTimetableIndex - 1],
    [delays, train.TrainData.VDDelayedTimetableIndex],
  );

  const { userData } = useProfileData(
    train.TrainData.ControlledBySteamID,
    train.TrainData.ControlledByXboxID,
    _userData,
  );

  const stationData = useMemo(() => {
    if (!timetable) return { first: null, prev: null, current: null, next: null, last: null };

    const hasNotPassedCurrent = !delays[train.TrainData.VDDelayedTimetableIndex];

    const currentIndex = hasNotPassedCurrent
      ? train.TrainData.VDDelayedTimetableIndex
      : train.TrainData.VDDelayedTimetableIndex + 1;
    const prevIndex = hasNotPassedCurrent
      ? train.TrainData.VDDelayedTimetableIndex - 1
      : train.TrainData.VDDelayedTimetableIndex;
    const nextIndex = hasNotPassedCurrent
      ? train.TrainData.VDDelayedTimetableIndex + 1
      : train.TrainData.VDDelayedTimetableIndex + 2;

    return {
      first: timetable.TimetableEntries[0],
      prev: prevIndex === 0 ? null : timetable.TimetableEntries[prevIndex],
      current: currentIndex === timetable.TimetableEntries.length - 1 ? null : timetable.TimetableEntries[currentIndex],
      next: nextIndex < timetable.TimetableEntries.length - 1 ? timetable.TimetableEntries[nextIndex] : null,
      last: timetable.TimetableEntries.at(-1),
      currentIndex,
      nextIndex,
    };
  }, [delays, timetable, train.TrainData.VDDelayedTimetableIndex]);

  // Calculate predicted delays for current and next stations
  const predictedDelays = useMemo(() => {
    if (!timetable || !stationData.currentIndex) return { current: null, next: null };

    const currentDelay = delays[stationData.currentIndex];
    const nextDelay = delays[stationData.nextIndex];

    return {
      current:
        currentDelay === undefined && stationData.currentIndex !== undefined
          ? getPredictedDelay(stationData.currentIndex)
          : null,
      next:
        nextDelay === undefined && stationData.nextIndex !== undefined
          ? getPredictedDelay(stationData.nextIndex)
          : null,
      last: getPredictedDelay(timetable.TimetableEntries.length - 1),
    };
  }, [timetable, stationData.currentIndex, stationData.nextIndex, delays, getPredictedDelay]);

  const prevStation = stationData?.prev || stationData?.first;

  const trainSpeed = (
    <Typography
      level="body-lg"
      startDecorator={<SpeedIcon />}
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, flexDirection: "column" }}>
      <Typography color={getColorTrainMarker(train.TrainData.Velocity)}>
        {Math.round(train.TrainData.Velocity)} km/h
      </Typography>
      {prevStation && prevStation.MaxSpeed > 0 && (
        <Typography
          level="body-sm"
          color={
            train.TrainData.Velocity > prevStation.MaxSpeed + 3
              ? "danger"
              : train.TrainData.Velocity > prevStation.MaxSpeed
                ? "warning"
                : "neutral"
          }>
          VMAX: {prevStation.MaxSpeed} km/h
        </Typography>
      )}
    </Typography>
  );

  const signalInfo = (
    <Stack spacing={0.5} sx={{ width: "100%" }}>
      {train.TrainData.SignalInFront && (
        <>
          {!isCollapsed && <Typography level="body-sm">{t("NextSignal")}</Typography>}
          <Typography level="body-lg">
            {train.TrainData.SignalInFront?.split("@")[0]}{" "}
            {train.TrainData.SignalInFrontSpeed !== null && <SignalSpeedDisplay train={train} />}{" "}
            <Typography color={getDistanceColorForSignal(train.TrainData.DistanceToSignalInFront)}>
              {Math.round(train.TrainData.DistanceToSignalInFront)}m
            </Typography>
          </Typography>
        </>
      )}
    </Stack>
  );

  const delayInfo = useMemo(() => lastDelay !== null && <LastDelayInfo lastDelay={lastDelay} />, [lastDelay]);

  const handleFollow = useCallback(() => {
    setSelectedTrain({ trainNo: train.TrainNoLocal, follow: true, paused: false });
  }, [setSelectedTrain, train.TrainNoLocal]);

  const handleUnfollow = useCallback(() => {
    setSelectedTrain(selectedTrain?.trainNo ? { trainNo: selectedTrain.trainNo, follow: false, paused: false } : null);
    setMapLines(null);
  }, [selectedTrain, setSelectedTrain, setMapLines]);

  const handlePin = useCallback(() => {
    setSelectedTrain({ trainNo: train.TrainNoLocal, follow: false, paused: false });
  }, [setSelectedTrain, train.TrainNoLocal]);

  const handleUnpin = useCallback(() => {
    setSelectedTrain(null);
    setMapLines(null);
  }, [setMapLines, setSelectedTrain]);

  const handleShowRoute = useCallback(() => {
    setSelectedRoute(train.TrainNoLocal);
  }, [setSelectedRoute, train.TrainNoLocal]);

  const handleHideRoute = useCallback(() => {
    setSelectedRoute(null);
  }, [setSelectedRoute]);

  if (isCollapsed) {
    return (
      <Stack
        spacing={0.5}
        alignItems="center"
        useFlexGap
        sx={{
          minWidth: "min(14rem, 90vw)",
          maxWidth: "90vw",
        }}>
        <Stack spacing={0.5} direction="row" alignItems="center">
          <Typography level="body-lg" noWrap>
            {train.TrainNoLocal}{" "}
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
              (<TrainTypeDisplay type={train.TrainType || train.TrainName} displayName={train.TrainName} hideTooltip />)
            </Box>
          </Typography>
          {onToggleCollapse && (
            <Box
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                gridArea: "1 / 3 / 2 / 4",
              }}>
              <IconButton size="sm" onClick={onToggleCollapse}>
                <ExpandIcon />
              </IconButton>
            </Box>
          )}
        </Stack>

        {showSpeedInfoCollapsed && trainSpeed}

        {showNextStationInfoCollapsed && stationData.current && (
          <StationDisplay station={stationData.current} mainStation />
        )}

        {showDelayInfoCollapsed && delayInfo}

        {showSignalInfoCollapsed && (
          <Stack direction="row" alignItems="center">
            {signalInfo}
          </Stack>
        )}
      </Stack>
    );
  }

  return (
    <Stack
      spacing={1}
      alignItems="center"
      useFlexGap
      sx={{
        maxHeight: "calc(100vh - 16rem)",
        minWidth: "min(18rem, 90vw)",
        overflowX: "hidden",
        overflowY: "auto",
      }}>
      {!timetable && (
        <LinearProgress
          sx={{
            width: "100%",
            height: "0.5rem",
            position: "sticky",
            top: 0,
            zIndex: 1,
          }}
        />
      )}

      {!hideTrainPictures && <Image src={thumbnailUrl} alt={train.Vehicles[0]} title={train.Vehicles[0]} />}

      <Box
        sx={{
          display: "grid",
          alignItems: "center",
          gridTemplateColumns: "1fr auto 1fr",
          width: "100%",
        }}>
        <Typography
          level="h3"
          sx={{
            gridArea: "1 / 2 / 2 / 3",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexWrap: "wrap",
            maxWidth: "100%",
          }}
          component="div">
          {train.TrainNoLocal}{" "}
          <Box component="span" sx={{ display: "inline-flex", alignItems: "center", ml: 1 }}>
            (<TrainTypeDisplay type={train.TrainType || train.TrainName} displayName={train.TrainName} hideTooltip />)
          </Box>
        </Typography>

        {onToggleCollapse && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              gridArea: "1 / 3 / 2 / 4",
            }}>
            <IconButton size="sm" onClick={onToggleCollapse}>
              <CollapseIcon />
            </IconButton>
          </Box>
        )}
      </Box>

      <Stack direction="row" spacing={1} alignItems="center">
        <Typography level="body-sm">{formatVehicleName(train.Vehicles[0], true)}</Typography>
        <Tooltip
          arrow
          variant="outlined"
          placement="right"
          describeChild
          title={<TrainConsistDisplay consist={train.Vehicles} />}>
          <Stack alignItems="center" justifyContent="center">
            <InfoIcon />
          </Stack>
        </Tooltip>
      </Stack>

      <Stack sx={{ width: "100%" }} direction="row" justifyContent="space-around" alignItems="center">
        <Box sx={{ minWidth: 0, flexShrink: 1 }}>{trainSpeed}</Box>
        {timetable && (
          <Stack sx={{ width: "55%" }} spacing={1} direction="row" justifyContent="space-between" alignItems="center">
            <Typography
              level="body-md"
              startDecorator={<LengthIcon />}
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, flexDirection: "column" }}>
              {timetable.TrainLength}m
            </Typography>
            <Typography
              level="body-md"
              startDecorator={<WeightIcon />}
              sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, flexDirection: "column" }}>
              {timetable.TrainWeight}t
            </Typography>
            <Tooltip
              arrow
              variant="outlined"
              placement="right"
              describeChild
              title={
                <Box
                  sx={{
                    maxHeight: "min(600px, 90vh)",
                    overflowY: "auto",
                    position: "relative",
                  }}>
                  <Box
                    sx={{
                      position: "sticky",
                      top: 0,
                      zIndex: 10,
                      backgroundColor: theme.palette.background.surface,
                      boxShadow: `0px 4px 10px ${theme.palette.background.surface}`,
                    }}>
                    <Typography level="body-lg" textAlign="center">
                      {t("Schedule")}
                    </Typography>
                  </Box>
                  <TrainScheduleDisplay
                    timetable={timetable}
                    delays={delays}
                    trainTimetableIndex={trainTimetableIndex}
                  />
                </Box>
              }>
              <Stack alignItems="center" justifyContent="center">
                <CalendarIcon />
              </Stack>
            </Tooltip>
          </Stack>
        )}
      </Stack>

      {train.TrainData.RequiredMapDLCs?.flat(2).includes(3583200) && (
        <Typography level="body-lg" color="warning" variant="solid" noWrap>
          Łódź - Warsaw
        </Typography>
      )}

      <Stack direction="column" sx={{ width: "100%" }}>
        <Stepper
          sx={{
            width: "100%",
            [`& .${stepClasses.active}`]: {
              "--Step-indicatorDotSize": "0.6rem",
              [`& .${stepClasses.indicator}`]: {
                color: "var(--joy-palette-success-solidBg)",
              },
            },
          }}
          orientation="vertical">
          <Step
            sx={{
              "--Step-indicatorDotSize": "0.5rem",
            }}
            completed>
            {stationData.first ? (
              <StationDisplay station={stationData.first} pastStation mainStation />
            ) : (
              <Typography level="body-md">{train.StartStation}</Typography>
            )}
          </Step>
          {isTimeTableExpanded && stationData.prev && (
            <Step completed>
              <StationDisplay station={stationData.prev} pastStation delay={prevStationDelay} />
            </Step>
          )}
          {stationData.current && (
            <>
              <Step
                sx={{
                  color: "primary.solid",
                }}
                active
                indicator={
                  <StepIndicator
                    sx={{
                      color: "primary.solid",
                      cursor: "pointer",
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsTimeTableExpanded((expanded) => !expanded);
                    }}>
                    {isTimeTableExpanded ? <CollapseIcon /> : <ExpandIcon />}
                  </StepIndicator>
                }>
                <StationDisplay
                  station={stationData.current}
                  mainStation={isTimeTableExpanded}
                  current
                  delay={predictedDelays.current ?? undefined}
                  predictedDelay
                />
              </Step>
              {isTimeTableExpanded && stationData.next && (
                <Step>
                  <StationDisplay station={stationData.next} delay={predictedDelays.next ?? undefined} predictedDelay />
                </Step>
              )}
            </>
          )}
          <Step
            sx={
              stationData.last && stationData.prev && !stationData.current
                ? {
                    "color": "primary.solid",
                    "--Step-indicatorDotSize": "0.5rem",
                  }
                : {
                    "--Step-indicatorDotSize": "0.5rem",
                  }
            }
            active={!!stationData.last && !!stationData.prev && !stationData.current}>
            {stationData.last ? (
              <StationDisplay
                station={stationData.last}
                mainStation
                current={!!stationData.last && !!stationData.prev && !stationData.current}
                delay={predictedDelays.last ?? undefined}
                predictedDelay
              />
            ) : (
              <Typography level="body-md">{train.EndStation}</Typography>
            )}
          </Step>
        </Stepper>

        {delayInfo}
      </Stack>

      {train.TrainData.InBorderStationArea && (
        <Typography level="body-lg" color="warning" variant="solid" noWrap>
          {t("OOB")}
        </Typography>
      )}

      {signalInfo}

      {userData &&
        (train.TrainData.ControlledBySteamID ? (
          <SteamProfileDisplay profile={userData} steamId={train.TrainData.ControlledBySteamID} />
        ) : (
          <XboxProfileDisplay profile={userData} xboxId={train.TrainData.ControlledByXboxID!} />
        ))}

      {!hideButtons && (
        <Stack spacing={1} sx={{ width: "100%" }}>
          {selectedTrain?.trainNo === train.TrainNoLocal ? (
            <>
              <ButtonGroup size={isSmallScreen ? "sm" : "md"}>
                {selectedTrain.follow ? (
                  <Button
                    fullWidth
                    variant="solid"
                    color={selectedTrain.paused ? "neutral" : "warning"}
                    onClick={handleUnfollow}>
                    {t("Unfollow")}
                  </Button>
                ) : (
                  <Button fullWidth variant="solid" color="success" onClick={handleFollow}>
                    {t("Follow")}
                  </Button>
                )}
                <Button variant="solid" color="danger" onClick={handleUnpin}>
                  {t("Unpin")}
                </Button>
              </ButtonGroup>
              <SettingCheckbox settingKey="autoZoom" />
            </>
          ) : (
            <ButtonGroup size={isSmallScreen ? "sm" : "md"}>
              <Button fullWidth variant="solid" color="primary" onClick={handleFollow}>
                {t("Follow")}
              </Button>
              <Button variant="solid" color="neutral" onClick={handlePin}>
                {t("Pin")}
              </Button>
            </ButtonGroup>
          )}
          {showTrainRouteButton &&
            (selectedRoute === train.TrainNoLocal ? (
              <Button
                size="sm"
                endDecorator={
                  <Chip color="danger" variant="solid">
                    BETA
                  </Chip>
                }
                onClick={handleHideRoute}>
                {t("HideRoute")}
              </Button>
            ) : (
              <Button
                color="neutral"
                size="sm"
                endDecorator={
                  <Chip color="danger" variant="solid">
                    BETA
                  </Chip>
                }
                onClick={handleShowRoute}>
                {t("ShowRoute")}
              </Button>
            ))}
        </Stack>
      )}
    </Stack>
  );
};

const LastDelayInfo = ({ lastDelay }: { lastDelay: number }) => {
  const { t } = useTranslation("translation", { keyPrefix: "TrainMakerPopup" });
  const lastDelayColor = useMemo(
    () => (lastDelay ? (lastDelay <= 0 ? "success" : lastDelay < 6 ? "warning" : "danger") : "neutral"),
    [lastDelay],
  );

  return (
    <Stack justifyContent="center" direction="row">
      <Typography level="body-md" color={lastDelayColor} variant="outlined" noWrap textAlign="center">
        {t(lastDelay === 0 ? "OnTime" : lastDelay < 0 ? "Early" : "Delay", {
          delay: moment.duration({ m: lastDelay }).humanize(),
        })}
      </Typography>
    </Stack>
  );
};

export default TrainMarkerPopup;
