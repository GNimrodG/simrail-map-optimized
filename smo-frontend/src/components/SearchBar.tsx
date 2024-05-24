import Autocomplete from "@mui/joy/Autocomplete";
import { type FunctionComponent, useContext, useMemo } from "react";
import { useMap } from "react-leaflet";

import {
  signalsData$,
  SignalWithTrain,
  Station,
  stationsData$,
  Train,
  trainsData$,
} from "../utils/data-manager";
import SelectedTrainContext from "../utils/selected-train-context";
import useBehaviorSubj from "../utils/useBehaviorSubj";
import ListboxComponent from "./utils/ListBoxComponent";

const SearchBar: FunctionComponent = () => {
  const map = useMap();
  const { selectedTrain, setSelectedTrain } = useContext(SelectedTrainContext);
  const trains = useBehaviorSubj(trainsData$);
  const stations = useBehaviorSubj(stationsData$);
  const signals = useBehaviorSubj(signalsData$);

  const selectedTrainData = useMemo(() => {
    if (selectedTrain) {
      const train = trains.find((t) => t.TrainNoLocal === selectedTrain.trainNo) || null;
      if (train) {
        return { type: "Trains" as const, data: train };
      }
    }
    return null;
  }, [selectedTrain, trains]);

  const options = [
    ...(trains
      ?.map((train) => ({ type: "Trains", data: train }))
      .toSorted((a, b) => +a.data.TrainNoLocal - +b.data.TrainNoLocal) || []),
    ...(stations
      ?.map((station) => ({ type: "Stations", data: station }))
      .toSorted((a, b) => a.data.Name.localeCompare(b.data.Name)) || []),
    ...(signals
      ?.map((signal) => ({ type: "Signals", data: signal }))
      .toSorted((a, b) => a.data.name.localeCompare(b.data.name)) || []),
  ] as ListItem[];

  return (
    <Autocomplete
      loading={options.length === 0}
      sx={{ width: "14rem" }}
      inputMode="search"
      placeholder="Search"
      options={options}
      disableListWrap
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
      value={selectedTrainData}
      onChange={(_e, v) => {
        switch (v?.type) {
          case "Trains":
            setSelectedTrain(
              v?.data.TrainNoLocal ? { trainNo: v.data.TrainNoLocal, follow: true } : null
            );
            break;
          case "Stations":
            setSelectedTrain(null);
            map?.panTo([v.data.Latititude, v.data.Longitude], { animate: true, duration: 1 });
            break;
          case "Signals":
            setSelectedTrain(null);
            map?.panTo([v.data.lat, v.data.lon], { animate: true, duration: 1 });
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
