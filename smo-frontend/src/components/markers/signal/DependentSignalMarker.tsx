import Button from "@mui/joy/Button";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { DivIcon, Icon } from "leaflet";
import { type FunctionComponent, memo } from "react";
import { useTranslation } from "react-i18next";
import { Marker, Popup } from "react-leaflet";

import { useSetting } from "../../../hooks/useSetting.ts";
import { DependentSignalType, getRepeaterPosition, MainSignalAspect } from "../../../utils/dependent-signals.ts";
import { getOrientedSignalIcon } from "../../../utils/signal-icons.ts";
import { SignalStatus } from "../../../utils/types.ts";
import SignalIcon from "../icons/signal.svg?raw";

export interface DependentSignalMarkerProps {
  signal: SignalStatus;
  type: DependentSignalType;
  /** The main signal it belongs to, null when it isn't known. */
  mainSignal: string | null;
  aspect: MainSignalAspect;
  onSignalSelect?: (signalId: string) => void;
  opacity?: number;
}

const className = "icon signal";

// grey like the passive signals, smaller than theirs (14x14) so these stand back
const OFF_ICON = new DivIcon({ html: SignalIcon, iconSize: [10, 10], className: `${className} secondary` });

const SCALE = 1.2; // the icons are drawn 10 wide

/**
 * The lit icons: the signal head with the boards under it (drawn without the pole), anchored at the middle of the head
 * so the boards hang below the signal's position:
 * - distant signals: their W1 board (head 10x15.4, all 10x26.7)
 * - repeaters: the plate with as many bars as which repeater it is counted from the main signal (head 10x24, all
 *   10x30); the few without a numeral have no plate
 */
const ICON_DRAWINGS: Record<
  DependentSignalType,
  (aspect: number, position: number | null) => { file: string; height: number; headHeight: number }
> = {
  distant: (aspect) => ({ file: `signal-distant-os${aspect}`, height: 26.7, headHeight: 15.4 }),
  repeater: (aspect, position) =>
    position
      ? { file: `signal-repeater-sp${aspect}-${position}`, height: 30, headHeight: 24 }
      : { file: `signal-repeater-sp${aspect}`, height: 24, headHeight: 24 },
};

const icons = new Map<string, Icon>();

function getIcon(type: DependentSignalType, aspect: MainSignalAspect, position: number | null): Icon | DivIcon {
  if (!aspect) {
    return OFF_ICON;
  }

  const { file, height, headHeight } = ICON_DRAWINGS[type](aspect, position);
  let icon = icons.get(file);
  if (!icon) {
    icon = new Icon({
      className,
      iconUrl: `/assets/signals/${file}.svg`,
      iconSize: [10 * SCALE, height * SCALE],
      iconAnchor: [5 * SCALE, (headHeight / 2) * SCALE],
      popupAnchor: [0, (-headHeight / 2) * SCALE],
    });
    icons.set(file, icon);
  }
  return icon;
}

const TYPES: Record<DependentSignalType, { aspectName: string; translations: string }> = {
  repeater: { aspectName: "Sp", translations: "RepeaterSignalMarker" },
  distant: { aspectName: "Os", translations: "DistantSignalMarker" },
};

const ASPECT_COLORS = { 0: "neutral", 1: "warning", 2: "success", 3: "success", 4: "warning" } as const;

/** A repeater or distant signal, showing what its main signal shows (see getMainSignalAspect). */
const DependentSignalMarker: FunctionComponent<DependentSignalMarkerProps> = ({
  signal,
  type,
  mainSignal,
  aspect,
  onSignalSelect,
  opacity = 1,
}) => {
  const { t } = useTranslation();
  const [rotateSignalIcons] = useSetting("rotateSignalIcons");
  const { aspectName, translations } = TYPES[type];
  const position = type === "repeater" ? getRepeaterPosition(signal.Name) : null;

  return (
    <Marker
      opacity={opacity}
      position={[signal.Location.Y, signal.Location.X]}
      icon={getOrientedSignalIcon(getIcon(type, aspect, position), signal.Heading, rotateSignalIcons)}
      pane={`${type}SignalsPane`}>
      <Popup autoPan={false}>
        <Stack alignItems="center" spacing={1}>
          <Typography level="h3">{signal.Name}</Typography>
          <Typography level="body-sm">{t(`${translations}.Description`)}</Typography>
          {position && <Typography level="body-sm">{t(`RepeaterSignalMarker.Position.${position}`)}</Typography>}
          <Typography level="body-lg" color={ASPECT_COLORS[aspect]} translate="no">
            {t(`${translations}.Aspect.${aspect ? aspectName + aspect : "off"}`)}
          </Typography>
          {mainSignal && (
            <Button size="sm" variant="outlined" onClick={() => onSignalSelect?.(mainSignal)}>
              {t(`${translations}.GoToMainSignal`, { signal: mainSignal })}
            </Button>
          )}
        </Stack>
      </Popup>
    </Marker>
  );
};

export default memo(DependentSignalMarker);
