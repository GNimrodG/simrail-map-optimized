import L from "leaflet";
import { type FunctionComponent, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Marker, Popup } from "react-leaflet";

import { useSetting } from "../../../hooks/useSetting";
import { getOsmNodeName } from "../../../utils/osm-utils";
import { OsmNode } from "../../../utils/types";
import TrainIcon from "../icons/train.svg?raw";
import StoppingPointPopup from "./StoppingPointPopup";

export interface StoppingPointMarkerProps {
  stop: OsmNode;
}

const StoppingPointMarker: FunctionComponent<StoppingPointMarkerProps> = ({ stop }) => {
  const { i18n } = useTranslation();
  const [layerOpacities] = useSetting("layerOpacities");
  const [translateStationNames] = useSetting("translateStationNames");

  const icon = useMemo(() => {
    return new L.DivIcon({
      html: `${TrainIcon}<span class="tooltip">${translateStationNames ? getOsmNodeName(stop, i18n.language) : stop.tags.name}</span>`,
      iconSize: [24, 24],
      popupAnchor: [0, -15],
      className: `icon station bot stopping-point`,
    });
  }, [translateStationNames, stop, i18n.language]);

  const [isPopupOpen, setIsPopupOpen] = useState(false);

  return (
    <Marker
      position={[stop.lat, stop.lon]}
      icon={icon}
      opacity={layerOpacities["stoppingpoints"]}
      eventHandlers={{
        popupopen: () => setIsPopupOpen(true),
        popupclose: () => setIsPopupOpen(false),
      }}
      pane="stoppingPointsPane">
      <Popup autoPan={false}>{isPopupOpen && <StoppingPointPopup stop={stop} />}</Popup>
    </Marker>
  );
};

export default StoppingPointMarker;
