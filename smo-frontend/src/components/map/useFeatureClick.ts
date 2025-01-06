import { MapBrowserEvent } from "ol";
import { FeatureLike } from "ol/Feature";
import { createContext, useContext, useEffect } from "react";

export type FeatureClickEventListener = (event: MapBrowserEvent<MouseEvent>) => unknown;

export const FeatureClickContext = createContext<Map<FeatureLike, FeatureClickEventListener[]>>(new Map());

export const useFeatureClick = (feature: FeatureLike | null, handler: FeatureClickEventListener) => {
  const featureClickMap = useContext(FeatureClickContext);

  useEffect(() => {
    if (!feature) return;

    const handlers = featureClickMap.get(feature) || [];
    handlers.push(handler);
    featureClickMap.set(feature, handlers);

    return () => {
      const handlers = featureClickMap.get(feature) || [];
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
        featureClickMap.set(feature, handlers);
      }
    };
  }, [feature, handler, featureClickMap]);
};
