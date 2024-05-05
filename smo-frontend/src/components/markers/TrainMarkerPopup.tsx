import Button from "@mui/joy/Button";
import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useContext, useMemo } from "react";

import { Train } from "../../utils/data-manager";
import SelectedRouteContext from "../../utils/selected-route-context";
import SelectedTrainContext from "../../utils/selected-train-context";
import { ProfileResponse } from "../../utils/steam";
import { getColorTrainMarker, getDistanceColorForSignal } from "../../utils/ui";
import SteamProfileDisplay from "../SteamProfileDisplay";

export interface TrainMarkerPopupProps {
  train: Train;
  userData?: ProfileResponse | null;
  showTrainRouteButton?: boolean;
}

const TrainMarkerPopup: FunctionComponent<TrainMarkerPopupProps> = ({
  train,
  userData,
  showTrainRouteButton,
}) => {
  const { selectedTrain, setSelectedTrain } = useContext(SelectedTrainContext);
  const { selectedRoute, setSelectedRoute } = useContext(SelectedRouteContext);

  const trainRouteName = useMemo(
    () => train.StartStation + "-" + train.EndStation,
    [train.StartStation, train.EndStation]
  );

  return (
    <Stack
      spacing={1}
      alignItems="center">
      <Typography level="h3">
        {train.TrainNoLocal} ({train.TrainName})
      </Typography>
      <Stack
        spacing={1}
        sx={{ width: "100%" }}>
        <Typography level="body-lg">From: {train.StartStation}</Typography>
        <Typography level="body-lg">To: {train.EndStation}</Typography>
        <Typography level="body-md">
          Speed:{" "}
          <Typography color={getColorTrainMarker(train.TrainData.Velocity)}>
            {Math.round(train.TrainData.Velocity)} km/h
          </Typography>
        </Typography>
      </Stack>
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
        {selectedTrain === train.TrainNoLocal ? (
          <Button
            onClick={() => setSelectedTrain(null)}
            color="warning">
            Unfollow
          </Button>
        ) : (
          <Button onClick={() => setSelectedTrain(train.TrainNoLocal)}>Follow</Button>
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
      {userData && train.TrainData.ControlledBySteamID && (
        <SteamProfileDisplay
          profile={userData}
          steamId={train.TrainData.ControlledBySteamID}
        />
      )}
    </Stack>
  );
};

export default TrainMarkerPopup;
