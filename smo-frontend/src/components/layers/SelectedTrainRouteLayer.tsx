import { DivIcon, LeafletEventHandlerFn, Map as LeafletMap } from "leaflet";
import { type FunctionComponent, useContext, useEffect, useState } from "react";
import { LayerGroup, Marker, useMap } from "react-leaflet";

import { fetchRoutePoints } from "../../utils/data-manager";
import { debounce } from "../../utils/debounce";
import SelectedRouteContext from "../../utils/selected-route-context";
import DotIcon from "../icons/dot.svg?raw";

const SELECTED_ROUTE_ICON = new DivIcon({
  html: DotIcon,
  iconSize: [8, 8],
  className: "icon selected-route",
});

function getVisibleTrainRoutePoints(route: [number, number][], map: LeafletMap | null): [number, number][] {
  try {
    const bounds = map?.getBounds();

    if (!bounds) {
      console.error("Map bounds not available for selected train route!");
      return [];
    }

    return route.filter((point) => bounds?.contains(point));
  } catch (e) {
    console.error("Failed to filter visible train route points: ", e);
    return []; // Fallback to not showing any points
  }
}

const SelectedTrainRouteLayer: FunctionComponent = () => {
  const map = useMap();
  const { selectedRoute } = useContext(SelectedRouteContext);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]);
  const [visibleSelectedTrainRoutePoints, setVisibleSelectedTrainRoutePoints] = useState<[number, number][]>([]);

  useEffect(() => {
    let shouldCancel = false;
    if (selectedRoute) {
      fetchRoutePoints(selectedRoute).then((points) => {
        if (shouldCancel) return;
        setRoutePoints(points || []);
      });
    } else {
      setRoutePoints([]);
    }

    return () => {
      shouldCancel = true;
    };
  }, [selectedRoute]);

  useEffect(() => {
    setVisibleSelectedTrainRoutePoints(getVisibleTrainRoutePoints(routePoints, map));
  }, [routePoints, map]);

  useEffect(() => {
    const handler: LeafletEventHandlerFn = debounce(() => {
      setVisibleSelectedTrainRoutePoints(getVisibleTrainRoutePoints(routePoints, map));
    }, 1000);

    if (map) {
      map.on("move", handler);
      map.on("zoom", handler);
      map.on("resize", handler);

      return () => {
        map.off("move", handler);
        map.off("zoom", handler);
        map.off("resize", handler);
      };
    }
  }, [map, routePoints]);

  return (
    <LayerGroup>
      {visibleSelectedTrainRoutePoints.map((point) => (
        <Marker key={point[0] + "-" + point[1]} position={point} interactive={false} icon={SELECTED_ROUTE_ICON} />
      ))}
    </LayerGroup>
  );
};

export default SelectedTrainRouteLayer;
