import { Feature } from "ol";
import { containsCoordinate } from "ol/extent";
import { Point } from "ol/geom";
import VectorLayer from "ol/layer/Vector";
import OlMap from "ol/Map";
import VectorSource from "ol/source/Vector";
import { Circle, Fill, Stroke, Style } from "ol/style";
import { type FunctionComponent, useContext, useEffect, useState } from "react";

import { fetchRoutePoints } from "../../utils/data-manager";
import { debounce } from "../../utils/debounce";
import { wgsToMercator } from "../../utils/geom-utils";
import SelectedRouteContext from "../../utils/selected-route-context";
import { useMap } from "../map/MapProvider";

const SELECTED_ROUTE_ICON = new Circle({
  radius: 8,
  fill: new Fill({ color: "rgba(0, 0, 255, 0.5)" }),
  stroke: new Stroke({ color: "rgba(0, 0, 255, 1)", width: 2 }),
});

function getVisibleTrainRoutePoints(route: [number, number][], map: OlMap | null): [number, number][] {
  try {
    const bounds = map?.getView().calculateExtent(map.getSize());

    if (!bounds) {
      console.error("Map bounds not available for selected train route!");
      return [];
    }

    return route.filter((point) => containsCoordinate(bounds, wgsToMercator(point)));
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
    const handler = debounce(() => {
      setVisibleSelectedTrainRoutePoints(getVisibleTrainRoutePoints(routePoints, map));
    }, 1000);

    if (map) {
      map.on("pointerdrag", handler);
      map.on("moveend", handler);

      return () => {
        map.un("pointerdrag", handler);
        map.un("moveend", handler);
      };
    }
  }, [map, routePoints]);

  useEffect(() => {
    const layerSource = new VectorSource({
      features: visibleSelectedTrainRoutePoints.map((point) => new Feature(new Point(point))),
    });

    const layer = new VectorLayer({
      source: layerSource,
      style: new Style({
        image: SELECTED_ROUTE_ICON,
      }),
    });

    map?.addLayer(layer);

    return () => {
      map?.removeLayer(layer);
    };
  }, [map, visibleSelectedTrainRoutePoints]);

  return null;
};

export default SelectedTrainRouteLayer;
