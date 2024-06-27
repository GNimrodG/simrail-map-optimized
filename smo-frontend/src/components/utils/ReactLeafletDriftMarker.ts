// Original source: https://github.com/hugobarragon/react-leaflet-drift-marker

import { createLayerComponent, EventedProps } from "@react-leaflet/core";
import { LatLngExpression, MarkerOptions } from "leaflet";
import { ReactNode } from "react";

import LeafletDriftMarker from "./LeafletDriftMarker";

export interface ReactLeafletDriftMarkerProps extends MarkerOptions, EventedProps {
  children?: ReactNode;
  position: LatLngExpression;
  duration: number;
  keepAtCenter?: boolean;
}

export default createLayerComponent<LeafletDriftMarker, ReactLeafletDriftMarkerProps>(
  function createMarker({ position, ...options }, ctx) {
    const instance = new LeafletDriftMarker(position, options);
    return { instance, context: { ...ctx, overlayContainer: instance } };
  },
  function updateMarker(marker, props, prevProps) {
    if (prevProps.position !== props.position && typeof props.duration == "number") {
      marker.slideTo(props.position, {
        duration: props.duration,
        keepAtCenter: props.keepAtCenter,
      });
    }

    if (props.icon != null && props.icon !== prevProps.icon) {
      marker.setIcon(props.icon);
    }

    if (props.zIndexOffset != null && props.zIndexOffset !== prevProps.zIndexOffset) {
      marker.setZIndexOffset(props.zIndexOffset);
    }

    if (props.opacity != null && props.opacity !== prevProps.opacity) {
      marker.setOpacity(props.opacity);
    }

    if (marker.dragging != null && props.draggable !== prevProps.draggable) {
      if (props.draggable === true) {
        marker.dragging.enable();
      } else {
        marker.dragging.disable();
      }
    }

    if (props.keepAtCenter !== prevProps.keepAtCenter) {
      marker.slideTo(props.position, {
        duration: props.duration,
        keepAtCenter: props.keepAtCenter,
      });
    }
  }
);
