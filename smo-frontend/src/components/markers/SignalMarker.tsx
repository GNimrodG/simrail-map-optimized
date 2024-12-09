import Chip from "@mui/joy/Chip";
import ChipDelete from "@mui/joy/ChipDelete";
import Stack from "@mui/joy/Stack";
import { DefaultColorPalette } from "@mui/joy/styles/types";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { DivIcon, DivIconOptions, Icon, IconOptions } from "leaflet";
import { type FunctionComponent, useContext, useEffect, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { Marker, Popup } from "react-leaflet";

import {
  deleteNextSignal,
  deletePrevSignal,
  deleteSignal,
  signalsData$,
  SignalWithTrain,
  updateSignal,
} from "../../utils/data-manager";
import MapLinesContext, { MapLineData } from "../../utils/map-lines-context";
import { getDistanceColorForSignal } from "../../utils/ui";
import SignalIcon from "./icons/signals/signal.svg?raw";

export interface SignalMarkerProps {
  signal: SignalWithTrain;
  onSignalSelect?: (signalId: string) => void;
  opacity?: number;
}

const className = "icon signal";

const DEFAULT_ICON_OPTIONS: DivIconOptions = {
  html: SignalIcon,
  iconSize: [14, 14],
  className,
};

const SECONDARY_ICON = new DivIcon({
  ...DEFAULT_ICON_OPTIONS,
  className: `${DEFAULT_ICON_OPTIONS.className} secondary`,
});

const BLOCK_SIGNAL_RED_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-block-red.svg",
  iconSize: [15.9, 33.3375], // base site 5.3x11.1125 ~x3
});

const BLOCK_SIGNAL_YELLOW_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-block-yellow.svg",
  iconSize: [15.9, 33.3375], // base site 5.3x11.1125 ~x3
});

const BLOCK_SIGNAL_GREEN_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-block-green.svg",
  iconSize: [15.9, 33.3375], // base site 5.3x11.1125 ~x3
});

const MAIN_SIGNAL_RED_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-red.svg",
  iconSize: [15, 51], // base size 5x17 x3
});

const MAIN_SIGNAL_40_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-40.svg",
  iconSize: [15, 39.3], // base size 5x13.1 x3
});

const MAIN_SIGNAL_60_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-60.svg",
  iconSize: [15, 39.3], // base size 5x13.1 x3
});

const MAIN_SIGNAL_100_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-100.svg",
  iconSize: [15, 39.3], // base size 5x13.1 x3
});

const MAIN_SIGNAL_GREEN_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-green.svg",
  iconSize: [15, 51], // base size 5x17 x2
});

const SMALL_SIGNAL_RED_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-small-red.svg",
  iconSize: [15, 21.99], // base size 5x7.33 x3
});

const SMALL_SIGNAL_WHITE_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-small-white.svg",
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

/**
 * Darken a hex color by a percentage
 * @param color - hex color
 * @param percent - percentage to darken in range [0, 100]
 */
function darkenColor(color: string, percent: number): string {
  console.log(color, percent);
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = ((num >> 8) & 0x00ff) - amt;
  const B = (num & 0x0000ff) - amt;

  return `#${(
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  )
    .toString(16)
    .slice(1)}`;
}

const NEXT_COLOR = "#0000FF";
const NEXT_FURTHER_COLOR = "#800080";
const PREV_COLOR = "#FF0000";
const PREV_FURTHER_COLOR = "#FFA500";

const SignalMarker: FunctionComponent<SignalMarkerProps> = ({ signal, onSignalSelect, opacity = 1 }) => {
  const { t } = useTranslation("translation", { keyPrefix: "SignalMarker" });
  const [icon, setIcon] = useState<Icon<DivIconOptions | IconOptions>>(new DivIcon(DEFAULT_ICON_OPTIONS));
  const { mapLines, setMapLines } = useContext(MapLinesContext);

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
          className: `${DEFAULT_ICON_OPTIONS.className} ${getColor(signal.train.TrainData.SignalInFrontSpeed)}`,
        }),
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
  }, [signal.extra, signal.trainAhead, signal.name, signal.train, signal.type, signal.nextSignalWithTrainAhead]);

  const showSignalLines = () => {
    const lines: MapLineData["lines"] = [];
    let i = 0;

    for (const nextSignal of signal.nextSignals) {
      const nextSignalData = signalsData$.value.find((s) => s.name === nextSignal);
      if (nextSignalData) {
        lines.push({
          label: nextSignal,
          color: NEXT_COLOR,
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
          label: prevSignal,
          color: PREV_COLOR,
          coords: [
            [signal.lat, signal.lon],
            [prevSignalData.lat, prevSignalData.lon],
          ],
          index: i++,
        });
      }
    }

    setMapLines({ signal: signal.name, lines });
  };

  const showSignalLinesFurther = () => {
    const MAX_LAYER = 20;
    const MAX_STACK_SIZE = 10;
    const lines: MapLineData["lines"] = [];
    let counter = 0;

    {
      let stack = [signal];
      let newStack: SignalWithTrain[] = [];
      let layer = 0;

      while (stack.length > 0 && layer < MAX_LAYER) {
        for (const signal of stack) {
          for (const nextSignal of signal.nextSignals) {
            const prevSignalData = signalsData$.value.find((s) => s.name === nextSignal);
            if (prevSignalData) {
              lines.push({
                label: nextSignal,
                color: darkenColor(layer % 2 === 0 ? NEXT_COLOR : NEXT_FURTHER_COLOR, (layer / MAX_LAYER) * 100),
                coords: [
                  [signal.lat, signal.lon],
                  [prevSignalData.lat, prevSignalData.lon],
                ],
                index: counter++,
              });

              if (newStack.length < MAX_STACK_SIZE) {
                newStack.push(prevSignalData);
              }
            }
          }
        }

        stack = newStack;
        newStack = [];
        layer++;
      }
    }

    {
      let stack = [signal];
      let newStack: SignalWithTrain[] = [];
      let layer = 0;

      while (stack.length > 0 && layer < MAX_LAYER) {
        for (const signal of stack) {
          for (const prevSignal of signal.prevSignals) {
            const prevSignalData = signalsData$.value.find((s) => s.name === prevSignal);
            if (prevSignalData) {
              lines.push({
                label: prevSignal,
                color: darkenColor(layer % 2 === 0 ? PREV_COLOR : PREV_FURTHER_COLOR, (layer / MAX_LAYER) * 100),
                coords: [
                  [signal.lat, signal.lon],
                  [prevSignalData.lat, prevSignalData.lon],
                ],
                index: counter++,
              });

              if (newStack.length < MAX_STACK_SIZE) {
                newStack.push(prevSignalData);
              }
            }
          }
        }

        stack = newStack;
        newStack = [];
        layer++;
      }
    }

    setMapLines({ signal: signal.name, lines });
  };

  return (
    <Marker opacity={opacity} key={signal.name} position={[signal.lat, signal.lon]} icon={icon}>
      <Popup autoPan={false}>
        <Stack alignItems="center" spacing={1}>
          <Typography level="h3">{signal.name}</Typography>
          {signal.train && (
            <>
              <Typography level="body-lg">
                {t("SignalSpeed")}
                {signal.train.TrainData.SignalInFrontSpeed > 200 ? (
                  <Typography color="success">VMAX</Typography>
                ) : (
                  <Typography color={getColor(signal.train.TrainData.SignalInFrontSpeed)}>
                    {Math.round(signal.train.TrainData.SignalInFrontSpeed)} km/h
                  </Typography>
                )}
              </Typography>
              <Typography>
                <Trans
                  i18nKey="SignalMarker.TrainApproaching"
                  values={{
                    ...signal.train,
                    Velocity: Math.round(signal.train.TrainData.Velocity),
                    DistanceToSignalInFront: Math.round(signal.train.TrainData.DistanceToSignalInFront),
                  }}
                  components={[
                    <Typography key="train-no" variant="outlined" color="success">
                      {signal.train.TrainNoLocal} ({signal.train.TrainName})
                    </Typography>,
                    <Typography key="train-velocity" color={getColor(signal.train.TrainData.Velocity)} />,
                    <Typography
                      key="train-distance"
                      color={getDistanceColorForSignal(signal.train.TrainData.DistanceToSignalInFront)}
                    />,
                  ]}
                />
              </Typography>
            </>
          )}{" "}
          {signal.trainAhead && (
            <Typography level="body-lg">
              <Trans
                i18nKey="SignalMarker.TrainAhead"
                values={{
                  ...signal.trainAhead,
                  Velocity: Math.round(signal.trainAhead.TrainData.Velocity),
                  DistanceToSignalInFront: Math.round(signal.trainAhead.TrainData.DistanceToSignalInFront),
                  SignalName: signal.trainAhead.TrainData.SignalInFront.split("@")[0],
                }}
                components={[
                  <Typography key="trainAhead-train-no" variant="outlined" color="warning" />,
                  <Typography key="trainAhead-warning" color="warning" />,
                  <Typography key="trainAhead-train-velocity" color={getColor(signal.trainAhead.TrainData.Velocity)} />,
                  <Typography
                    key="trainAhead-train-distance"
                    color={getDistanceColorForSignal(signal.trainAhead.TrainData.DistanceToSignalInFront)}
                  />,
                  <Chip
                    key="trainAhead-signal"
                    onClick={() => onSignalSelect?.(signal.trainAhead.TrainData.SignalInFront.split("@")[0])}
                  />,
                ]}
              />
            </Typography>
          )}
          {signal.nextSignalWithTrainAhead && (
            <Typography>
              <Trans
                i18nKey="SignalMarker.NextSignalWithTrainAhead"
                values={{ nextSignalWithTrainAhead: signal.nextSignalWithTrainAhead }}
                components={[
                  <Chip
                    key="nextSignalWithTrainAhead-signal"
                    onClick={() => onSignalSelect?.(signal.nextSignalWithTrainAhead!)}
                  />,
                  <Typography key="nextSignalWithTrainAhead-warning" color="warning" />,
                ]}
              />
            </Typography>
          )}
          {!signal.train && !signal.trainAhead && !signal.nextSignalWithTrainAhead && (
            <>
              <Typography level="body-lg">{t("NoTrainApproaching.Title")}</Typography>
              <Typography level="body-sm" textAlign="center">
                {t("NoTrainApproaching.Description")}
              </Typography>
            </>
          )}
          <Stack spacing={0.1} alignItems="center">
            <Typography level="body-xs">
              {t("Extra")} {signal.extra}
            </Typography>
            <Typography level="body-xs">
              {t("Type")} {signal.type || t("Unknown")}
            </Typography>
            {signal.role && (
              <Typography level="body-xs">
                {t("Role")} {signal.role}
              </Typography>
            )}
            <Typography level="body-xs">
              {t("Accuracy")} {signal.accuracy} m
            </Typography>
            <Typography level="body-xs" component="div">
              {t("PreviousSignals") + ": "}
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
            <Typography level="body-xs" component="div">
              {t("NextSignals") + ": "}
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
          {mapLines?.signal === signal.name ? (
            <Chip onClick={() => setMapLines(null)} color="warning">
              {t("HideSignalLines")}
            </Chip>
          ) : (
            <>
              <Tooltip
                variant="outlined"
                placement="top"
                title={
                  <>
                    <Typography>
                      <Typography sx={{ color: "red" }}>{t("Red")}</Typography>/
                      <Typography sx={{ color: "orange" }}>{t("Orange")}</Typography>: {t("PreviousSignals")}
                    </Typography>
                    <Typography>
                      <Typography sx={{ color: "blue" }}>{t("Blue")}</Typography>/
                      <Typography sx={{ color: "purple" }}>{t("Purple")}</Typography>: {t("NextSignals")}
                    </Typography>
                  </>
                }>
                <Chip onClick={showSignalLines}>{t("ShowSignalLines")}</Chip>
              </Tooltip>
              <Tooltip color="danger" title={t("ShowSignalLinesFurther.Title")}>
                <Chip onClick={showSignalLinesFurther}>{t("ShowSignalLinesFurther.Description")}</Chip>
              </Tooltip>
            </>
          )}
          {localStorage.getItem("adminPassword") && (
            <>
              <Typography level="body-xs">{t("AdminActions.Title")}</Typography>
              <Chip
                color="danger"
                variant="outlined"
                endDecorator={<ChipDelete onDelete={() => deleteSignal(signal.name)} />}>
                {t("AdminActions.DeleteSignal")}
              </Chip>
              {signal.prevFinalized && (
                <Chip
                  onClick={() =>
                    updateSignal(
                      signal.name,
                      signal.type || null,
                      signal.role || null,
                      false,
                      signal.nextFinalized ?? false,
                    )
                  }
                  color="warning">
                  {t("AdminActions.UnFinalizePrev")}
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
                      signal.nextFinalized ?? false,
                    )
                  }
                  color="success">
                  {t("AdminActions.FinalizePrev")}
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
                      false,
                    )
                  }
                  color="warning">
                  {t("AdminActions.UnFinalizeNext")}
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
                      true,
                    )
                  }
                  color="success">
                  {t("AdminActions.FinalizeNext")}
                </Chip>
              )}
            </>
          )}
          {signal.prevFinalized && signal.nextFinalized ? (
            <Typography level="body-xs" color="success">
              {t("Footer.Finalized")}
            </Typography>
          ) : (
            <Typography level="body-xs">{t("Footer.UnFinalized")}</Typography>
          )}
        </Stack>
      </Popup>
    </Marker>
  );
};

export default SignalMarker;
