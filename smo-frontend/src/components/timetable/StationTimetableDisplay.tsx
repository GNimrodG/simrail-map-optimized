import { useLocalStorage } from "@mantine/hooks";
import Chip from "@mui/joy/Chip";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import moment from "moment";
import { type FunctionComponent, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMap } from "react-leaflet";
import { filter } from "rxjs";

import { useSetting } from "../../hooks/useSetting";
import useSubject from "../../hooks/useSubject";
import { dataProvider } from "../../utils/data-manager";
import { calculateLastKnownDelay, calculatePredictedDelay } from "../../utils/delay-prediction";
import { findStationForSignal } from "../../utils/geom-utils";
import SelectedTrainContext from "../../utils/selected-train-context";
import { timeSubj$ } from "../../utils/time";
import { SimplifiedTimtableEntry, Timetable, Train } from "../../utils/types";
import StationTimetableCardsView from "./StationTimetableCardsView";
import StationTimetableGroupedView from "./StationTimetableGroupedView";
import type { EntryRenderState } from "./StationTimetableTableView";
import StationTimetableTableView from "./StationTimetableTableView";

export interface StationTimetableDisplayProps {
  timetable: SimplifiedTimtableEntry[];
  onClose?: () => void;
  isCollapsed?: boolean;
}

const BUFFER_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds

type ViewMode = "table" | "cards" | "grouped";
type ViewModeSetting = ViewMode | "lastUsed";

const VIEW_MODE_SETTING_OPTIONS: readonly ViewModeSetting[] = ["table", "cards", "grouped", "lastUsed"] as const;

const isViewModeSetting = (value: string): value is ViewModeSetting =>
  (VIEW_MODE_SETTING_OPTIONS as readonly string[]).includes(value);

const resolveViewModeFromSetting = (setting: ViewModeSetting, lastUsedView: ViewMode): ViewMode =>
  setting === "lastUsed" ? lastUsedView : setting;

function isPastStation(entry: SimplifiedTimtableEntry, currentTime: Date): boolean {
  if (!entry.departureTime) return false;

  const departureTime = new Date(entry.departureTime);
  return departureTime < currentTime;
}

const timeSubjEvery10s$ = timeSubj$.pipe(filter((_, index) => index % 10 === 0));

function isTrainAtPrevStation(
  train: Train | undefined,
  entry: SimplifiedTimtableEntry,
  trainDelays: Record<number, number> | null,
) {
  return (
    (train?.TrainData.VDDelayedTimetableIndex === entry.index && !trainDelays?.[entry.index]) ||
    (train?.TrainData.VDDelayedTimetableIndex === entry.index - 1 && !!trainDelays?.[entry.index - 1]) ||
    !!entry.subStationEntries?.some(
      (subEntry) => subEntry.index === entry.index && !trainDelays?.[subEntry.index] && !trainDelays?.[subEntry.index],
    ) ||
    !!entry.subStationEntries?.some(
      (subEntry) => subEntry.index === entry.index - 1 && !!trainDelays?.[subEntry.index - 1],
    )
  );
}

const StationTimetableDisplay: FunctionComponent<StationTimetableDisplayProps> = ({
  timetable,
  onClose,
  isCollapsed,
}) => {
  const map = useMap();
  const { setSelectedTrain } = useContext(SelectedTrainContext);
  const { t: tSettings } = useTranslation("translation", {
    keyPrefix: "Settings.stationTimetableDefaultViewMode.Options",
  });
  const currentTimeEpoch = useSubject(timeSubjEvery10s$, timeSubj$.value);
  const currentTime = useMemo(() => new Date(currentTimeEpoch), [currentTimeEpoch]);

  // Cache timetables for trains
  const [trainTimetables, setTrainTimetables] = useState<Record<string, Timetable>>({});
  const [defaultViewModeSettingRaw] = useSetting("stationTimetableDefaultViewMode");
  const defaultViewModeSetting: ViewModeSetting = useMemo(() => {
    return isViewModeSetting(defaultViewModeSettingRaw) ? defaultViewModeSettingRaw : "table";
  }, [defaultViewModeSettingRaw]);
  const [storedViewMode, setStoredViewMode] = useLocalStorage<ViewMode>({
    key: "stationTimetable:lastViewMode",
    defaultValue: "table",
  });
  const [activeViewMode, setActiveViewMode] = useState<ViewMode>(() =>
    resolveViewModeFromSetting(defaultViewModeSetting, storedViewMode),
  );

  useEffect(() => {
    const resolvedMode = resolveViewModeFromSetting(defaultViewModeSetting, storedViewMode);
    setActiveViewMode((current) => (current === resolvedMode ? current : resolvedMode));
  }, [defaultViewModeSetting, storedViewMode]);

  const setViewMode = useCallback(
    (mode: ViewMode) => {
      setActiveViewMode((current) => (current === mode ? current : mode));
      setStoredViewMode((current) => (current === mode ? current : mode));
    },
    [setStoredViewMode],
  );

  // Fetch timetables for visible trains
  useEffect(() => {
    const trainNumbers = new Set(timetable.map((entry) => entry.trainNoLocal));

    for (const trainNo of trainNumbers) {
      if (!trainTimetables[trainNo]) {
        dataProvider.fetchTimetable(trainNo).then((tt) => {
          if (tt) {
            setTrainTimetables((prev) => ({ ...prev, [trainNo]: tt }));
          }
        });
      }
    }
  }, [timetable, trainTimetables]);

  const relevantTimetable = useMemo(() => {
    const currentTimeBuffered = new Date(currentTimeEpoch - BUFFER_TIME);
    return timetable
      .filter((entry) => {
        // Always ignore entries without departure or arrival time
        if (!entry.departureTime && !entry.arrivalTime) return false;

        // Find the train in the data provider
        const train = dataProvider.trainsData$.value.find((x) => x.TrainNoLocal === entry.trainNoLocal);

        // If train exists in the system, check if it has passed this station
        if (train) {
          // If the train index is greater than this station's index, it means the train has passed
          return (
            train.TrainData.VDDelayedTimetableIndex <= entry.index ||
            entry?.subStationEntries?.some((subEntry) => train.TrainData.VDDelayedTimetableIndex <= subEntry.index)
          );
        }

        // For trains not in the system (not currently running), use the time-based filter
        const departureTime = new Date(entry.departureTime ?? entry.arrivalTime!);
        return departureTime >= currentTimeBuffered;
      })
      .toSorted((a, b) => {
        const aTime = new Date(a.departureTime ?? "").getTime();
        const bTime = new Date(b.departureTime ?? "").getTime();
        return aTime - bTime;
      })
      .slice(0, 100); // Limit to 100 entries
  }, [timetable, currentTimeEpoch]);

  const computeEntryState = useCallback(
    (entry: SimplifiedTimtableEntry): EntryRenderState => {
      const localStationNames = new Set([
        entry.stationName,
        ...(entry.subStationEntries?.map((subEntry) => subEntry.stationName) ?? []),
      ]);

      const train = dataProvider.trainsData$.value.find((x) => x.TrainNoLocal === entry.trainNoLocal);
      const trainDelays = train ? dataProvider.getDelaysForTrainSync(train.Id) : null;
      const trainTimetable = trainTimetables[entry.trainNoLocal];

      let departureDelay = trainDelays?.[entry.index] ?? null;
      let isPredictedDelay = false;

      if (departureDelay === null && train && trainTimetable && trainDelays) {
        const lastKnownDelay = calculateLastKnownDelay(trainDelays, train.TrainData.VDDelayedTimetableIndex);
        const predictedDelay = calculatePredictedDelay(
          entry.index,
          lastKnownDelay,
          train.TrainData.VDDelayedTimetableIndex,
          trainTimetable,
        );

        if (predictedDelay !== null && entry.index > train.TrainData.VDDelayedTimetableIndex) {
          departureDelay = predictedDelay;
          isPredictedDelay = true;
        }
      }

      const lastDelay = Object.values(trainDelays ?? {}).at(-1) ?? null;
      const passedBasedOnDepartureTime = isPastStation(entry, currentTime);
      const passedEarly =
        !!train && !passedBasedOnDepartureTime && departureDelay !== null && departureDelay <= -60 && !isPredictedDelay;

      const indexes = [entry.index, ...(entry.subStationEntries?.map((subEntry) => subEntry.index) ?? [])];
      const minIndex = Math.min(...indexes);

      const isInsideStation =
        !!train?.TrainData.SignalInFront &&
        train.TrainData.DistanceToSignalInFront < 2000 &&
        localStationNames.has(findStationForSignal(train.TrainData.SignalInFront.split("@")[0])?.Name ?? "") &&
        (train.TrainData.VDDelayedTimetableIndex >= minIndex ||
          indexes.includes(train.TrainData.VDDelayedTimetableIndex));

      const isCurrentStationTheNextStation =
        isTrainAtPrevStation(train, entry, trainDelays) ||
        (!!train?.TrainData.SignalInFront &&
          train.TrainData.DistanceToSignalInFront >= 2000 &&
          localStationNames.has(findStationForSignal(train.TrainData.SignalInFront.split("@")[0])?.Name ?? "") &&
          train.TrainData.VDDelayedTimetableIndex < minIndex);
      const isPrevStationTheNextStation =
        !isCurrentStationTheNextStation &&
        train?.TrainData.VDDelayedTimetableIndex === entry.index - 1 &&
        !trainDelays?.[entry.index - 1];

      const past =
        !isInsideStation &&
        ((departureDelay !== null && !isPredictedDelay) ||
          (train && train.TrainData.VDDelayedTimetableIndex > entry.index) ||
          (!train && passedBasedOnDepartureTime));

      const delayed = !past && !isInsideStation && passedBasedOnDepartureTime && !!train;

      const prevStations = entry.previousStation?.includes(",\n")
        ? entry.previousStation.split(",\n")
        : entry.previousStation
          ? [entry.previousStation]
          : [];

      const nextStations = entry.nextStation?.includes(",\n")
        ? entry.nextStation.split(",\n")
        : entry.nextStation
          ? [entry.nextStation]
          : [];

      const filteredLines = [entry.line, ...(entry.subStationEntries?.map((subEntry) => subEntry.line) ?? [])].filter(
        (line, index, arr) => index === 0 || line !== arr[index - 1],
      );

      const shouldLeave =
        isInsideStation &&
        isPastStation(entry, moment(currentTime).add(1, "minute").toDate()) &&
        !!train &&
        train.TrainData.SignalInFrontSpeed === 0;

      return {
        entry,
        train,
        trainDelays,
        trainTimetable,
        departureDelay,
        isPredictedDelay,
        lastDelay,
        passedBasedOnDepartureTime,
        passedEarly,
        isInsideStation,
        isCurrentStationTheNextStation,
        isPrevStationTheNextStation,
        past,
        delayed,
        prevStations,
        nextStations,
        filteredLines,
        shouldLeave,
      };
    },
    [currentTime, trainTimetables],
  );

  const entryStates = useMemo(() => relevantTimetable.map(computeEntryState), [relevantTimetable, computeEntryState]);

  const panToTrain = useCallback(
    (train: Train) => {
      onClose?.();
      map?.panTo([train.TrainData.Latitude, train.TrainData.Longitude], {
        animate: true,
        duration: 1,
      });
      setSelectedTrain({ trainNo: train.TrainNoLocal, follow: true, paused: false });
    },
    [map, onClose, setSelectedTrain],
  );

  return (
    <Stack sx={{ width: "100%", height: "100%", overflow: "hidden" }}>
      <Stack
        direction="row"
        justifyContent="flex-end"
        spacing={1}
        sx={{
          bgcolor: "background.surface",
          px: 1,
          pt: 1,
          pb: 1,
        }}>
        <Chip
          size="sm"
          variant={activeViewMode === "table" ? "solid" : "outlined"}
          onClick={() => setViewMode("table")}
          sx={{ cursor: "pointer" }}>
          {tSettings("table")}
        </Chip>
        <Chip
          size="sm"
          variant={activeViewMode === "cards" ? "solid" : "outlined"}
          onClick={() => setViewMode("cards")}
          sx={{ cursor: "pointer" }}>
          {tSettings("cards")}
        </Chip>
        <Chip
          size="sm"
          variant={activeViewMode === "grouped" ? "solid" : "outlined"}
          onClick={() => setViewMode("grouped")}
          sx={{ cursor: "pointer" }}>
          {tSettings("grouped")}
        </Chip>
      </Stack>

      <Sheet sx={{ overflow: "auto", flex: 1, pt: 0, px: 1, pb: 1 }}>
        {activeViewMode === "table" && (
          <StationTimetableTableView entryStates={entryStates} onPanToTrain={panToTrain} />
        )}
        {activeViewMode === "cards" && (
          <StationTimetableCardsView entryStates={entryStates} onPanToTrain={panToTrain} />
        )}
        {activeViewMode === "grouped" && (
          <StationTimetableGroupedView entryStates={entryStates} onPanToTrain={panToTrain} isCollapsed={isCollapsed} />
        )}
      </Sheet>
    </Stack>
  );
};

export default StationTimetableDisplay;
