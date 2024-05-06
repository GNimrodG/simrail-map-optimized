import { type FunctionComponent, memo } from "react";
import { LayerGroup } from "react-leaflet";

import UnplayableStations from "../../assets/unplayable-stations.json";
import { Station } from "../../utils/data-manager";
import UnplayableStation from "../markers/UnplayableStation";

const UnplayableStationsLayer: FunctionComponent = memo(() => {
  return (
    <LayerGroup>
      {UnplayableStations.map((station) => (
        <UnplayableStation
          key={station.Name}
          station={station as unknown as Station}
        />
      ))}
    </LayerGroup>
  );
});

export default UnplayableStationsLayer;
