import L from "leaflet";
import { type FunctionComponent, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Marker, Tooltip } from "react-leaflet";

import { useSetting } from "../../../hooks/useSetting";
import { Crossing } from "../../../utils/types";
import CrossingIcon from "../icons/crossing.svg?raw";

export interface CrossingMarkerProps {
  crossing: Crossing;
  /** Show the kilometre under the icon (when zoomed in enough for the labels to fit) */
  showLabel: boolean;
}

/** The kilometre the way the stations write it: "2.409", in Polish "2,409" */
function formatKm(km: string, language: string): string {
  return new Intl.NumberFormat(language, { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(Number(km));
}

const CrossingMarker: FunctionComponent<CrossingMarkerProps> = ({ crossing, showLabel }) => {
  const { t, i18n } = useTranslation();
  const [layerOpacities] = useSetting("layerOpacities");

  const km = crossing.km ? formatKm(crossing.km, i18n.language) : null;

  const icon = useMemo(
    () =>
      new L.DivIcon({
        html: CrossingIcon + (showLabel && km ? `<span class="tooltip">km ${km}</span>` : ""),
        iconSize: [14, 14],
        className: `icon crossing ${crossing.type}`,
      }),
    [crossing.type, showLabel, km],
  );

  return (
    <Marker
      position={[crossing.lat, crossing.lon]}
      icon={icon}
      opacity={layerOpacities["crossings"]}
      pane="crossingsPane">
      <Tooltip direction="top" offset={[0, -8]}>
        {t(`CrossingMarker.${crossing.type}`)}
        {km && (
          <>
            <br />
            {t("CrossingMarker.Position", { line: crossing.line, km })}
          </>
        )}
      </Tooltip>
    </Marker>
  );
};

export default CrossingMarker;
