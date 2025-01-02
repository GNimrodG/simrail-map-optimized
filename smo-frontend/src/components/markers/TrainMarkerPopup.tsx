import { readLocalStorageValue, useMediaQuery } from "@mantine/hooks";
import Box from "@mui/joy/Box";
import Button from "@mui/joy/Button";
import ButtonGroup from "@mui/joy/ButtonGroup";
import Chip from "@mui/joy/Chip";
import IconButton from "@mui/joy/IconButton";
import LinearProgress from "@mui/joy/LinearProgress";
import Stack from "@mui/joy/Stack";
import Step from "@mui/joy/Step";
import StepIndicator from "@mui/joy/StepIndicator";
import Stepper from "@mui/joy/Stepper";
import { styled, useTheme } from "@mui/joy/styles";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { fetchTimetable, Timetable, Train } from "../../utils/data-manager";
import MapLinesContext from "../../utils/map-lines-context";
import SelectedRouteContext from "../../utils/selected-route-context";
import SelectedTrainContext from "../../utils/selected-train-context";
import { ProfileResponse } from "../../utils/steam";
import { getColorTrainMarker, getDistanceColorForSignal } from "../../utils/ui";
import { useSetting } from "../../utils/use-setting";
import CollapseIcon from "../icons/CollapseIcon";
import ExpandIcon from "../icons/ExpandIcon";
import InfoIcon from "../icons/InfoIcon";
import SettingCheckbox from "../settings/SettingCheckbox";
import SteamProfileDisplay from "../SteamProfileDisplay";
import { getThumbnailUrl } from "../utils/general-utils";
import SignalSpeedDisplay from "../utils/SignalSpeedDisplay";
import LengthIcon from "./icons/LengthIcon";
import SpeedIcon from "./icons/SpeedIcon";
import WeightIcon from "./icons/WeightIcon";
import StationDisplay from "./StationDisplay";
import TrainConsistDisplay from "./TrainConsistDisplay";

export interface TrainMarkerPopupProps {
  train: Train;
  userData?: ProfileResponse | null;
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

const TrainMarkerPopup: FunctionComponent<TrainMarkerPopupProps> = ({
  train,
  userData,
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
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [isTimeTableExpanded, setIsTimeTableExpanded] = useState(
    readLocalStorageValue({ key: "expandScheduleDefault", defaultValue: false }),
  );

  const [hideTrainPictures] = useSetting("hideTrainPictures");
  const [showSpeedInfoCollapsed] = useSetting("showSpeedInfoCollapsed");
  const [showSignalInfoCollapsed] = useSetting("showSignalInfoCollapsed");
  const [showNextStationInfoCollapsed] = useSetting("showNextStationInfoCollapsed");

  const thumbnailUrl = useMemo(() => getThumbnailUrl(train.Vehicles[0]), [train.Vehicles]);

  useEffect(() => {
    let shouldCancel = false;

    fetchTimetable(train.TrainNoLocal).then((timetable) => {
      if (shouldCancel) return;
      setTimetable(timetable);
    });

    return () => {
      shouldCancel = true;
    };
  }, [train.TrainNoLocal]);

  const firstStation = useMemo(() => timetable?.timetable[0], [timetable]);
  const prevStation = useMemo(
    () => timetable?.timetable[train.TrainData.VDDelayedTimetableIndex - 1],
    [timetable, train.TrainData.VDDelayedTimetableIndex],
  );
  const currentStation = useMemo(
    () => timetable?.timetable[train.TrainData.VDDelayedTimetableIndex],
    [timetable, train.TrainData.VDDelayedTimetableIndex],
  );
  const nextStation = useMemo(
    () => timetable?.timetable[train.TrainData.VDDelayedTimetableIndex + 1],
    [timetable, train.TrainData.VDDelayedTimetableIndex],
  );
  const lastStation = useMemo(() => timetable?.timetable[timetable.timetable.length - 1], [timetable]);

  const trainSpeed = (
    <Typography level="body-lg" startDecorator={<SpeedIcon />}>
      <Typography color={getColorTrainMarker(train.TrainData.Velocity)}>
        {Math.round(train.TrainData.Velocity)} km/h
      </Typography>
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

  if (isCollapsed) {
    return (
      <Stack
        spacing={0.5}
        alignItems="center"
        useFlexGap
        sx={{
          width: "14rem",
        }}>
        <Stack spacing={0.5} direction="row" alignItems="center">
          <Typography level="body-lg">
            {train.TrainNoLocal} ({train.TrainName})
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

        {showNextStationInfoCollapsed && currentStation && <StationDisplay station={currentStation} mainStation />}

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
        minWidth: "min(16rem, 90vw)",
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
          }}>
          {train.TrainNoLocal} ({train.TrainName})
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
        <Typography level="body-sm">{train.Vehicles[0]}</Typography>
        <Tooltip
          arrow
          variant="outlined"
          placement="right"
          describeChild
          title={
            <Box
              sx={{
                maxHeight: "90vh",
                overflowY: "auto",
                position: "relative",
              }}>
              <Typography
                level="body-lg"
                textAlign="center"
                sx={{
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  backgroundColor: theme.palette.background.surface,
                  boxShadow: `0px 4px 10px ${theme.palette.background.surface}`,
                }}>
                {t("Consist")}
              </Typography>
              <TrainConsistDisplay consist={train.Vehicles} />
            </Box>
          }>
          <Stack alignItems="center" justifyContent="center">
            <InfoIcon />
          </Stack>
        </Tooltip>
      </Stack>

      <Stack sx={{ width: "100%" }} direction="row" justifyContent="space-around" alignItems="center">
        {trainSpeed}
        {timetable && (
          <Stack sx={{ width: "50%" }} spacing={1} direction="row" justifyContent="space-between" alignItems="center">
            <Typography level="body-md" startDecorator={<LengthIcon />}>
              {timetable.trainLength}m
            </Typography>
            <Typography level="body-md" startDecorator={<WeightIcon />}>
              {timetable.trainWeight}t
            </Typography>
          </Stack>
        )}
      </Stack>

      <Stepper sx={{ width: "100%" }} orientation="vertical">
        <Step
          sx={{
            "--Step-indicatorDotSize": "0.5rem",
          }}
          completed>
          {firstStation ? (
            <StationDisplay station={firstStation} pastStation mainStation />
          ) : (
            <Typography level="body-md">{train.StartStation}</Typography>
          )}
        </Step>
        {currentStation && (
          <>
            {isTimeTableExpanded && prevStation && (
              <Step completed>
                <StationDisplay station={prevStation} pastStation />
              </Step>
            )}
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
              <StationDisplay station={currentStation} mainStation={isTimeTableExpanded} />
            </Step>
            {isTimeTableExpanded && nextStation && (
              <Step>
                <StationDisplay station={nextStation} />
              </Step>
            )}
          </>
        )}
        <Step
          sx={{
            "--Step-indicatorDotSize": "0.5rem",
          }}>
          {lastStation ? (
            <StationDisplay station={lastStation} mainStation />
          ) : (
            <Typography level="body-md">{train.EndStation}</Typography>
          )}
        </Step>
      </Stepper>

      {train.TrainData.InBorderStationArea && (
        <Typography level="body-lg" color="warning" variant="solid" noWrap>
          {t("OOB")}
        </Typography>
      )}

      {signalInfo}

      {userData && train.TrainData.ControlledBySteamID && (
        <SteamProfileDisplay profile={userData} steamId={train.TrainData.ControlledBySteamID} />
      )}

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
                    onClick={() => {
                      setSelectedTrain({ trainNo: selectedTrain.trainNo, follow: false, paused: false });
                      setMapLines(null);
                    }}>
                    {t("Unfollow")}
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    variant="solid"
                    color="success"
                    onClick={() => setSelectedTrain({ trainNo: selectedTrain.trainNo, follow: true, paused: false })}>
                    {t("Follow")}
                  </Button>
                )}
                <Button
                  variant="solid"
                  color="danger"
                  onClick={() => {
                    setSelectedTrain(null);
                    setMapLines(null);
                  }}>
                  {t("Unpin")}
                </Button>
              </ButtonGroup>
              <SettingCheckbox settingKey="autoZoom" />
            </>
          ) : (
            <ButtonGroup size={isSmallScreen ? "sm" : "md"}>
              <Button
                fullWidth
                variant="solid"
                color="primary"
                onClick={() => setSelectedTrain({ trainNo: train.TrainNoLocal, follow: true, paused: false })}>
                {t("Follow")}
              </Button>
              <Button
                variant="solid"
                color="neutral"
                onClick={() => setSelectedTrain({ trainNo: train.TrainNoLocal, follow: false, paused: false })}>
                {t("Pin")}
              </Button>
            </ButtonGroup>
          )}
          {showTrainRouteButton &&
            (selectedRoute !== train.TrainNoLocal ? (
              <Button
                color="neutral"
                size="sm"
                endDecorator={
                  <Chip color="danger" variant="solid">
                    BETA
                  </Chip>
                }
                onClick={() => setSelectedRoute(train.TrainNoLocal)}>
                {t("ShowRoute")}
              </Button>
            ) : (
              <Button
                size="sm"
                endDecorator={
                  <Chip color="danger" variant="solid">
                    BETA
                  </Chip>
                }
                onClick={() => setSelectedRoute(null)}>
                {t("HideRoute")}
              </Button>
            ))}
        </Stack>
      )}
    </Stack>
  );
};

export default TrainMarkerPopup;
