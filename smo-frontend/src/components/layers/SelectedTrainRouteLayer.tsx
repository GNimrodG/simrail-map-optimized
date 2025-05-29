import { type FunctionComponent, useContext, useEffect, useRef, useState } from "react";
import { LayerGroup, Polyline, useMap } from "react-leaflet";
import { parse } from "wellknown";

import { dataProvider } from "../../utils/data-manager";
import SelectedRouteContext from "../../utils/selected-route-context";

const REFRESH_INTERVAL = 60_000; // 1 minute

const SelectedTrainRouteLayer: FunctionComponent = () => {
  const map = useMap();
  const { selectedRoute, setSelectedRoute } = useContext(SelectedRouteContext);
  const [routeLines, setRouteLines] = useState<GeoJSON.LineString[]>([]);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    const fetchRoute = () => {
      if (selectedRoute) {
        dataProvider.fetchRoutePoints(selectedRoute).then((points) => {
          const lines = points?.map((x) => parse(x) as GeoJSON.LineString) || [];

          lines.forEach((line) => {
            line.coordinates = line.coordinates.map((coord) => coord.reverse()) as [number, number][];
          });

          setRouteLines(lines);

          if (!points?.length) setSelectedRoute(null);
        });
      } else {
        setRouteLines([]);
      }
    };

    let shouldCancel = false;
    fetchRoute();

    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      if (!shouldCancel) fetchRoute();
    }, REFRESH_INTERVAL);

    return () => {
      shouldCancel = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [map, selectedRoute, setSelectedRoute]);

  return (
    <LayerGroup pane="selectedRoutePane">
      {routeLines.map((x) => (
        <Polyline
          key={`selected-train-route-${x.coordinates[0][0]}-${x.coordinates[0][1]}-${x.coordinates[x.coordinates.length - 1][0]}-${x.coordinates[x.coordinates.length - 1][1]}`}
          positions={x.coordinates as [number, number][]}
          color="#00FFFF"
          weight={3}
          pane="selectedRoutePane"></Polyline>
      ))}
    </LayerGroup>
  );
};

export default SelectedTrainRouteLayer;
