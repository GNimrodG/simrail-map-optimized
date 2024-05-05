import Stack from "@mui/joy/Stack";
import { DefaultColorPalette } from "@mui/joy/styles/types";
import Typography from "@mui/joy/Typography";
import { DivIcon, DivIconOptions, Icon, IconOptions } from "leaflet";
import { type FunctionComponent, useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";

import { SignalWithTrain } from "../../utils/data-manager";
import { getDistanceColorForSignal } from "../../utils/ui";
import SignalIcon from "./icons/signal.svg?raw";
import SignalBlockGreenIcon from "./icons/signal-block-green.svg?raw";
import SignalBlockRedIcon from "./icons/signal-block-red.svg?raw";

export interface SignalMarkerProps {
  signal: SignalWithTrain;
}

const DEFAULT_ICON_OPTIONS: DivIconOptions = {
  html: SignalIcon,
  iconSize: [14, 14],
  className: "icon signal",
};

function getColor(velocity: number): DefaultColorPalette {
  if (velocity < 10) {
    return "danger";
  } else if (velocity < 120) {
    return "warning";
  }

  return "success";
}

const BLOCK_SIGNAL_REGEX = /^\w\d+_\d+@/;

const SignalMarker: FunctionComponent<SignalMarkerProps> = ({ signal }) => {
  const [icon, setIcon] = useState<Icon<Partial<IconOptions>>>(new DivIcon(DEFAULT_ICON_OPTIONS));

  useEffect(() => {
    if (signal.train) {
      if (BLOCK_SIGNAL_REGEX.test(signal.train.TrainData.SignalInFront)) {
        if (signal.train.TrainData.SignalInFrontSpeed > 200) {
          setIcon(
            new DivIcon({
              ...DEFAULT_ICON_OPTIONS,
              html: SignalBlockGreenIcon,
              iconSize: [20, 44],
            })
          );
          return;
        }

        if (signal.train.TrainData.SignalInFrontSpeed === 0) {
          setIcon(
            new DivIcon({
              ...DEFAULT_ICON_OPTIONS,
              iconUrl: SignalBlockRedIcon,
              iconSize: [20, 44],
            })
          );
          return;
        }
      }

      setIcon(
        new DivIcon({
          ...DEFAULT_ICON_OPTIONS,
          className: `${DEFAULT_ICON_OPTIONS.className} ${getColor(
            signal.train.TrainData.SignalInFrontSpeed
          )}`,
        })
      );
    } else {
      setIcon(
        new DivIcon({
          ...DEFAULT_ICON_OPTIONS,
          className: `${DEFAULT_ICON_OPTIONS.className} secondary`,
        })
      );
    }
  }, [signal.extra, signal.name, signal.train]);

  return (
    <Marker
      key={signal.name}
      position={[signal.lat, signal.lon]}
      icon={icon}>
      <Popup>
        <Stack
          alignItems="center"
          spacing={1}>
          <Typography level="h3">{signal.name}</Typography>
          {signal.train ? (
            <>
              <Typography level="body-lg">
                Signal speed:{" "}
                {signal.train.TrainData.SignalInFrontSpeed > 200 ? (
                  <Typography color="success">VMAX</Typography>
                ) : (
                  <Typography color={getColor(signal.train.TrainData.SignalInFrontSpeed)}>
                    {Math.round(signal.train.TrainData.SignalInFrontSpeed)} km/h
                  </Typography>
                )}
              </Typography>
              <Typography>
                Train{" "}
                <Typography
                  variant="outlined"
                  color="success">
                  {signal.train.TrainNoLocal} ({signal.train.TrainName})
                </Typography>{" "}
                is approaching this signal at{" "}
                <Typography color={getColor(signal.train.TrainData.Velocity)}>
                  {Math.round(signal.train.TrainData.Velocity)} km/h
                </Typography>{" "}
                and is{" "}
                <Typography
                  color={getDistanceColorForSignal(signal.train.TrainData.DistanceToSignalInFront)}>
                  {Math.round(signal.train.TrainData.DistanceToSignalInFront)}m
                </Typography>{" "}
                away.
              </Typography>
            </>
          ) : (
            <>
              <Typography level="body-lg">No train approaching</Typography>
              <Typography
                level="body-sm"
                textAlign="center">
                We can't show information about signals without a train approaching.
              </Typography>
            </>
          )}
          <Stack
            spacing={0.1}
            alignItems="center">
            <Typography level="body-xs">Extra: {signal.extra}</Typography>
            <Typography level="body-xs">Accuracy: {signal.accuracy}m</Typography>
          </Stack>
        </Stack>
      </Popup>
    </Marker>
  );
};

export default SignalMarker;
