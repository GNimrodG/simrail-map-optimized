import Autocomplete, { createFilterOptions } from "@mui/joy/Autocomplete";
import { type FunctionComponent, useContext } from "react";
import { useTranslation } from "react-i18next";

import UnplayableStations from "../assets/unplayable-stations.json";
import { signalsData$, SignalWithTrain, Station, stationsData$, Train, trainsData$ } from "../utils/data-manager";
import { goToSignal, goToStation, wgsToMercator } from "../utils/geom-utils";
import SelectedTrainContext from "../utils/selected-train-context";
import { getSpeedColorForSignal, normalizeString } from "../utils/ui";
import useBehaviorSubj from "../utils/use-behaviorSubj";
import { useMap } from "./map/MapProvider";
import ListboxComponent from "./utils/ListBoxComponent";

const filterOptions = createFilterOptions<ListItem>({
  ignoreAccents: true,
  ignoreCase: true,
  // the original is included so if the user types the exact name it will be matched
  stringify: (option) => normalizeString(getLabel(option)) + getLabel(option),
});

const SearchBar: FunctionComponent = () => {
  const { t } = useTranslation();
  const map = useMap();
  const { selectedTrain, setSelectedTrain } = useContext(SelectedTrainContext);
  const trains = useBehaviorSubj(trainsData$);
  const stations = useBehaviorSubj(stationsData$);
  const signals = useBehaviorSubj(signalsData$);

  const options = [
    ...(trains
      ?.map((train) => ({ type: "Trains", data: train }))
      .toSorted((a, b) => +a.data.TrainNoLocal - +b.data.TrainNoLocal) || []),
    ...(stations
      ?.map((station) => ({ type: "Stations", data: station }))
      .toSorted((a, b) => a.data.Name.localeCompare(b.data.Name)) || []),
    ...(UnplayableStations.map((station) => ({
      type: "Stations",
      data: station as unknown as Station,
    })).toSorted((a, b) => a.data.Name.localeCompare(b.data.Name)) || []),
    ...(signals
      ?.map((signal) => ({ type: "Signals", data: signal }))
      .toSorted((a, b) => a.data.name.localeCompare(b.data.name)) || []),
  ] as ListItem[];

  const panToStation = (station: Station) => {
    setSelectedTrain(selectedTrain ? { ...selectedTrain, follow: false } : null);
    goToStation(station, map!);
  };

  const panToSignal = (signal: SignalWithTrain) => {
    setSelectedTrain(selectedTrain ? { ...selectedTrain, follow: false } : null);
    goToSignal(signal, map!);
  };

  const panToTrain = (train: Train) => {
    map?.getView().animate({
      center: wgsToMercator([train.TrainData.Latititute, train.TrainData.Longitute]),
      duration: 1000,
    });
    setSelectedTrain({ trainNo: train.TrainNoLocal, follow: true, paused: false });
  };

  return (
    <Autocomplete
      loading={options.length === 0}
      sx={{ width: "17rem" }}
      inputMode="search"
      placeholder={t("Search")}
      options={options}
      disableListWrap
      filterOptions={filterOptions}
      slots={{
        listbox: ListboxComponent,
      }}
      isOptionEqualToValue={(option, value) => option.type === value?.type && option.data === value?.data}
      renderOption={(props, option) => [{ ...props, color: getColor(option) }, getLabel(option)] as React.ReactNode}
      renderGroup={(params) => params as unknown as React.ReactNode}
      groupBy={(option) => t(`Layers.Overlay.${option.type.toLowerCase()}`)}
      getOptionLabel={(option) => getLabel(option)}
      value={null}
      onChange={(_e, v) => {
        switch (v?.type) {
          case "Trains":
            panToTrain(v.data);
            break;
          case "Stations":
            panToStation(v.data);
            break;
          case "Signals":
            panToSignal(v.data);
            break;
        }
      }}
    />
  );
};

type ListItem =
  | { type: "Trains"; data: Train }
  | { type: "Stations"; data: Station }
  | { type: "Signals"; data: SignalWithTrain };

function getLabel(option: ListItem) {
  switch (option.type) {
    case "Trains":
      return `${option.data.TrainNoLocal} (${option.data.TrainName})`;
    case "Stations":
      return option.data.Name + (option.data.Prefix ? ` (${option.data.Prefix})` : "");
    case "Signals":
      return option.data.name;
  }
}

function getColor(option: ListItem) {
  switch (option.type) {
    case "Trains":
      return option.data.TrainData.ControlledBySteamID?.[0] ? "neutral" : "success";
    case "Stations":
      return option.data.DifficultyLevel === -1 || option.data.DispatchedBy?.[0] ? "neutral" : "success";
    case "Signals":
      return option.data.train
        ? getSpeedColorForSignal(option.data.train?.TrainData.SignalInFrontSpeed)
        : option.data.trainAhead
          ? "danger"
          : option.data.nextSignalWithTrainAhead
            ? "warning"
            : "neutral";
  }
}

export default SearchBar;
