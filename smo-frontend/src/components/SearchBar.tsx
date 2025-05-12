import Autocomplete, { createFilterOptions } from "@mui/joy/Autocomplete";
import { type FunctionComponent, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useMap } from "react-leaflet";

import { dataProvider } from "../utils/data-manager";
import { goToSignal, goToStation } from "../utils/geom-utils";
import SelectedTrainContext from "../utils/selected-train-context";
import { SignalStatus, Station, Train } from "../utils/types";
import { getSpeedColorForSignal, normalizeString } from "../utils/ui";
import useBehaviorSubj from "../utils/use-behaviorSubj";
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
  const trains = useBehaviorSubj(dataProvider.trainsData$);
  const stations = useBehaviorSubj(dataProvider.stationsData$);
  const signals = useBehaviorSubj(dataProvider.signalsData$);
  const unplayableStations = useBehaviorSubj(dataProvider.unplayableStations$);

  const options = [
    ...(trains
      ?.map((train) => ({ type: "Trains", data: train }))
      .toSorted((a, b) => +a.data.TrainNoLocal - +b.data.TrainNoLocal) || []),
    ...(stations
      ?.map((station) => ({ type: "Stations", data: station }))
      .toSorted((a, b) => a.data.Name.localeCompare(b.data.Name)) || []),
    ...(unplayableStations
      ?.map((station) => ({
        type: "Stations",
        data: station,
      }))
      .toSorted((a, b) => a.data.Name.localeCompare(b.data.Name)) || []),
    ...(signals
      ?.map((signal) => ({ type: "Signals", data: signal }))
      .toSorted((a, b) => a.data.Name.localeCompare(b.data.Name)) || []),
  ] as ListItem[];

  const panToStation = (station: Station) => {
    setSelectedTrain(selectedTrain ? { ...selectedTrain, follow: false } : null);
    goToStation(station, map);
  };

  const panToSignal = (signal: SignalStatus) => {
    setSelectedTrain(selectedTrain ? { ...selectedTrain, follow: false } : null);
    goToSignal(signal, map);
  };

  const panToTrain = (train: Train) => {
    map?.panTo([train.TrainData.Latitude, train.TrainData.Longitude], {
      animate: true,
      duration: 1,
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
  | { type: "Signals"; data: SignalStatus };

function getLabel(option: ListItem) {
  switch (option.type) {
    case "Trains":
      return `${option.data.TrainNoLocal} (${option.data.TrainName})`;
    case "Stations":
      return option.data.Name + (option.data.Prefix ? ` (${option.data.Prefix})` : "");
    case "Signals":
      return option.data.Name;
  }
}

function getColor(option: ListItem) {
  switch (option.type) {
    case "Trains":
      return option.data.TrainData.ControlledBySteamID?.[0] ? "neutral" : "success";
    case "Stations":
      return option.data.DifficultyLevel === -1 || option.data.DispatchedBy?.[0] ? "neutral" : "success";
    case "Signals":
      return option.data.Trains
        ? getSpeedColorForSignal(
            dataProvider.trainsData$.value.find((t) => option.data.Trains?.includes(t.TrainNoLocal))!.TrainData
              .SignalInFrontSpeed,
          )
        : option.data.TrainsAhead
          ? "danger"
          : option.data.NextSignalWithTrainAhead
            ? "warning"
            : "neutral";
  }
}

export default SearchBar;
