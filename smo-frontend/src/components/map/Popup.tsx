import { PropsWithChildren, useEffect, useRef, type FunctionComponent } from "react";
import { useMarker } from "./MarkerContext";
import { Point } from "ol/geom";

export interface PopupProps {}

const Popup: FunctionComponent<PropsWithChildren<PopupProps>> = ({ children }) => {
  return null; // TODO

  // const feature = useMarker();
  // const childrenRef = useRef<HTMLDivElement>(null);

  // if (!feature) return null;

  // useEffect(() => {
  //   if (!childrenRef.current) return;

  //   childrenRef.current.style.position = "absolute";
  //   childrenRef.current.style.transform = "translate(-50%, -100%)";

  //   feature.on("change", () => {
  //     const geometry = feature.getGeometry();
  //     if (!geometry) return;

  //     const coordinates = geometry.getType() === "Point" ? (geometry as Point).getCoordinates() : null;
  //     if (!coordinates) return;

  //     const pixel = map.getPixelFromCoordinate(coordinates);
  //     if (!pixel) return;

  //     childrenRef.current.style.left = `${pixel[0]}px`;
  //     childrenRef.current.style.top = `${pixel[1]}px`;
  //   });

  //   return () => {
  //     feature.un("change");
  //   };
  // }, [feature]);

  // return <div ref={childrenRef}>{children}</div>;
};

export default Popup;
