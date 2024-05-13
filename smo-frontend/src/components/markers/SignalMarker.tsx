import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import { DefaultColorPalette } from "@mui/joy/styles/types";
import Typography from "@mui/joy/Typography";
import { DivIcon, DivIconOptions, Icon, IconOptions } from "leaflet";
import { type FunctionComponent, useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";

import { SignalWithTrain } from "../../utils/data-manager";
import { getDistanceColorForSignal } from "../../utils/ui";
import SignalIcon from "./icons/signals/signal.svg?raw";
import SignalBlockGreenIcon from "./icons/signals/signal-block-green.svg?raw";
import SignalBlockRedIcon from "./icons/signals/signal-block-red.svg?raw";
import SignalBlockYellowIcon from "./icons/signals/signal-block-yellow.svg?raw";
import SignalMain40Icon from "./icons/signals/signal-main-40.svg?raw";
import SignalMain60Icon from "./icons/signals/signal-main-60.svg?raw";
import SignalMain100Icon from "./icons/signals/signal-main-100.svg?raw";
import SignalMainGreenIcon from "./icons/signals/signal-main-green.svg?raw";
import SignalMainRedIcon from "./icons/signals/signal-main-red.svg?raw";
import SignalSmallRedIcon from "./icons/signals/signal-small-red.svg?raw";
import SignalSmallWhiteIcon from "./icons/signals/signal-small-white.svg?raw";

export interface SignalMarkerProps {
  signal: SignalWithTrain;
  onSignalSelect?: (signalId: string) => void;
}

const DEFAULT_ICON_OPTIONS: DivIconOptions = {
  html: SignalIcon,
  iconSize: [14, 14],
  className: "icon signal",
};

const SECONDARY_ICON = new DivIcon({
  ...DEFAULT_ICON_OPTIONS,
  className: `${DEFAULT_ICON_OPTIONS.className} secondary`,
});

const BLOCK_SIGNAL_RED_ICON = new DivIcon({
  ...DEFAULT_ICON_OPTIONS,
  html: SignalBlockRedIcon,
  iconSize: [15.9, 33.3375], // base site 5.3x11.1125 ~x3
});

const BLOCK_SIGNAL_YELLOW_ICON = new DivIcon({
  ...DEFAULT_ICON_OPTIONS,
  html: SignalBlockYellowIcon,
  iconSize: [15.9, 33.3375], // base site 5.3x11.1125 ~x3
});

const BLOCK_SIGNAL_GREEN_ICON = new DivIcon({
  ...DEFAULT_ICON_OPTIONS,
  html: SignalBlockGreenIcon,
  iconSize: [15.9, 33.3375], // base site 5.3x11.1125 ~x3
});

const MAIN_SIGNAL_RED_ICON = new DivIcon({
  ...DEFAULT_ICON_OPTIONS,
  html: SignalMainRedIcon,
  iconSize: [15, 51], // base size 5x17 x3
});

const MAIN_SIGNAL_40_ICON = new DivIcon({
  ...DEFAULT_ICON_OPTIONS,
  html: SignalMain40Icon,
  iconSize: [15, 39.3], // base size 5x13.1 x3
});

const MAIN_SIGNAL_60_ICON = new DivIcon({
  ...DEFAULT_ICON_OPTIONS,
  html: SignalMain60Icon,
  iconSize: [15, 39.3], // base size 5x13.1 x3
});

const MAIN_SIGNAL_100_ICON = new DivIcon({
  ...DEFAULT_ICON_OPTIONS,
  html: SignalMain100Icon,
  iconSize: [15, 39.3], // base size 5x13.1 x3
});

const MAIN_SIGNAL_GREEN_ICON = new DivIcon({
  ...DEFAULT_ICON_OPTIONS,
  html: SignalMainGreenIcon,
  iconSize: [15, 51], // base size 5x17 x2
});

const SMALL_SIGNAL_RED_ICON = new DivIcon({
  ...DEFAULT_ICON_OPTIONS,
  html: SignalSmallRedIcon,
  iconSize: [15, 21.99], // base size 5x7.33 x3
});

const SMALL_SIGNAL_WHITE_ICON = new DivIcon({
  ...DEFAULT_ICON_OPTIONS,
  html: SignalSmallWhiteIcon,
  iconSize: [15, 21.99], // base size 5x7.33 x3
});

function getColor(velocity: number): DefaultColorPalette {
  if (velocity < 10) {
    return "danger";
  } else if (velocity < 120) {
    return "warning";
  }

  return "success";
}

const BLOCK_SIGNAL_REGEX = /^\w\d+_\d+\w?@/;

const SignalMarker: FunctionComponent<SignalMarkerProps> = ({ signal, onSignalSelect }) => {
  const [icon, setIcon] = useState<Icon<Partial<IconOptions>>>(new DivIcon(DEFAULT_ICON_OPTIONS));

  useEffect(() => {
    if (signal.train) {
      if (
        signal.type === "block" ||
        BLOCK_SIGNAL_REGEX.test(signal.train.TrainData.SignalInFront)
      ) {
        if (signal.train.TrainData.SignalInFrontSpeed === 0) {
          setIcon(BLOCK_SIGNAL_RED_ICON);
          return;
        }

        if (signal.nextSignalWithTrainAhead) {
          setIcon(BLOCK_SIGNAL_YELLOW_ICON);
          return;
        }

        if (signal.train.TrainData.SignalInFrontSpeed > 200) {
          setIcon(BLOCK_SIGNAL_GREEN_ICON);
          return;
        }
      }

      if (signal.type === "main") {
        if (signal.train.TrainData.SignalInFrontSpeed > 200) {
          setIcon(MAIN_SIGNAL_GREEN_ICON);
          return;
        }

        if (signal.train.TrainData.SignalInFrontSpeed === 0) {
          setIcon(MAIN_SIGNAL_RED_ICON);
          return;
        }

        if (signal.train.TrainData.SignalInFrontSpeed === 40) {
          setIcon(MAIN_SIGNAL_40_ICON);
          return;
        }

        if (signal.train.TrainData.SignalInFrontSpeed === 60) {
          setIcon(MAIN_SIGNAL_60_ICON);
          return;
        }

        if (signal.train.TrainData.SignalInFrontSpeed === 100) {
          setIcon(MAIN_SIGNAL_100_ICON);
          return;
        }
      }

      if (signal.type === "small") {
        if (signal.train.TrainData.SignalInFrontSpeed === 0) {
          setIcon(SMALL_SIGNAL_RED_ICON);
          return;
        }

        setIcon(SMALL_SIGNAL_WHITE_ICON);
        return;
      }

      setIcon(
        new DivIcon({
          ...DEFAULT_ICON_OPTIONS,
          className: `${DEFAULT_ICON_OPTIONS.className} ${getColor(
            signal.train.TrainData.SignalInFrontSpeed
          )}`,
        })
      );

      return;
    }

    // it's only guaranteed to be red if it's a block signal
    if (signal.trainAhead && signal.type === "block") {
      setIcon(BLOCK_SIGNAL_RED_ICON);
      return;
    }

    if (signal.nextSignalWithTrainAhead) {
      setIcon(BLOCK_SIGNAL_YELLOW_ICON);
      return;
    }

    setIcon(SECONDARY_ICON);
  }, [
    signal.extra,
    signal.trainAhead,
    signal.name,
    signal.train,
    signal.type,
    signal.nextSignalWithTrainAhead,
  ]);

  return (
    <Marker
      key={signal.name}
      position={[signal.lat, signal.lon]}
      icon={icon}>
      <Popup autoPan={false}>
        <Stack
          alignItems="center"
          spacing={1}>
          <Typography level="h3">{signal.name}</Typography>
          {signal.train && (
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
          )}{" "}
          {signal.trainAhead && (
            <Typography level="body-lg">
              Train{" "}
              <Typography
                variant="outlined"
                color="warning">
                {signal.trainAhead.TrainNoLocal} ({signal.trainAhead.TrainName})
              </Typography>{" "}
              is in the <Typography color="warning">block ahead</Typography> going{" "}
              <Typography color={getColor(signal.trainAhead.TrainData.Velocity)}>
                {Math.round(signal.trainAhead.TrainData.Velocity)} km/h
              </Typography>{" "}
              and is{" "}
              <Typography
                color={getDistanceColorForSignal(
                  signal.trainAhead.TrainData.DistanceToSignalInFront
                )}>
                {Math.round(signal.trainAhead.TrainData.DistanceToSignalInFront)}m
              </Typography>{" "}
              away from signal{" "}
              <Chip
                onClick={() =>
                  onSignalSelect?.(signal.trainAhead.TrainData.SignalInFront.split("@")[0])
                }>
                {signal.trainAhead.TrainData.SignalInFront.split("@")[0]}
              </Chip>
              .
            </Typography>
          )}
          {signal.nextSignalWithTrainAhead && (
            <Typography>
              The next signal{" "}
              <Chip onClick={() => onSignalSelect?.(signal.nextSignalWithTrainAhead!)}>
                {signal.nextSignalWithTrainAhead}
              </Chip>{" "}
              has a train in the <Typography color="warning">block ahead</Typography>.
            </Typography>
          )}
          {!signal.train && !signal.trainAhead && !signal.nextSignalWithTrainAhead && (
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
            <Typography level="body-xs">Type: {signal.type || "unknown"}</Typography>
            <Typography level="body-xs">Accuracy: {signal.accuracy}m</Typography>
            <Typography level="body-xs">
              Previous signals:{" "}
              {signal.prevSignals.map((s) => (
                <Chip
                  key={s}
                  onClick={() => onSignalSelect?.(s)}>
                  {s}
                </Chip>
              ))}
            </Typography>
            <Typography level="body-xs">
              Next signals:{" "}
              {signal.nextSignals.map((s) => (
                <Chip
                  key={s}
                  onClick={() => onSignalSelect?.(s)}>
                  {s}
                </Chip>
              ))}
            </Typography>
            <Typography level="body-xs">(Alpha feature, may not be accurate)</Typography>
          </Stack>
        </Stack>
      </Popup>
    </Marker>
  );
};

export default SignalMarker;
