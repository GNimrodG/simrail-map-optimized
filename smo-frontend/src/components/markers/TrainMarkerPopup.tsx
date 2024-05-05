import Button from "@mui/joy/Button";
import ButtonGroup from "@mui/joy/ButtonGroup";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Step from "@mui/joy/Step";
import StepIndicator from "@mui/joy/StepIndicator";
import Stepper from "@mui/joy/Stepper";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useContext, useEffect, useMemo, useState } from "react";

import { fetchTimetable, Timetable, Train } from "../../utils/data-manager";
import SelectedRouteContext from "../../utils/selected-route-context";
import SelectedTrainContext from "../../utils/selected-train-context";
import { ProfileResponse } from "../../utils/steam";
import { getColorTrainMarker, getDistanceColorForSignal } from "../../utils/ui";
import StationDisplay from "../StationDisplay";
import SteamProfileDisplay from "../SteamProfileDisplay";
import CollapseIcon from "./icons/CollapseIcon";
import ExpandIcon from "./icons/ExpandIcon";
import LengthIcon from "./icons/LengthIcon";
import SpeedIcon from "./icons/SpeedIcon";
import WeightIcon from "./icons/WeightIcon";

export interface TrainMarkerPopupProps {
  train: Train;
  userData?: ProfileResponse | null;
  showTrainRouteButton?: boolean;
}

function getThumbnailUrl(vehicle: string): string {
  return `/thumbnails/vehicles/${vehicle.replace(/.+\/(.+)$/, "$1").replace(" Variant", "")}.png`;
}

const TrainMarkerPopup: FunctionComponent<TrainMarkerPopupProps> = ({
  train,
  userData,
  showTrainRouteButton,
}) => {
  const { selectedTrain, setSelectedTrain } = useContext(SelectedTrainContext);
  const { selectedRoute, setSelectedRoute } = useContext(SelectedRouteContext);
  const [timetable, setTimetable] = useState<Timetable | null>(null);
  const [isTimeTableExpanded, setIsTimeTableExpanded] = useState(false);

  const trainRouteName = useMemo(
    () => train.StartStation + "-" + train.EndStation,
    [train.StartStation, train.EndStation]
  );

  const thumbnailUrl = useMemo(() => getThumbnailUrl(train.Vehicles[0]), [train.Vehicles]);

  useEffect(() => {
    fetchTimetable(train.TrainNoLocal).then((timetable) => {
      setTimetable(timetable);
    });
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

  return (
    <Stack
      spacing={1}
      alignItems="center">
      <img
        style={{ width: 300 }}
        src={thumbnailUrl}
        alt={train.Vehicles[0]}
      />
      <Typography level="h3">
        {train.TrainNoLocal} ({train.TrainName})
      </Typography>

      <Stack
        sx={{ width: "100%" }}
        direction="row"
        justifyContent="space-around"
        alignItems="center">
        <Typography
          level="body-lg"
          startDecorator={<SpeedIcon />}>
          <Typography color={getColorTrainMarker(train.TrainData.Velocity)}>
            {Math.round(train.TrainData.Velocity)} km/h
          </Typography>
        </Typography>
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
            "&::after": { bgcolor: "primary.solidBg" },
          }}>
          {firstStation ? (
            <StationDisplay
              station={firstStation}
              mainStation
            />
          ) : (
            <Typography level="body-md">{train.StartStation}</Typography>
          )}
        </Step>
        {currentStation && (
          <>
            {isTimeTableExpanded && prevStation && (
              <Step
                sx={{
                  "&::after": { bgcolor: "primary.solidBg" },
                }}>
                <StationDisplay station={prevStation} />
              </Step>
            )}
            <Step
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
              <StationDisplay station={currentStation} />
            </Step>
            {isTimeTableExpanded && nextStation && (
              <Step>
                <StationDisplay station={nextStation} />
              </Step>
            )}
          </>
        )}
        <Step>
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
      <Stack
        spacing={0.5}
        sx={{ width: "100%" }}>
        <Typography level="body-sm">Next signal:</Typography>
        {train.TrainData.SignalInFront && (
          <Typography level="body-lg">
            {train.TrainData.SignalInFront?.split("@")[0]}{" "}
            {train.TrainData.SignalInFrontSpeed !== null &&
              (train.TrainData.SignalInFrontSpeed > 200 ? (
                <Typography
                  color="success"
                  variant="outlined">
                  VMAX
                </Typography>
              ) : (
                <Typography
                  color={getColorTrainMarker(train.TrainData.SignalInFrontSpeed)}
                  variant="outlined">
                  {Math.round(train.TrainData.SignalInFrontSpeed)} km/h
                </Typography>
              ))}{" "}
            <Typography color={getDistanceColorForSignal(train.TrainData.DistanceToSignalInFront)}>
              {Math.round(train.TrainData.DistanceToSignalInFront)}m
            </Typography>
          </Typography>
        )}
      </Stack>

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
          <ButtonGroup>
            {selectedTrain.follow ? (
              <Button
                fullWidth
                variant="solid"
                color="danger"
                onClick={() => setSelectedTrain({ trainNo: selectedTrain.trainNo, follow: false })}>
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
              fullWidth
              variant="solid"
              color="warning"
              onClick={() => setSelectedTrain(null)}>
              Unpin
            </Button>
          </ButtonGroup>
        ) : (
          <ButtonGroup>
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
          (selectedRoute !== trainRouteName ? (
            <Button
              endDecorator={
                <Chip
                  color="danger"
                  variant="solid">
                  BETA
                </Chip>
              }
              onClick={() => setSelectedRoute(trainRouteName)}>
              Show route
            </Button>
          ) : (
            <Button
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
