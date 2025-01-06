import { type FunctionComponent } from "react";

import UnplayableStations from "../../assets/unplayable-stations.json";
import { Station } from "../../utils/data-manager";
import LayerGroup from "../map/LayerGroup";
import UnplayableStation from "../markers/UnplayableStation";

const UnplayableStationsLayer: FunctionComponent = () => {
  return (
    <LayerGroup zIndex={20}>
      {UnplayableStations.map((station) => (
        <UnplayableStation key={station.Name} station={station as unknown as Station} />
      ))}
    </LayerGroup>
  );
};

export default UnplayableStationsLayer;
