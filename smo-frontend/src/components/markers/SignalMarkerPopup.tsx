import Chip from "@mui/joy/Chip";
import ChipDelete from "@mui/joy/ChipDelete";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useCallback, useContext, useMemo, useTransition } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useMap } from "react-leaflet";

import { dataProvider } from "../../utils/data-manager.ts";
import { findStationForSignal, goToStation } from "../../utils/geom-utils.ts";
import MapLinesContext, { MapLineData } from "../../utils/map-lines-context";
import { SignalStatus, Train } from "../../utils/types.ts";
import { getDistanceColorForSignal, getSpeedColorForSignal } from "../../utils/ui";
import Loading from "../Loading.tsx";

export interface SignalMarkerPopupProps {
  signal: SignalStatus;
  onSignalSelect?: (signalId: string) => void;

  trains: Train[] | null;
  trainsAhead?: Train[] | null;
}

const SPEED_COLORS: Record<number, string> = {
  32767: "#00FF00", // green (VMAX)
  130: "#00FF00", // green
  100: "#FFFF00", // yellow
  60: "#FFA500", // orange
  40: "#FF0000", // red
  20: "#FFFFFF", // white
};

/**
 * Darken a hex color by a percentage
 * @param color - hex color
 * @param percent - percentage to darken in range [0, 100]
 */
function darkenColor(color: string, percent: number): string {
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

const SignalMarkerPopup: FunctionComponent<SignalMarkerPopupProps> = ({
  signal,
  onSignalSelect,
  trains,
  trainsAhead: _trainsAhead,
}) => {
  const map = useMap();
  const { t } = useTranslation("translation", { keyPrefix: "SignalMarker" });
  const { mapLines, setMapLines } = useContext(MapLinesContext);
  const [isPending, startTransition] = useTransition();

  const trainsAhead = useMemo(
    () =>
      typeof _trainsAhead === "undefined"
        ? (signal.TrainsAhead &&
            dataProvider.trainsData$.value.filter((t) => signal.TrainsAhead?.includes(t.TrainNoLocal))) ||
          null
        : _trainsAhead,
    [signal.TrainsAhead, _trainsAhead],
  );

  const showSignalLines = useCallback(() => {
    const lines: MapLineData["lines"] = [];
    let i = 0;

    for (const nextSignal of signal.NextSignals) {
      const nextSignalData = dataProvider.signalsData$.value.find((s) => s.Name === nextSignal.Name);
      if (nextSignalData) {
        lines.push({
          label: `${signal.Name} -> ${nextSignal.Name} (${nextSignal.Vmax != null ? (nextSignal.Vmax === 32767 ? "VMAX" : nextSignal.Vmax + " km/h") : "?"})`,
          color: NEXT_COLOR,
          color2: (nextSignal.Vmax && SPEED_COLORS[nextSignal.Vmax]) || undefined,
          coords: [
            [signal.Location.Y, signal.Location.X],
            [nextSignalData.Location.Y, nextSignalData.Location.X],
          ],
          index: i++,
        });
      }
    }

    for (const prevSignal of signal.PrevSignals) {
      const prevSignalData = dataProvider.signalsData$.value.find((s) => s.Name === prevSignal.Name);
      if (prevSignalData) {
        lines.push({
          label: `${prevSignal.Name} -> ${signal.Name} (${prevSignal.Vmax != null ? (prevSignal.Vmax === 32767 ? "VMAX" : prevSignal.Vmax + " km/h") : "?"})`,
          color: PREV_COLOR,
          color2: (prevSignal.Vmax && SPEED_COLORS[prevSignal.Vmax]) || undefined,
          coords: [
            [signal.Location.Y, signal.Location.X],
            [prevSignalData.Location.Y, prevSignalData.Location.X],
          ],
          index: i++,
        });
      }
    }

    setMapLines({ signal: signal.Name, lines });
  }, [signal.Location.Y, signal.Location.X, signal.Name, signal.NextSignals, signal.PrevSignals, setMapLines]);

  const showSignalLinesFurther = useCallback(() => {
    const MAX_LAYER = 20;
    const MAX_STACK_SIZE = 10;
    const lines: MapLineData["lines"] = [];
    let counter = 0;

    {
      let stack = [signal];
      let newStack: SignalStatus[] = [];
      let layer = 0;

      while (stack.length > 0 && layer < MAX_LAYER) {
        for (const signal of stack) {
          for (const nextSignal of signal.NextSignals) {
            const prevSignalData = dataProvider.signalsData$.value.find((s) => s.Name === nextSignal.Name);
            if (prevSignalData) {
              lines.push({
                label: `${signal.Name} -> ${nextSignal.Name} (${nextSignal.Vmax != null ? (nextSignal.Vmax === 32767 ? "VMAX" : nextSignal.Vmax + " km/h") : "?"})`,
                color: darkenColor(layer % 2 === 0 ? NEXT_COLOR : NEXT_FURTHER_COLOR, (layer / MAX_LAYER) * 100),
                color2: (nextSignal.Vmax && SPEED_COLORS[nextSignal.Vmax]) || undefined,
                coords: [
                  [signal.Location.Y, signal.Location.X],
                  [prevSignalData.Location.Y, prevSignalData.Location.X],
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
      let newStack: SignalStatus[] = [];
      let layer = 0;

      while (stack.length > 0 && layer < MAX_LAYER) {
        for (const signal of stack) {
          for (const prevSignal of signal.PrevSignals) {
            const prevSignalData = dataProvider.signalsData$.value.find((s) => s.Name === prevSignal.Name);
            if (prevSignalData) {
              lines.push({
                label: `${prevSignal.Name} -> ${signal.Name} (${prevSignal.Vmax != null ? (prevSignal.Vmax === 32767 ? "VMAX" : prevSignal.Vmax + " km/h") : "?"})`,
                color: darkenColor(layer % 2 === 0 ? PREV_COLOR : PREV_FURTHER_COLOR, (layer / MAX_LAYER) * 100),
                color2: (prevSignal.Vmax && SPEED_COLORS[prevSignal.Vmax]) || undefined,
                coords: [
                  [signal.Location.Y, signal.Location.X],
                  [prevSignalData.Location.Y, prevSignalData.Location.X],
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

    setMapLines({ signal: signal.Name, lines });
  }, [setMapLines, signal]);

  const station = useMemo(() => findStationForSignal(signal.Name), [signal.Name]);

  const handleTrainAheadSignalClick = useCallback(() => {
    onSignalSelect?.(trainsAhead![0].TrainData.SignalInFront.split("@")[0]);
  }, [onSignalSelect, trainsAhead]);

  const handleNextSignalWithTrainAheadClick = useCallback(() => {
    onSignalSelect?.(signal.NextSignalWithTrainAhead!);
  }, [onSignalSelect, signal.NextSignalWithTrainAhead]);

  const handleGoToStation = useCallback(() => {
    goToStation(station!, map);
  }, [station, map]);

  const signalSelectHandlers = useMemo(
    () =>
      Object.fromEntries(
        [...signal.PrevSignals, ...signal.NextSignals].map((s) => [s, () => onSignalSelect?.(s.Name)]),
      ),
    [signal.PrevSignals, signal.NextSignals, onSignalSelect],
  );

  const prevSignalDeleteHandlers = useMemo(
    () =>
      Object.fromEntries(signal.PrevSignals.map((s) => [s, () => dataProvider.deletePrevSignal(signal.Name, s.Name)])),
    [signal.PrevSignals, signal.Name],
  );

  const nextSignalDeleteHandlers = useMemo(
    () =>
      Object.fromEntries(signal.NextSignals.map((s) => [s, () => dataProvider.deleteNextSignal(signal.Name, s.Name)])),
    [signal.NextSignals, signal.Name],
  );

  const handleHideSignalLines = useCallback(() => setMapLines(null), [setMapLines]);

  const handleUnFinalizePrev = useCallback(() => {
    dataProvider.markSignalPrevFinalized(signal.Name, false);
  }, [signal]);

  const handleFinalizePrev = useCallback(() => {
    dataProvider.markSignalPrevFinalized(signal.Name, true);
  }, [signal]);

  const handleUnFinalizeNext = useCallback(() => {
    dataProvider.markSignalNextFinalized(signal.Name, false);
  }, [signal]);

  const handleFinalizeNext = useCallback(() => {
    dataProvider.markSignalNextFinalized(signal.Name, true);
  }, [signal]);

  return (
    <>
      {isPending && <Loading color="warning" />}
      <Stack alignItems="center" spacing={1}>
        <Typography level="h3">{signal.Name}</Typography>
        {!!trains?.length && (
          <>
            <Typography level="body-lg">
              {t("SignalSpeed")}
              {trains[0].TrainData.SignalInFrontSpeed > 200 ? (
                <Typography color="success">VMAX</Typography>
              ) : (
                <Typography color={getSpeedColorForSignal(trains[0].TrainData.SignalInFrontSpeed)}>
                  {Math.round(trains[0].TrainData.SignalInFrontSpeed)} km/h
                </Typography>
              )}
            </Typography>
            <Typography textAlign="center">
              <Trans
                i18nKey="SignalMarker.TrainApproaching"
                values={{
                  ...trains[0],
                  Velocity: Math.round(trains[0].TrainData.Velocity),
                  DistanceToSignalInFront: Math.round(trains[0].TrainData.DistanceToSignalInFront),
                }}
                components={[
                  <Typography key="train-no" variant="outlined" color="success">
                    {trains.map((t) => `${t.TrainNoLocal} (${t.TrainName})`).join(" & ")}
                  </Typography>,
                  <Typography key="train-velocity" color={getSpeedColorForSignal(trains[0].TrainData.Velocity)} />,
                  <Typography
                    key="train-distance"
                    color={getDistanceColorForSignal(trains[0].TrainData.DistanceToSignalInFront)}
                  />,
                ]}
              />
            </Typography>
          </>
        )}{" "}
        {!!trainsAhead?.length && (
          <Typography level="body-lg" textAlign="center">
            <Trans
              i18nKey="SignalMarker.TrainAhead"
              values={{
                ...trainsAhead[0],
                Velocity: Math.round(trainsAhead[0].TrainData.Velocity),
                DistanceToSignalInFront: Math.round(trainsAhead[0].TrainData.DistanceToSignalInFront),
                SignalName: trainsAhead[0].TrainData.SignalInFront.split("@")[0],
              }}
              components={[
                <Typography key="trainAhead-train-no" variant="outlined" color="warning" />,
                <Typography key="trainAhead-warning" color="warning" />,
                <Typography
                  key="trainAhead-train-velocity"
                  color={getSpeedColorForSignal(trainsAhead[0].TrainData.Velocity)}
                />,
                <Typography
                  key="trainAhead-train-distance"
                  color={getDistanceColorForSignal(trainsAhead[0].TrainData.DistanceToSignalInFront)}
                />,
                <Chip key="trainAhead-signal" onClick={handleTrainAheadSignalClick} />,
              ]}
            />
          </Typography>
        )}
        {signal.NextSignalWithTrainAhead && (
          <Typography textAlign="center">
            <Trans
              i18nKey="SignalMarker.NextSignalWithTrainAhead"
              values={{ nextSignalWithTrainAhead: signal.NextSignalWithTrainAhead }}
              components={[
                <Chip key="NextSignalWithTrainAhead-signal" onClick={handleNextSignalWithTrainAheadClick} />,
                <Typography key="NextSignalWithTrainAhead-warning" color="warning" />,
              ]}
            />
          </Typography>
        )}
        {!trains && !trainsAhead && !signal.NextSignalWithTrainAhead && (
          <>
            <Typography level="body-lg">{t("NoTrainApproaching.Title")}</Typography>
            <Typography level="body-sm" textAlign="center">
              {t("NoTrainApproaching.Description")}
            </Typography>
          </>
        )}
        <Stack spacing={0.1} alignItems="center">
          {signal.Type === "main" && (
            <Stack direction="row" alignItems="center" gap={1}>
              <Typography level="body-xs">{t("Station")}</Typography>
              {station ? (
                <Chip onClick={handleGoToStation}>{station.Name}</Chip>
              ) : (
                <Typography level="body-xs">{t("Unknown")}</Typography>
              )}
            </Stack>
          )}
          <Typography level="body-xs">
            {t("Extra")} {signal.Extra}
          </Typography>
          <Typography level="body-xs">
            {t("Type")} {signal.Type || t("Unknown")}
          </Typography>
          {signal.Role && (
            <Typography level="body-xs">
              {t("Role")} {signal.Role}
            </Typography>
          )}
          <Typography level="body-xs">
            {t("Accuracy")} {signal.Accuracy} m
          </Typography>
          {!!signal.PrevSignals?.length && (
            <Stack direction="row" alignItems="center" justifyContent="center" gap={0.5} flexWrap="wrap">
              <Typography level="body-xs" component="div">
                {t("PreviousSignals") + ": "}
              </Typography>
              {signal.PrevSignals.map((s) => (
                <Chip
                  key={`${signal.Name}-prev-${s.Name}`}
                  onClick={signalSelectHandlers[s.Name]}
                  endDecorator={
                    localStorage.getItem("adminPassword") && <ChipDelete onDelete={prevSignalDeleteHandlers[s.Name]} />
                  }>
                  {s.Name} ({s.Vmax != null ? (s.Vmax === 32767 ? "VMAX" : s.Vmax + " km/h") : "?"})
                </Chip>
              ))}
            </Stack>
          )}
          {!!signal.NextSignals?.length && (
            <Stack direction="row" alignItems="center" justifyContent="center" gap={0.5} flexWrap="wrap">
              <Typography level="body-xs" component="div">
                {t("NextSignals") + ": "}
              </Typography>
              {signal.NextSignals.map((s) => (
                <Chip
                  key={`${signal.Name}-next-${s.Name}`}
                  onClick={signalSelectHandlers[s.Name]}
                  endDecorator={
                    localStorage.getItem("adminPassword") && <ChipDelete onDelete={nextSignalDeleteHandlers[s.Name]} />
                  }>
                  {s.Name} ({s.Vmax != null ? (s.Vmax === 32767 ? "VMAX" : s.Vmax + " km/h") : "?"})
                </Chip>
              ))}
            </Stack>
          )}
        </Stack>
        {mapLines?.signal === signal.Name ? (
          <Chip onClick={handleHideSignalLines} color="warning">
            {t("HideSignalLines")}
          </Chip>
        ) : (
          !!(signal.PrevSignals?.length || signal.NextSignals?.length) && (
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
                <Chip onClick={() => startTransition(() => showSignalLines())}>{t("ShowSignalLines")}</Chip>
              </Tooltip>
              <Tooltip color="danger" title={t("ShowSignalLinesFurther.Title")}>
                <Chip onClick={() => startTransition(() => showSignalLinesFurther())}>
                  {t("ShowSignalLinesFurther.Description")}
                </Chip>
              </Tooltip>
            </>
          )
        )}
        {localStorage.getItem("adminPassword") && (
          <>
            <Typography level="body-xs">{t("AdminActions.Title")}</Typography>
            <Chip
              color="danger"
              variant="outlined"
              endDecorator={<ChipDelete onDelete={() => dataProvider.deleteSignal(signal.Name)} />}>
              {t("AdminActions.DeleteSignal")}
            </Chip>
            {signal.PrevFinalized && (
              <Chip onClick={handleUnFinalizePrev} color="warning">
                {t("AdminActions.UnFinalizePrev")}
              </Chip>
            )}
            {!signal.PrevFinalized && !!signal.PrevSignals?.length && (
              <Chip onClick={handleFinalizePrev} color="success">
                {t("AdminActions.FinalizePrev")}
              </Chip>
            )}
            {signal.NextFinalized && (
              <Chip onClick={handleUnFinalizeNext} color="warning">
                {t("AdminActions.UnFinalizeNext")}
              </Chip>
            )}
            {!signal.NextFinalized && !!signal.NextSignals?.length && (
              <Chip onClick={handleFinalizeNext} color="success">
                {t("AdminActions.FinalizeNext")}
              </Chip>
            )}
          </>
        )}
        {signal.PrevFinalized && signal.NextFinalized ? (
          <Typography level="body-xs" color="success" textAlign="center">
            {t("Footer.Finalized")}
          </Typography>
        ) : (
          <Typography level="body-xs" textAlign="center">
            {t("Footer.UnFinalized")}
          </Typography>
        )}
      </Stack>
    </>
  );
};

export default SignalMarkerPopup;
