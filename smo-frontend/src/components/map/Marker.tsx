import { Feature } from "ol";
import { Point } from "ol/geom";
import { StyleLike } from "ol/style/Style";
import { type FunctionComponent, PropsWithChildren, useEffect, useRef, useState } from "react";

import { wgsToMercator } from "../../utils/geom-utils";
import { useLayerGroup } from "./LayerContext";
import { useMap } from "./MapProvider";
import { MarkerContext } from "./MarkerContext";

export interface MarkerProps {
  position: [number, number];
  icon: StyleLike;
  duration?: number;
  keepAtCenter?: boolean;
}

const Marker: FunctionComponent<PropsWithChildren<MarkerProps>> = ({
  position,
  icon,
  children,
  duration = 0,
  keepAtCenter = false,
}) => {
  const map = useMap();
  const layerGroup = useLayerGroup();
  const localPosRef = useRef(position);

  const [feature, setFeature] = useState<Feature | null>(null);

  useEffect(() => {
    if (!layerGroup) return;

    const feature = new Feature();

    setFeature(feature);

    layerGroup.getSource()?.addFeature(feature);

    return () => {
      layerGroup.getSource()?.removeFeature(feature);
      setFeature(null);
    };
  }, [layerGroup]);

  useEffect(() => {
    if (!feature) return;

    feature.setGeometry(new Point(wgsToMercator(position)));

    const endTime = Date.now() + duration;
    const startPostion = localPosRef.current;
    const endPosition = position;

    function updatePos(newPos: [number, number]) {
      feature!.setGeometry(new Point(wgsToMercator(newPos)));
      localPosRef.current = newPos;

      if (keepAtCenter) {
        map?.getView().setCenter(wgsToMercator(newPos));
      }
    }

    if (!map || duration <= 0 || startPostion[0] === endPosition[0] || startPostion[1] === endPosition[1]) {
      updatePos(position);
      return;
    }

    let lastFrameRequest: number;

    const drift = () => {
      const now = Date.now();
      const progress = (endTime - now) / duration;
      if (progress <= 0) {
        updatePos(position);
        return;
      }

      const newPos = [
        startPostion[0] + (endPosition[0] - startPostion[0]) * (1 - progress),
        startPostion[1] + (endPosition[1] - startPostion[1]) * (1 - progress),
      ] as [number, number];

      updatePos(newPos);

      lastFrameRequest = requestAnimationFrame(drift);
    };

    drift();

    return () => {
      cancelAnimationFrame(lastFrameRequest);
      updatePos(position);
    };
  }, [duration, feature, keepAtCenter, map, position]);

  useEffect(() => {
    if (!feature) return;

    feature.setStyle(icon);
  }, [feature, icon]);

  return <MarkerContext.Provider value={feature}>{children}</MarkerContext.Provider>;
};

export default Marker;
