import L from "leaflet";
import { type FunctionComponent, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Marker, Tooltip } from "react-leaflet";

import { useSetting } from "../../../hooks/useSetting";
import { getOrientedSignalIcon } from "../../../utils/signal-icons";
import { CrossingSign } from "../../../utils/types";
import W6Icon from "../icons/crossing-sign-w6.svg?raw";
import W6aIcon from "../icons/crossing-sign-w6a.svg?raw";
import W6bIcon from "../icons/crossing-sign-w6b.svg?raw";

export interface CrossingSignMarkerProps {
  sign: CrossingSign;
}

const ICONS: Record<CrossingSign["type"], L.DivIcon> = {
  W6: new L.DivIcon({ html: W6Icon, iconSize: [12, 10.4], className: "icon crossing-sign" }),
  W6a: new L.DivIcon({ html: W6aIcon, iconSize: [12, 10.4], className: "icon crossing-sign" }),
  W6b: new L.DivIcon({ html: W6bIcon, iconSize: [12, 21], className: "icon crossing-sign" }),
};

/** A sign before a level crossing (W6a, W6b) or where the driver gives the "Attention" signal (Rp1: W6, W6b) */
const CrossingSignMarker: FunctionComponent<CrossingSignMarkerProps> = ({ sign }) => {
  const { t } = useTranslation();
  const [layerOpacities] = useSetting("layerOpacities");
  // turned like the signals: the top points in the direction of travel the sign is for
  const [rotateSignalIcons] = useSetting("rotateSignalIcons");
  const icon = useMemo(
    () => getOrientedSignalIcon(ICONS[sign.type], sign.heading, rotateSignalIcons),
    [sign.type, sign.heading, rotateSignalIcons],
  );

  return (
    <Marker position={[sign.lat, sign.lon]} icon={icon} opacity={layerOpacities["crossings"]} pane="crossingsPane">
      <Tooltip direction="top" offset={[0, -11]}>
        {t(`CrossingSignMarker.${sign.type}`)}
      </Tooltip>
    </Marker>
  );
};

export default CrossingSignMarker;
