import Chip from "@mui/joy/Chip";
import ChipDelete from "@mui/joy/ChipDelete";
import Stack from "@mui/joy/Stack";
import { DefaultColorPalette } from "@mui/joy/styles/types";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { DivIcon, DivIconOptions, Icon, IconOptions } from "leaflet";
import { type FunctionComponent, useContext, useEffect, useState } from "react";
import { Marker, Popup } from "react-leaflet";

import {
  deleteNextSignal,
  deletePrevSignal,
  deleteSignal,
  signalsData$,
  SignalWithTrain,
  updateSignal,
} from "../../utils/data-manager";
import SignalLinesContext, { SignalLineData } from "../../utils/signal-lines-context";
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

const SignalMarker: FunctionComponent<SignalMarkerProps> = ({ signal, onSignalSelect }) => {
  const [icon, setIcon] = useState<Icon<Partial<IconOptions>>>(new DivIcon(DEFAULT_ICON_OPTIONS));
  const { signalLines, setSignalLines } = useContext(SignalLinesContext);

  useEffect(() => {
    if (signal.train) {
      if (signal.type === "block") {
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

  const showSignalLines = () => {
    const lines: SignalLineData["lines"] = [];
    let i = 0;

    for (const nextSignal of signal.nextSignals) {
      const nextSignalData = signalsData$.value.find((s) => s.name === nextSignal);
      if (nextSignalData) {
        lines.push({
          signal: nextSignal,
          type: "next",
          coords: [
            [signal.lat, signal.lon],
            [nextSignalData.lat, nextSignalData.lon],
          ],
          index: i++,
        });
      }
    }

    for (const prevSignal of signal.prevSignals) {
      const prevSignalData = signalsData$.value.find((s) => s.name === prevSignal);
      if (prevSignalData) {
        lines.push({
          signal: prevSignal,
          type: "prev",
          coords: [
            [signal.lat, signal.lon],
            [prevSignalData.lat, prevSignalData.lon],
          ],
          index: i++,
        });
      }
    }

    setSignalLines({ signal: signal.name, lines });
  };

  const showSignalLinesFurther = () => {
    const MAX_LINES = 100;
    const lines: SignalLineData["lines"] = [];
    let i = 0;

    for (const nextSignal of signal.nextSignals) {
      const nextSignalData = signalsData$.value.find((s) => s.name === nextSignal);
      if (nextSignalData) {
        lines.push({
          signal: nextSignal,
          type: "next",
          coords: [
            [signal.lat, signal.lon],
            [nextSignalData.lat, nextSignalData.lon],
          ],
          index: i++,
        });

        addNextSignalLines(nextSignal, 0);
      }
    }

    for (const prevSignal of signal.prevSignals) {
      const prevSignalData = signalsData$.value.find((s) => s.name === prevSignal);
      if (prevSignalData) {
        lines.push({
          signal: prevSignal,
          type: "prev",
          coords: [
            [signal.lat, signal.lon],
            [prevSignalData.lat, prevSignalData.lon],
          ],
          index: i++,
        });

        addPrevSignalLines(prevSignalData.name, 0);
      }
    }

    function addNextSignalLines(signalName: string, jump: number) {
      const signalData = signalsData$.value.find((s) => s.name === signalName);
      if (!signalData) {
        return;
      }

      for (const nextSignal of signalData.nextSignals) {
        const nextSignalData = signalsData$.value.find((s) => s.name === nextSignal);
        if (nextSignalData) {
          lines.push({
            signal: nextSignal,
            type: "next-further",
            coords: [
              [signalData.lat, signalData.lon],
              [nextSignalData.lat, nextSignalData.lon],
            ],
            index: i++,
          });

          if (lines.length < MAX_LINES / 2) {
            addNextSignalLines(nextSignal, jump + 1);
          }
        }
      }
    }

    function addPrevSignalLines(signalName: string, jump: number) {
      const signalData = signalsData$.value.find((s) => s.name === signalName);
      if (!signalData) {
        return;
      }

      for (const prevSignal of signalData.prevSignals) {
        const prevSignalData = signalsData$.value.find((s) => s.name === prevSignal);
        if (prevSignalData) {
          lines.push({
            signal: prevSignal,
            type: "prev-further",
            coords: [
              [signalData.lat, signalData.lon],
              [prevSignalData.lat, prevSignalData.lon],
            ],
            index: i++,
          });

          if (lines.length < MAX_LINES) {
            addPrevSignalLines(prevSignal, jump + 1);
          }
        }
      }
    }

    setSignalLines({ signal: signal.name, lines });
  };

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
            {signal.role && <Typography level="body-xs">Role: {signal.role}</Typography>}
            <Typography level="body-xs">Accuracy: {signal.accuracy}m</Typography>
            <Typography
              level="body-xs"
              component="div">
              Previous signals:{" "}
              {signal.prevSignals.map((s) => (
                <Chip
                  key={`${signal.name}-prev-${s}`}
                  onClick={() => onSignalSelect?.(s)}
                  endDecorator={
                    localStorage.getItem("adminPassword") && (
                      <ChipDelete onDelete={() => deletePrevSignal(signal.name, s)} />
                    )
                  }>
                  {s}
                </Chip>
              ))}
            </Typography>
            <Typography
              level="body-xs"
              component="div">
              Next signals:{" "}
              {signal.nextSignals.map((s) => (
                <Chip
                  key={`${signal.name}-next-${s}`}
                  onClick={() => onSignalSelect?.(s)}
                  endDecorator={
                    localStorage.getItem("adminPassword") && (
                      <ChipDelete onDelete={() => deleteNextSignal(signal.name, s)} />
                    )
                  }>
                  {s}
                </Chip>
              ))}
            </Typography>
          </Stack>
          {signalLines?.signal === signal.name ? (
            <Chip
              onClick={() => setSignalLines(null)}
              color="warning">
              Hide signal lines
            </Chip>
          ) : (
            <>
              <Tooltip
                variant="outlined"
                placement="top"
                title={
                  <>
                    <Typography sx={{ color: "red" }}>Red: Previous</Typography>
                    <Typography sx={{ color: "orange" }}>Orange: Previous further</Typography>
                    <Typography sx={{ color: "blue" }}>Blue: Next</Typography>
                    <Typography sx={{ color: "purple" }}>Purple: Next further</Typography>
                  </>
                }>
                <Chip onClick={showSignalLines}>Show signal lines</Chip>
              </Tooltip>
              <Tooltip
                color="danger"
                title="Depending on the number of signals, this can be slow">
                <Chip onClick={showSignalLinesFurther}>Show signal lines further</Chip>
              </Tooltip>
            </>
          )}
          {localStorage.getItem("adminPassword") && (
            <>
              <Typography level="body-xs">Admin actions:</Typography>
              <Chip
                color="danger"
                variant="outlined"
                endDecorator={<ChipDelete onDelete={() => deleteSignal(signal.name)} />}>
                Delete this signal
              </Chip>
              {signal.prevFinalized && (
                <Chip
                  onClick={() =>
                    updateSignal(
                      signal.name,
                      signal.type || null,
                      signal.role || null,
                      false,
                      signal.nextFinalized ?? false
                    )
                  }
                  color="warning">
                  Un-finalize previous signals
                </Chip>
              )}
              {!signal.prevFinalized && (
                <Chip
                  onClick={() =>
                    updateSignal(
                      signal.name,
                      signal.type || null,
                      signal.role || null,
                      true,
                      signal.nextFinalized ?? false
                    )
                  }
                  color="success">
                  Finalize previous signals
                </Chip>
              )}
              {signal.nextFinalized && (
                <Chip
                  onClick={() =>
                    updateSignal(
                      signal.name,
                      signal.type || null,
                      signal.role || null,
                      signal.prevFinalized ?? false,
                      false
                    )
                  }
                  color="warning">
                  Un-finalize next signals
                </Chip>
              )}
              {!signal.nextFinalized && (
                <Chip
                  onClick={() =>
                    updateSignal(
                      signal.name,
                      signal.type || null,
                      signal.role || null,
                      signal.prevFinalized ?? false,
                      true
                    )
                  }
                  color="success">
                  Finalize next signals
                </Chip>
              )}
            </>
          )}
          {signal.prevFinalized && signal.nextFinalized ? (
            <Typography
              level="body-xs"
              color="success">
              (This data has been checked and is accurate)
            </Typography>
          ) : (
            <Typography level="body-xs">(Alpha feature, may not be accurate)</Typography>
          )}
        </Stack>
      </Popup>
    </Marker>
  );
};

export default SignalMarker;
