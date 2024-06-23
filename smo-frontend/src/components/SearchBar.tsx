import Autocomplete, { createFilterOptions } from "@mui/joy/Autocomplete";
import L from "leaflet";
import { type FunctionComponent, useContext } from "react";
import { useMap } from "react-leaflet";

import UnplayableStations from "../assets/unplayable-stations.json";
import {
  signalsData$,
  SignalWithTrain,
  Station,
  stationsData$,
  Train,
  trainsData$,
} from "../utils/data-manager";
import { getStationGeometry, goToSignal } from "../utils/geom-utils";
import SelectedTrainContext from "../utils/selected-train-context";
import { normalizeString } from "../utils/ui";
import useBehaviorSubj from "../utils/useBehaviorSubj";
import ListboxComponent from "./utils/ListBoxComponent";

const filterOptions = createFilterOptions<ListItem>({
  ignoreAccents: true,
  ignoreCase: true,
  // the original is included so if the user types the exact name it will be matched
  stringify: (option) => normalizeString(getLabel(option)) + getLabel(option),
});

const SearchBar: FunctionComponent = () => {
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
    map?.panTo([station.Latititude, station.Longitude], { animate: true, duration: 1 });

    // add polygon around the station using the signals
    const polygon = L.polygon(getStationGeometry(station), {
      color: "red",
      fillColor: "#f03",
      fillOpacity: 0.5,
    }).addTo(map);
    setTimeout(() => map?.removeLayer(polygon), 3000);
  };

  const panToSignal = (signal: SignalWithTrain) => {
    setSelectedTrain(selectedTrain ? { ...selectedTrain, follow: false } : null);
    goToSignal(signal, map);
  };

  return (
    <Autocomplete
      loading={options.length === 0}
      sx={{ width: "14rem" }}
      inputMode="search"
      placeholder="Search"
      options={options}
      disableListWrap
      filterOptions={filterOptions}
      slots={{
        listbox: ListboxComponent,
      }}
      isOptionEqualToValue={(option, value) =>
        option.type === value?.type && option.data === value?.data
      }
      renderOption={(props, option) => [props, getLabel(option)] as React.ReactNode}
      renderGroup={(params) => params as unknown as React.ReactNode}
      groupBy={(option) => option.type}
      getOptionLabel={(option) => getLabel(option)}
      value={null}
      onChange={(_e, v) => {
        switch (v?.type) {
          case "Trains":
            setSelectedTrain(
              v?.data.TrainNoLocal ? { trainNo: v.data.TrainNoLocal, follow: true } : null
            );
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
      return option.data.Name;
    case "Signals":
      return option.data.name;
  }
}

export default SearchBar;
