import { useDebouncedValue } from "@mantine/hooks";
import Box from "@mui/joy/Box";
import Chip from "@mui/joy/Chip";
import DialogTitle from "@mui/joy/DialogTitle";
import Divider from "@mui/joy/Divider";
import IconButton from "@mui/joy/IconButton";
import Input from "@mui/joy/Input";
import LinearProgress from "@mui/joy/LinearProgress";
import Modal from "@mui/joy/Modal";
import ModalClose from "@mui/joy/ModalClose";
import ModalDialog from "@mui/joy/ModalDialog";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import Tooltip from "@mui/joy/Tooltip";
import Typography from "@mui/joy/Typography";
import {
  type FunctionComponent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useMap } from "react-leaflet";
import { filter } from "rxjs";

import useBehaviorSubj from "../../hooks/useBehaviorSubj";
import useSubject from "../../hooks/useSubject";
import { dataProvider } from "../../utils/data-manager";
import { calculateLastKnownDelay, calculatePredictedDelay } from "../../utils/delay-prediction";
import { findStationForSignal } from "../../utils/geom-utils";
import SelectedTrainContext from "../../utils/selected-train-context";
import { timeSubj$ } from "../../utils/time";
import { Timetable, TimetableEntry, Train } from "../../utils/types";
import { getColorTrainMarker, getDistanceColorForSignal, getSpeedColorForSignal } from "../../utils/ui";
import BoxesStackedIcon from "../icons/boxes-stacked.svg?react";
import InfoIcon from "../icons/InfoIcon";
import MapMarkerIcon from "../icons/map-location-dot-solid.svg?react";
import LengthIcon from "../markers/icons/LengthIcon";
import SpeedIcon from "../markers/icons/SpeedIcon";
import WeightIcon from "../markers/icons/WeightIcon";
import StationDisplay from "../markers/station/StationDisplay";
import TrainConsistDisplay from "../markers/train/TrainConsistDisplay";
import TrainMarkerPopup from "../markers/train/TrainMarkerPopup";
import TrainTimetableModal from "../timetable/TrainTimetableModal";
import TrainTypeDisplay from "../utils/TrainTypeDisplay";

interface TrainOverviewState {
  train: Train;
  timetable: Timetable | null | undefined;
  currentStop: TimetableEntry | null;
  nextStop: TimetableEntry | null;
  previousStop: TimetableEntry | null;
  departureDelay: number | null;
  isPredictedDelay: boolean;
  lastDelay: number | null;
  delayed: boolean;
  insideStation: boolean;
  passedBasedOnDepartureTime: boolean;
}

const timeSubjEvery10s$ = timeSubj$.pipe(filter((_, index) => index % 10 === 0));

function getStationDisplayName(entry: TimetableEntry | null | undefined): string | null {
  if (!entry) return null;
  return entry.NameForPerson || entry.NameOfPoint || null;
}

function isEntryPast(entry: TimetableEntry | null, currentTime: Date): boolean {
  if (!entry) return false;
  const referenceTime = entry.DepartureTime ?? entry.ArrivalTime;
  if (!referenceTime) return false;
  return new Date(referenceTime) < currentTime;
}

const ServerTrainListModal: FunctionComponent = () => {
  const { t } = useTranslation("translation", { keyPrefix: "ServerTrainList" });
  const selectedServer = useBehaviorSubj(dataProvider.selectedServerData$);
  const trains = useBehaviorSubj(dataProvider.trainsData$);
  const map = useMap();
  const { setSelectedTrain } = useContext(SelectedTrainContext);

  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch] = useDebouncedValue(search, 300);

  const [trainTimetables, setTrainTimetables] = useState<Record<string, Timetable | null>>({});
  const [isLoadingTimetables, setIsLoadingTimetables] = useState(false);
  const fetchingTrainNosRef = useRef<Set<string>>(new Set());

  const currentTimeEpoch = useSubject(timeSubjEvery10s$, timeSubj$.value);
  const currentTime = useMemo(() => new Date(currentTimeEpoch), [currentTimeEpoch]);

  useEffect(() => {
    if (!isOpen || !trains.length) {
      setIsLoadingTimetables(false);
      return;
    }

    const missingTrainNos = trains
      .map((train) => train.TrainNoLocal)
      .filter((trainNo) => {
        return !(trainNo in trainTimetables) && !fetchingTrainNosRef.current.has(trainNo);
      });

    if (!missingTrainNos.length) {
      setIsLoadingTimetables(false);
      return;
    }

    let cancelled = false;
    const fetchingSet = fetchingTrainNosRef.current;
    setIsLoadingTimetables(true);

    // Mark these trains as being fetched
    for (const trainNo of missingTrainNos) {
      fetchingSet.add(trainNo);
    }

    // Track how many fetches are still pending
    let pendingCount = missingTrainNos.length;

    // Fetch each timetable independently and update state progressively
    for (const trainNo of missingTrainNos) {
      dataProvider
        .fetchTimetable(trainNo)
        .then((timetable) => {
          if (!cancelled) {
            // Update state immediately as each timetable loads
            setTrainTimetables((prev) => ({ ...prev, [trainNo]: timetable }));
          }
        })
        .catch((error) => {
          if (!cancelled) {
            console.error(`Failed to fetch timetable for train ${trainNo}:`, error);
            // Still update state with null to indicate fetch completed
            setTrainTimetables((prev) => ({ ...prev, [trainNo]: null }));
          }
        })
        .finally(() => {
          if (!cancelled) {
            fetchingSet.delete(trainNo);
            pendingCount--;
            // Only turn off loading when all fetches complete
            if (pendingCount === 0) {
              setIsLoadingTimetables(false);
            }
          }
        });
    }

    return () => {
      cancelled = true;
      setIsLoadingTimetables(false);
      for (const trainNo of missingTrainNos) {
        fetchingSet.delete(trainNo);
      }
    };
  }, [isOpen, trains, trainTimetables]);

  const panToTrain = useCallback(
    (train: Train) => {
      map.flyTo({ lat: train.TrainData.Latitude, lng: train.TrainData.Longitude }, 18, {
        animate: true,
        duration: 0.75,
      });
      setSelectedTrain({ trainNo: train.TrainNoLocal, follow: false, paused: false });
    },
    [map, setSelectedTrain],
  );

  const filteredTrains = useMemo(() => {
    if (!debouncedSearch) return trains;
    const searchLower = debouncedSearch.toLowerCase();
    return trains.filter((train) =>
      [train.TrainNoLocal, train.TrainName, train.StartStation, train.EndStation, train.TrainType, ...train.Vehicles]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(searchLower)),
    );
  }, [trains, debouncedSearch]);

  const trainStates = useMemo<TrainOverviewState[]>(() => {
    return filteredTrains
      .map((train) => {
        const timetable = trainTimetables[train.TrainNoLocal];
        const trainDelays = dataProvider.getDelaysForTrainSync(train.Id) ?? {};
        const lastDelay = Object.values(trainDelays).length ? Object.values(trainDelays).at(-1)! : null;

        let currentStop: TimetableEntry | null = null;
        let nextStop: TimetableEntry | null = null;
        let previousStop: TimetableEntry | null = null;
        let departureDelay: number | null = null;
        let isPredictedDelay = false;

        const entries = timetable?.TimetableEntries;

        if (entries?.length) {
          const safeTimetable = timetable as Timetable;
          const maxIndex = entries.length - 1;
          const timetableIndex = Math.max(0, train.TrainData.VDDelayedTimetableIndex);
          const hasNotPassedCurrent = trainDelays[timetableIndex] === undefined;

          const currentIndex = Math.min(hasNotPassedCurrent ? timetableIndex : timetableIndex + 1, maxIndex);
          const nextIndex = Math.min(currentIndex + 1, maxIndex);
          const prevIndex = Math.max(currentIndex - 1, 0);

          currentStop = entries[currentIndex] ?? null;
          nextStop = entries[nextIndex] ?? null;
          previousStop = entries[prevIndex] ?? null;

          if (currentStop) {
            departureDelay = trainDelays[currentIndex] ?? null;

            if (departureDelay === null) {
              const lastKnownDelay = calculateLastKnownDelay(trainDelays, timetableIndex);
              const predictedDelay = calculatePredictedDelay(
                currentIndex,
                lastKnownDelay,
                timetableIndex,
                safeTimetable,
              );

              if (predictedDelay !== null) {
                departureDelay = predictedDelay;
                isPredictedDelay = true;
              }
            } else if (currentIndex === timetableIndex) {
              // For current station, if the calculated delay is less than last known delay,
              // use last known delay as predicted
              const lastKnownDelay = calculateLastKnownDelay(trainDelays, timetableIndex);
              if (lastKnownDelay !== null && departureDelay < lastKnownDelay) {
                departureDelay = lastKnownDelay;
                isPredictedDelay = true;
              }
            }
          }
        }

        const passedBasedOnDepartureTime = currentStop ? isEntryPast(currentStop, currentTime) : false;
        const delayed =
          (departureDelay !== null && departureDelay >= 300) ||
          (!passedBasedOnDepartureTime && lastDelay !== null && lastDelay >= 300);

        const insideStation = (() => {
          if (!train.TrainData.SignalInFront || !currentStop) return false;
          const signalStation = findStationForSignal(train.TrainData.SignalInFront.split("@")[0]);
          if (!signalStation) return false;
          const candidateNames = [
            getStationDisplayName(currentStop),
            getStationDisplayName(nextStop),
            getStationDisplayName(previousStop),
          ];
          return candidateNames.some((name) => name && signalStation.Name === name);
        })();

        return {
          train,
          timetable,
          currentStop,
          nextStop,
          previousStop,
          departureDelay,
          isPredictedDelay,
          lastDelay,

          delayed,
          insideStation,
          passedBasedOnDepartureTime,
        } satisfies TrainOverviewState;
      })
      .sort((a, b) => a.train.TrainNoLocal.localeCompare(b.train.TrainNoLocal));
  }, [filteredTrains, trainTimetables, currentTime]);

  const statusTranslations = useTranslation("translation", { keyPrefix: "TrainTimetable" });

  const getCardBorderColor = useCallback((state: TrainOverviewState) => {
    // Priority order: delayed > insideStation > neutral
    if (state.delayed) return "warning.outlinedBorder";
    if (state.insideStation) return "primary.outlinedBorder";
    return undefined; // Use default border color
  }, []);

  const renderStatusBadges = useCallback(
    (state: TrainOverviewState): ReactNode => {
      const badges: ReactNode[] = [];

      if (state.delayed) {
        badges.push(
          <Chip key="status-delayed" size="sm" variant="soft" color="warning">
            {statusTranslations.t("Delayed")}
          </Chip>,
        );
      }

      if (state.insideStation) {
        badges.push(
          <Tooltip
            key="status-inside"
            arrow
            variant="outlined"
            title={
              <Stack direction="row" spacing={1} alignItems="center">
                <InfoIcon />
                <Typography>
                  {statusTranslations.t("InsideStation.Full", {
                    stationName: getStationDisplayName(state.currentStop) ?? statusTranslations.t("N/A"),
                  })}
                </Typography>
              </Stack>
            }>
            <Chip size="sm" variant="solid" color="primary">
              {statusTranslations.t("InsideStation.ShortGlobal")}
            </Chip>
          </Tooltip>,
        );
      }

      return badges.length ? (
        <Stack direction="row" spacing={0.5} useFlexGap alignItems="center" flexWrap="wrap">
          {badges}
        </Stack>
      ) : null;
    },
    [statusTranslations],
  );

  return (
    <>
      <Tooltip title={t("ButtonTooltip")} placement="left" variant="outlined" arrow>
        <IconButton
          variant="outlined"
          color="neutral"
          sx={{ backgroundColor: "var(--joy-palette-background-surface)" }}
          onClick={() => setIsOpen((prev) => !prev)}>
          <BoxesStackedIcon />
        </IconButton>
      </Tooltip>

      <Modal open={isOpen} onClose={() => setIsOpen(false)}>
        <ModalDialog
          sx={{
            width: "min(1100px, 95vw)",
            maxHeight: "90vh",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}>
          <ModalClose variant="plain" />
          <Stack spacing={1.5} sx={{ height: "100%", flex: 1, overflow: "hidden" }}>
            <DialogTitle component="div">{t("Title", { server: selectedServer?.ServerName })}</DialogTitle>

            <Input
              variant="soft"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("SearchPlaceholder")}
              slotProps={{ input: { "aria-label": t("SearchPlaceholder") } }}
            />

            {isLoadingTimetables && <LinearProgress variant="soft" thickness={2} />}

            <Box sx={{ flex: 1, overflowY: "auto", pr: 1 }}>
              {trainStates.length ? (
                <Stack spacing={1.5}>
                  {trainStates.map((state) => {
                    const { train, timetable, currentStop, nextStop, departureDelay, isPredictedDelay } = state;

                    const remainingStations = nextStop ? [getStationDisplayName(nextStop)].filter(Boolean) : [];

                    // Get delays for the timetable modal
                    const trainDelays = dataProvider.getDelaysForTrainSync(train.Id) ?? {};

                    const consistSummary = (() => {
                      if (!train.Vehicles?.length) return null;

                      const counts = train.Vehicles.reduce((acc, vehicle) => {
                        const [shortName] = vehicle.split("/");
                        const key = (shortName ?? vehicle).trim();
                        if (!key) return acc;
                        const current = acc.get(key) ?? 0;
                        acc.set(key, current + 1);
                        return acc;
                      }, new Map<string, number>());

                      if (counts.size === 0) return null;

                      return Array.from(counts.entries())
                        .map(([name, count]) => (count > 1 ? `${count}x ${name}` : name))
                        .join(" + ");
                    })();

                    const infoChips: ReactNode[] = [
                      ...(consistSummary
                        ? [
                            <Tooltip
                              key="consist"
                              arrow
                              variant="outlined"
                              placement="right"
                              describeChild
                              title={<TrainConsistDisplay consist={train.Vehicles} />}>
                              <Chip size="sm" variant="soft" startDecorator={<InfoIcon />}>
                                {t("ConsistLabel", { summary: consistSummary })}
                              </Chip>
                            </Tooltip>,
                          ]
                        : []),
                      ...(timetable
                        ? [
                            <Chip key="route" size="sm" variant="outlined">
                              {`${train.StartStation} -> ${train.EndStation}`}
                            </Chip>,
                            <Chip key="length" size="sm" variant="soft" startDecorator={<LengthIcon />}>
                              {`${timetable.TrainLength} m`}
                            </Chip>,
                            <Chip key="weight" size="sm" variant="soft" startDecorator={<WeightIcon />}>
                              {`${timetable.TrainWeight} t`}
                            </Chip>,
                          ]
                        : []),
                    ];

                    const speedChip = (
                      <Chip
                        key="speed"
                        size="sm"
                        variant="soft"
                        startDecorator={<SpeedIcon />}
                        color={getColorTrainMarker(train.TrainData.Velocity)}>
                        {`${Math.round(train.TrainData.Velocity)} km/h`}
                      </Chip>
                    );

                    const controlChip = (
                      <Chip
                        key="control"
                        size="sm"
                        variant="soft"
                        color={train.TrainData.ControlledBySteamID ? "success" : "neutral"}>
                        {train.TrainData.ControlledBySteamID ? t("PlayerControlled") : t("AIControlled")}
                      </Chip>
                    );

                    const signalChip = (() => {
                      if (!train.TrainData.SignalInFront) return null;
                      const baseSignalName = train.TrainData.SignalInFront.split("@")[0];
                      const signalSpeed = train.TrainData.SignalInFrontSpeed;
                      const signalSpeedColor = getSpeedColorForSignal(signalSpeed ?? 0);
                      const signalDistanceColor = getDistanceColorForSignal(train.TrainData.DistanceToSignalInFront);

                      return (
                        <Chip
                          key="signal"
                          size="sm"
                          variant="outlined"
                          sx={{
                            "& .speed": { color: `${signalSpeedColor}.plainColor`, fontWeight: 600 },
                            "& .distance": { color: `${signalDistanceColor}.plainColor`, fontWeight: 300 },
                          }}>
                          {baseSignalName}
                          {signalSpeed === null ? null : (
                            <span className="speed"> ({signalSpeed === 32767 ? "VMAX" : `${signalSpeed} km/h`})</span>
                          )}
                          <span className="distance">{` ${Math.round(train.TrainData.DistanceToSignalInFront)} m`}</span>
                        </Chip>
                      );
                    })();

                    return (
                      <Sheet
                        key={train.TrainNoLocal}
                        variant="outlined"
                        sx={{
                          borderRadius: "sm",
                          p: 1.5,
                          display: "flex",
                          flexDirection: "column",
                          gap: 1,
                          borderColor: getCardBorderColor(state),
                        }}>
                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          useFlexGap
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", sm: "center" }}>
                          <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                            <Stack direction="row" spacing={1} useFlexGap alignItems="center" flexWrap="wrap">
                              <Typography
                                fontFamily="monospace"
                                level="title-md"
                                variant="outlined"
                                color={getColorTrainMarker(train.TrainData.Velocity)}>
                                {train.TrainNoLocal}
                              </Typography>
                              <Typography fontFamily="monospace" level="body-sm" component="div">
                                <TrainTypeDisplay type={train.TrainType} displayName={train.TrainName} hideTooltip />
                              </Typography>
                              <Tooltip
                                variant="outlined"
                                describeChild
                                enterDelay={300}
                                title={<TrainMarkerPopup train={train} hideButtons />}
                                arrow>
                                <Stack
                                  alignItems="center"
                                  justifyContent="center"
                                  sx={{
                                    color: train.TrainData.ControlledBySteamID ? "success.plainColor" : "neutral.500",
                                    cursor: "pointer",
                                  }}>
                                  <InfoIcon />
                                </Stack>
                              </Tooltip>
                              <Tooltip variant="outlined" describeChild title={t("PanToTrain")} arrow>
                                <Stack
                                  alignItems="center"
                                  justifyContent="center"
                                  sx={{ cursor: "pointer" }}
                                  onClick={() => panToTrain(train)}>
                                  <MapMarkerIcon />
                                </Stack>
                              </Tooltip>
                              <TrainTimetableModal
                                trainNoLocal={train.TrainNoLocal}
                                hideTimeUntil={state.passedBasedOnDepartureTime}
                                delays={trainDelays as unknown as number[]}
                                timetableIndex={train.TrainData.VDDelayedTimetableIndex}
                              />
                            </Stack>

                            {renderStatusBadges(state)}
                          </Stack>

                          <Stack spacing={0.25} alignItems={{ xs: "flex-start", sm: "flex-end" }}>
                            <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                              {statusTranslations.t("NextStationLabel")}
                            </Typography>
                            {currentStop ? (
                              <StationDisplay
                                station={currentStop}
                                mainStation
                                pastStation={state.passedBasedOnDepartureTime}
                                delay={departureDelay ?? undefined}
                                predictedDelay={isPredictedDelay}
                                hideTimeUntil={state.passedBasedOnDepartureTime}
                              />
                            ) : (
                              <Typography fontFamily="monospace" level="title-md">
                                {statusTranslations.t("N/A")}
                              </Typography>
                            )}
                            {remainingStations.length > 0 && (
                              <Typography fontFamily="monospace" level="body-sm" sx={{ color: "neutral.500" }}>
                                {remainingStations.join(", ")}
                              </Typography>
                            )}
                          </Stack>
                        </Stack>

                        {(infoChips.length > 0 || speedChip || controlChip || signalChip) && <Divider />}

                        <Stack
                          direction={{ xs: "column", sm: "row" }}
                          spacing={1}
                          useFlexGap
                          justifyContent="space-between"
                          alignItems={{ xs: "flex-start", sm: "center" }}>
                          <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap">
                            {infoChips}
                          </Stack>
                          <Stack
                            direction="row"
                            spacing={0.75}
                            useFlexGap
                            flexWrap="wrap"
                            alignItems="center"
                            justifyContent="flex-end">
                            {signalChip}
                            {controlChip}
                            {speedChip}
                          </Stack>
                        </Stack>

                        {!timetable && !isLoadingTimetables && (
                          <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                            {t("TimetableUnavailable")}
                          </Typography>
                        )}
                      </Sheet>
                    );
                  })}
                </Stack>
              ) : (
                <Typography level="body-sm" sx={{ color: "neutral.500" }}>
                  {t("EmptyState")}
                </Typography>
              )}
            </Box>
          </Stack>
        </ModalDialog>
      </Modal>
    </>
  );
};

export default ServerTrainListModal;
