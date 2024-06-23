import { readLocalStorageValue, useLocalStorage, useMediaQuery } from "@mantine/hooks";
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

import { fetchTimetable, Timetable, Train } from "../../utils/data-manager";
import MapLinesContext from "../../utils/map-lines-context";
import SelectedRouteContext from "../../utils/selected-route-context";
import SelectedTrainContext from "../../utils/selected-train-context";
import { ProfileResponse } from "../../utils/steam";
import { getColorTrainMarker, getDistanceColorForSignal } from "../../utils/ui";
import CollapseIcon from "../icons/CollapseIcon";
import ExpandIcon from "../icons/ExpandIcon";
import InfoIcon from "../icons/InfoIcon";
import SteamProfileDisplay from "../SteamProfileDisplay";
import SignalSpeedDisplay from "../utils/SignalSpeedDisplay";
import LengthIcon from "./icons/LengthIcon";
import SpeedIcon from "./icons/SpeedIcon";
import WeightIcon from "./icons/WeightIcon";
import StationDisplay from "./StationDisplay";

export interface TrainMarkerPopupProps {
  train: Train;
  userData?: ProfileResponse | null;
  showTrainRouteButton?: boolean;
  onToggleCollapse?: () => void;
  isCollapsed?: boolean;
}

function getThumbnailUrl(vehicle: string): string {
  return `/thumbnails/vehicles/${vehicle.replace(/.+\/(.+)$/, "$1").replace(" Variant", "")}.png`;
}

const Image = styled("img")(({ theme }) => ({
  width: 300,
  display: "none",
  [`@media (min-height: ${theme.breakpoints.values.md}px) and (min-width: ${theme.breakpoints.values.md}px)`]:
    {
      display: "block",
    },
}));

const TrainMarkerPopup: FunctionComponent<TrainMarkerPopupProps> = ({
  train,
  userData,
  showTrainRouteButton,
  onToggleCollapse,
  isCollapsed,
}) => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(`(max-height: ${theme.breakpoints.values.md}px)`);
  const { selectedTrain, setSelectedTrain } = useContext(SelectedTrainContext);
  const { selectedRoute, setSelectedRoute } = useContext(SelectedRouteContext);
  const { setMapLines } = useContext(MapLinesContext);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [isTimeTableExpanded, setIsTimeTableExpanded] = useState(
    readLocalStorageValue({ key: "expandScheduleDefault", defaultValue: false })
  );

  const [hideTrainPictures] = useLocalStorage({ key: "hideTrainPictures", defaultValue: false });
  const [showSpeedInfoCollapsed] = useLocalStorage({
    key: "showSpeedInfoCollapsed",
    defaultValue: true,
  });
  const [showSignalInfoCollapsed] = useLocalStorage({
    key: "showSignalInfoCollapsed",
    defaultValue: true,
  });
  const [showNextStationInfoCollapsed] = useLocalStorage({
    key: "showNextStationInfoCollapsed",
    defaultValue: false,
  });

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
    [timetable, train.TrainData.VDDelayedTimetableIndex]
  );
  const currentStation = useMemo(
    () => timetable?.timetable[train.TrainData.VDDelayedTimetableIndex],
    [timetable, train.TrainData.VDDelayedTimetableIndex]
  );
  const nextStation = useMemo(
    () => timetable?.timetable[train.TrainData.VDDelayedTimetableIndex + 1],
    [timetable, train.TrainData.VDDelayedTimetableIndex]
  );
  const lastStation = useMemo(
    () => timetable?.timetable[timetable.timetable.length - 1],
    [timetable]
  );

  const trainSpeed = (
    <Typography
      level="body-lg"
      startDecorator={<SpeedIcon />}>
      <Typography color={getColorTrainMarker(train.TrainData.Velocity)}>
        {Math.round(train.TrainData.Velocity)} km/h
      </Typography>
    </Typography>
  );

  const signalInfo = (
    <Stack
      spacing={0.5}
      sx={{ width: "100%" }}>
      {train.TrainData.SignalInFront && (
        <>
          {!isCollapsed && <Typography level="body-sm">Next signal:</Typography>}
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
        <Stack
          spacing={0.5}
          direction="row"
          alignItems="center">
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
              <IconButton
                size="sm"
                onClick={onToggleCollapse}>
                <ExpandIcon />
              </IconButton>
            </Box>
          )}
        </Stack>

        {showSpeedInfoCollapsed && trainSpeed}

        {showNextStationInfoCollapsed && currentStation && (
          <StationDisplay
            station={currentStation}
            mainStation
          />
        )}

        {showSignalInfoCollapsed && (
          <Stack
            direction="row"
            alignItems="center">
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
        maxHeight: "calc(100vh - 6rem)",
        minWidth: "16rem",
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

      {!hideTrainPictures && (
        <Image
          src={thumbnailUrl}
          alt={train.Vehicles[0]}
          title={train.Vehicles[0]}
        />
      )}

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
            <IconButton
              size="sm"
              onClick={onToggleCollapse}>
              <CollapseIcon />
            </IconButton>
          </Box>
        )}
      </Box>

      <Stack
        direction="row"
        spacing={1}
        alignItems="center">
        <Typography level="body-sm">{train.Vehicles[0]}</Typography>
        <Tooltip
          arrow
          variant="outlined"
          placement="right"
          describeChild
          title={
            <>
              <Typography
                level="body-lg"
                textAlign="center">
                Consist
              </Typography>
              <Stack sx={{ p: 1 }}>
                {train.Vehicles.map((vehicle, index) => (
                  <Typography
                    key={vehicle}
                    level="body-md">
                    #{index + 1}: {vehicle}
                  </Typography>
                ))}
              </Stack>
            </>
          }>
          <Stack
            alignItems="center"
            justifyContent="center">
            <InfoIcon />
          </Stack>
        </Tooltip>
      </Stack>

      <Stack
        sx={{ width: "100%" }}
        direction="row"
        justifyContent="space-around"
        alignItems="center">
        {trainSpeed}
        {timetable && (
          <Stack
            sx={{ width: "50%" }}
            spacing={1}
            direction="row"
            justifyContent="space-between"
            alignItems="center">
            <Typography
              level="body-md"
              startDecorator={<LengthIcon />}>
              {timetable.trainLength}m
            </Typography>
            <Typography
              level="body-md"
              startDecorator={<WeightIcon />}>
              {timetable.trainWeight}t
            </Typography>
          </Stack>
        )}
      </Stack>

      <Stepper
        sx={{ width: "100%" }}
        orientation="vertical">
        <Step
          sx={{
            "--Step-indicatorDotSize": "0.5rem",
          }}
          completed>
          {firstStation ? (
            <StationDisplay
              station={firstStation}
              pastStation
              mainStation
            />
          ) : (
            <Typography level="body-md">{train.StartStation}</Typography>
          )}
        </Step>
        {currentStation && (
          <>
            {isTimeTableExpanded && prevStation && (
              <Step completed>
                <StationDisplay
                  station={prevStation}
                  pastStation
                />
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
              <StationDisplay
                station={currentStation}
                mainStation={isTimeTableExpanded}
              />
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
            <StationDisplay
              station={lastStation}
              mainStation
            />
          ) : (
            <Typography level="body-md">{train.EndStation}</Typography>
          )}
        </Step>
      </Stepper>

      {train.TrainData.InBorderStationArea && (
        <Typography
          level="body-lg"
          color="warning"
          variant="solid"
          noWrap>
          Outside of playeable area
        </Typography>
      )}

      {signalInfo}

      {userData && train.TrainData.ControlledBySteamID && (
        <SteamProfileDisplay
          profile={userData}
          steamId={train.TrainData.ControlledBySteamID}
        />
      )}

      <Stack
        spacing={1}
        sx={{ width: "100%" }}>
        {selectedTrain?.trainNo === train.TrainNoLocal ? (
          <ButtonGroup size={isSmallScreen ? "sm" : "md"}>
            {selectedTrain.follow ? (
              <Button
                fullWidth
                variant="solid"
                color="warning"
                onClick={() => {
                  setSelectedTrain({ trainNo: selectedTrain.trainNo, follow: false });
                  setMapLines(null);
                }}>
                Unfollow
              </Button>
            ) : (
              <Button
                fullWidth
                variant="solid"
                color="success"
                onClick={() => setSelectedTrain({ trainNo: selectedTrain.trainNo, follow: true })}>
                Follow
              </Button>
            )}
            <Button
              variant="solid"
              color="danger"
              onClick={() => {
                setSelectedTrain(null);
                setMapLines(null);
              }}>
              Unpin
            </Button>
          </ButtonGroup>
        ) : (
          <ButtonGroup size={isSmallScreen ? "sm" : "md"}>
            <Button
              fullWidth
              variant="solid"
              color="primary"
              onClick={() => setSelectedTrain({ trainNo: train.TrainNoLocal, follow: true })}>
              Follow
            </Button>
            <Button
              variant="solid"
              color="neutral"
              onClick={() => setSelectedTrain({ trainNo: train.TrainNoLocal, follow: false })}>
              Pin
            </Button>
          </ButtonGroup>
        )}
        {showTrainRouteButton &&
          (selectedRoute !== train.TrainNoLocal ? (
            <Button
              color="neutral"
              size="sm"
              endDecorator={
                <Chip
                  color="danger"
                  variant="solid">
                  BETA
                </Chip>
              }
              onClick={() => setSelectedRoute(train.TrainNoLocal)}>
              Show route
            </Button>
          ) : (
            <Button
              size="sm"
              endDecorator={
                <Chip
                  color="danger"
                  variant="solid">
                  BETA
                </Chip>
              }
              onClick={() => setSelectedRoute(null)}>
              Hide route
            </Button>
          ))}
      </Stack>
    </Stack>
  );
};

export default TrainMarkerPopup;
