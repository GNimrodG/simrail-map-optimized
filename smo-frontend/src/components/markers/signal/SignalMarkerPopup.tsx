import Chip from "@mui/joy/Chip";
import ChipDelete from "@mui/joy/ChipDelete";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import { type FunctionComponent, useCallback, useContext, useEffect, useMemo, useState, useTransition } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useMap } from "react-leaflet";

import { dataProvider } from "../../../utils/data-manager.ts";
import { findStationForSignal, goToStation } from "../../../utils/geom-utils.ts";
import MapLinesContext, { MapLineData } from "../../../utils/map-lines-context.ts";
import {
  calculateFurtherSignalLines,
  calculateSignalConnectionLines,
  calculateSignalDirectLines,
} from "../../../utils/signal-lines.ts";
import { SignalStatus, Train } from "../../../utils/types.ts";
import { getDistanceColorForSignal, getSpeedColorForSignal } from "../../../utils/ui.ts";
import Loading from "../../Loading.tsx";

export interface SignalMarkerPopupProps {
  signal: SignalStatus;
  onSignalSelect?: (signalId: string) => void;

  trains: Train[] | null;
  trainsAhead?: Train[] | null;
}

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
  const [isLoading, setIsLoading] = useState(false);
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [isAltPressed, setIsAltPressed] = useState(false);

  useEffect(() => {
    const updateModifiers = (event: KeyboardEvent) => {
      setIsShiftPressed(event.shiftKey);
      setIsAltPressed(event.altKey);
    };

    const handleBlur = () => {
      setIsShiftPressed(false);
      setIsAltPressed(false);
    };

    window.addEventListener("keydown", updateModifiers);
    window.addEventListener("keyup", updateModifiers);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", updateModifiers);
      window.removeEventListener("keyup", updateModifiers);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  const showSignalLinesLabel = useMemo(() => {
    const baseLabel = t("ShowSignalLines");

    if (isShiftPressed) {
      return t("ShowSignalLinesModifiers.ConnectionsOnly", { base: baseLabel });
    }

    if (isAltPressed) {
      return t("ShowSignalLinesModifiers.DirectOnly", { base: baseLabel });
    }

    return baseLabel;
  }, [isAltPressed, isShiftPressed, t]);

  const showSignalLinesFurtherLabel = useMemo(() => {
    const baseLabel = t("ShowSignalLinesFurther.Description");

    if (isShiftPressed) {
      return t("ShowSignalLinesModifiers.ConnectionsOnly", { base: baseLabel });
    }

    if (isAltPressed) {
      return t("ShowSignalLinesModifiers.DirectOnly", { base: baseLabel });
    }

    return baseLabel;
  }, [isAltPressed, isShiftPressed, t]);

  const trainsAhead = useMemo(
    () =>
      typeof _trainsAhead === "undefined"
        ? (signal.TrainsAhead &&
            dataProvider.trainsData$.value.filter((t) => signal.TrainsAhead?.includes(t.TrainNoLocal))) ||
          null
        : _trainsAhead,
    [signal.TrainsAhead, _trainsAhead],
  );

  const showSignalLines = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      setIsLoading(true);
      const includeDirect = !e.shiftKey;
      const includeConnections = !e.altKey;
      const signalsData = dataProvider.signalsData$.value;
      const getLinesForConnection = (from: string, to: string) => dataProvider.getLinesForSignalConnection(from, to);
      let combinedLines: MapLineData["lines"] = [];
      let nextIndex = 0;

      try {
        if (includeDirect) {
          const { lines, nextIndex: updatedIndex } = calculateSignalDirectLines({
            signal,
            signalsData,
            startIndex: nextIndex,
          });

          combinedLines = lines;
          nextIndex = updatedIndex;
          setMapLines({ signal: signal.Name, lines: combinedLines });
        }

        if (includeConnections) {
          const { lines } = await calculateSignalConnectionLines({
            signal,
            signalsData,
            getLinesForConnection,
            startIndex: nextIndex,
          });

          combinedLines = includeDirect ? [...combinedLines, ...lines] : lines;
          setMapLines({ signal: signal.Name, lines: combinedLines });
        }
      } catch (error) {
        console.warn(`Failed to prepare lines for signal ${signal.Name}`, error);
      } finally {
        setIsLoading(false);
      }
    },
    [signal, setMapLines],
  );

  const showSignalLinesFurther = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      setIsLoading(true);

      try {
        const { lines } = await calculateFurtherSignalLines({
          signal,
          signalsData: dataProvider.signalsData$.value,
          getLinesForConnection: (from, to) => dataProvider.getLinesForSignalConnection(from, to),
          skipDirect: e.shiftKey,
          skipConnections: e.altKey,
        });

        setMapLines({ signal: signal.Name, lines });
      } catch (error) {
        console.warn(`Failed to get further lines for signal ${signal.Name}`, error);
      } finally {
        setIsLoading(false);
      }
    },
    [setMapLines, signal],
  );

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
        [...signal.PrevSignals, ...signal.NextSignals].map((s) => [s.Name, () => onSignalSelect?.(s.Name)]),
      ),
    [signal.PrevSignals, signal.NextSignals, onSignalSelect],
  );

  const prevSignalDeleteHandlers = useMemo(
    () =>
      Object.fromEntries(
        signal.PrevSignals.map((s) => [s.Name, () => dataProvider.deletePrevSignal(signal.Name, s.Name)]),
      ),
    [signal.PrevSignals, signal.Name],
  );

  const nextSignalDeleteHandlers = useMemo(
    () =>
      Object.fromEntries(
        signal.NextSignals.map((s) => [s.Name, () => dataProvider.deleteNextSignal(signal.Name, s.Name)]),
      ),
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
      {(isPending || isLoading) && <Loading color="warning" />}
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
                <Chip
                  onClick={(e) =>
                    startTransition(() => {
                      showSignalLines(e);
                    })
                  }
                  disabled={isPending || isLoading || (isShiftPressed && isAltPressed)}>
                  {showSignalLinesLabel}
                </Chip>
              </Tooltip>
              <Tooltip color="danger" title={t("ShowSignalLinesFurther.Title")}>
                <Chip
                  onClick={(e) =>
                    startTransition(() => {
                      showSignalLinesFurther(e);
                    })
                  }
                  disabled={isPending || isLoading || (isShiftPressed && isAltPressed)}>
                  {showSignalLinesFurtherLabel}
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
