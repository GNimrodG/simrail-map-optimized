import Autocomplete from "@mui/joy/Autocomplete";
import { type FunctionComponent, memo, useContext, useMemo } from "react";

import { dataSubj$ } from "../utils/data-manager";
import SelectedTrainContext from "../utils/selected-train-context";
import useBehaviorSubj from "../utils/useBehaviorSubj";

const SearchBar: FunctionComponent = memo(() => {
  const { selectedTrain, setSelectedTrain } = useContext(SelectedTrainContext);
  const trains = useBehaviorSubj(dataSubj$, (data) => data.trains);

  const selectedTrainData = useMemo(() => {
    if (selectedTrain) {
      return trains.find((t) => t.TrainNoLocal === selectedTrain.trainNo) || null;
    }
    return null;
  }, [selectedTrain, trains]);

  return (
    <Autocomplete
      loading={trains.length === 0}
      placeholder="Search"
      options={trains}
      getOptionLabel={(option) => `${option.TrainNoLocal} (${option.TrainName})`}
      value={selectedTrainData}
      onChange={(_e, v) =>
        setSelectedTrain(v?.TrainNoLocal ? { trainNo: v.TrainNoLocal, follow: true } : null)
      }
    />
  );
});

export default SearchBar;
