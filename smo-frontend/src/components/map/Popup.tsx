import * as turf from "@turf/turf";
import { Overlay } from "ol";
import { Geometry, LineString, MultiLineString, MultiPoint, Point, Polygon } from "ol/geom";
import { Positioning } from "ol/Overlay";
import { forwardRef, PropsWithChildren, useEffect, useImperativeHandle, useState } from "react";
import { createPortal } from "react-dom";

import CloseIcon from "../icons/xmark.svg?raw";
import { useMap } from "./MapProvider";
import { useMarker } from "./MarkerContext";
import { useFeatureClick } from "./useFeatureClick";

export interface PopupProps {
  className?: string;
  positioning?: Positioning;
  offset?: [number, number];
}

export interface PopupRef {
  open: () => void;
  close: () => void;
}

function getPointFromGeometry(geometry: Geometry): Point | null {
  switch (geometry.getType()) {
    case "Point":
      return geometry as Point;
    case "MultiPoint":
      return (geometry as MultiPoint).getPoint(0);
    case "LineString": {
      const coordinates = (geometry as LineString).getCoordinates();
      return new Point(coordinates[Math.floor(coordinates.length / 2)]);
    }
    case "MultiLineString": {
      const turfMultiLineString = turf.multiLineString((geometry as MultiLineString).getCoordinates());
      const center = turf.center(turfMultiLineString);
      return new Point(center.geometry.coordinates);
    }
    case "Polygon": {
      const turfPolygon = turf.polygon((geometry as Polygon).getCoordinates());
      const center = turf.center(turfPolygon);
      return new Point(center.geometry.coordinates);
    }
    default:
      return null;
  }
}

function getContainerEl(className?: string) {
  const containerEl = document.createElement("div");
  containerEl.className = "map-popup";

  if (className) {
    containerEl.classList.add(className);
  }

  return containerEl;
}

function getCloseIcon(handler: () => void) {
  const closeIcon = document.createElement("div");
  closeIcon.className = "map-popup-close";
  closeIcon.addEventListener("click", handler);

  closeIcon.innerHTML = CloseIcon;

  return closeIcon;
}

const Popup = forwardRef<PopupRef, PropsWithChildren<PopupProps>>(
  ({ children, className, positioning, offset }, ref) => {
    const map = useMap();
    const feature = useMarker();
    const [containerEl, setContainerEl] = useState(getContainerEl(className));
    const [overlay] = useState<Overlay>(
      new Overlay({
        positioning: "bottom-center",
      }),
    );
    const [isOpen, setIsOpen] = useState(false);

    // Update overlay positioning and offset
    useEffect(() => {
      if (!overlay) return;

      overlay.setPosition(undefined);

      overlay.setPositioning(positioning || "bottom-center");
      overlay.setOffset(offset || [0, 0]);
    }, [overlay, positioning, offset]);

    // Close popup when other popup is opened
    useEffect(() => {
      const handler = () => setIsOpen(false);

      window.addEventListener("close-popup", handler);

      return () => {
        window.removeEventListener("close-popup", handler);
      };
    }, [setIsOpen]);

    // Update container element when className changes
    useEffect(() => {
      setContainerEl(getContainerEl(className));
    }, [className]);

    // Add close icon to container element and set it to overlay
    useEffect(() => {
      if (!overlay) return;

      const closer = getCloseIcon(() => setIsOpen(false));

      containerEl?.appendChild(closer);

      overlay.setElement(containerEl || undefined);

      return () => {
        overlay.setElement(undefined);
      };
    }, [overlay, containerEl]);

    // Add overlay to map
    useEffect(() => {
      if (!map || !overlay) return;

      map.addOverlay(overlay);

      const _overlay = overlay;

      return () => {
        map.removeOverlay(_overlay);
      };
    }, [map, overlay]);

    // Open popup on feature click
    useFeatureClick(feature, () => setIsOpen((isOpen) => !isOpen));

    // Update overlay position on feature geometry change
    useEffect(() => {
      if (!feature || !overlay) return;

      if (!isOpen) {
        overlay?.setPosition(undefined);
        return;
      }

      const handler = () => {
        const geometry = feature.getGeometry();

        if (!geometry) {
          return;
        }

        const point = getPointFromGeometry(geometry);

        if (!point) {
          console.error("Failed to get point from geometry", geometry);
          return;
        }

        overlay?.setPosition(point.getCoordinates());
      };

      handler();

      feature.on("change:geometry", handler);

      return () => {
        feature.un("change:geometry", handler);
      };
    }, [feature, isOpen, overlay]);

    useImperativeHandle(ref, () => ({
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
    }));

    if (!feature || !containerEl) return null;

    // Render popup in portal if open
    return isOpen && createPortal(children, containerEl);
  },
);

export default Popup;
