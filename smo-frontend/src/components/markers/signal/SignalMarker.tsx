import Chip from "@mui/joy/Chip";
import Stack from "@mui/joy/Stack";
import Typography from "@mui/joy/Typography";
import { DivIcon, DivIconOptions, Icon, IconOptions, type Map as LeafletMap } from "leaflet";
import equals from "lodash/isEqual";
import { type FunctionComponent, memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Marker, Popup, useMap } from "react-leaflet";

import { useSetting } from "../../../hooks/useSetting.ts";
import { dataProvider } from "../../../utils/data-manager.ts";
import { BlockSignalBoard } from "../../../utils/signal-boards.ts";
import { getOrientedSignalIcon } from "../../../utils/signal-icons.ts";
import { SignalStatus, Train } from "../../../utils/types.ts";
import { getSpeedColorForSignal } from "../../../utils/ui.ts";
import SignalIcon from "../icons/signal.svg?raw";
import SignalMarkerPopup from "./SignalMarkerPopup.tsx";

export interface SignalMarkerProps {
  signal: SignalStatus;
  onSignalSelect?: (signalId: string) => void;
  opacity?: number;
  pane?: string;
  trains?: Train[] | null;
  /** The board of one of the last block signals before a station (see getBlockSignalBoards) */
  board?: BlockSignalBoard;
}

const className = "icon signal";

/** px: the other signals this close on screen are offered in the popup, their markers overlap (DZ_E2 and DZ_A) */
const OVERLAP_PX = 12;

/** The signals whose markers overlap this one at the map's zoom (it among them), by name */
function overlappingSignals(signal: SignalStatus, map: LeafletMap): SignalStatus[] {
  const here = map.latLngToContainerPoint([signal.Location.Y, signal.Location.X]);
  return dataProvider.signalsData$.value
    .filter(
      (s) =>
        s.Name === signal.Name ||
        here.distanceTo(map.latLngToContainerPoint([s.Location.Y, s.Location.X])) <= OVERLAP_PX,
    )
    .sort((a, b) => a.Name.localeCompare(b.Name));
}

function trainsAt(signal: SignalStatus): Train[] | null {
  const names = new Set(signal.Trains ?? []);
  const trains = dataProvider.trainsData$.value.filter((train) => names.has(train.TrainNoLocal));
  return trains.length ? trains : null;
}

const DEFAULT_ICON_OPTIONS: DivIconOptions = {
  html: SignalIcon,
  iconSize: [14, 14],
  className,
};

const SECONDARY_ICON = new DivIcon({
  ...DEFAULT_ICON_OPTIONS,
  className: `${DEFAULT_ICON_OPTIONS.className} secondary`,
});

// grey like the passive signals, smaller so the many shunting signals stand back
const SHUNTING_SIGNAL_INACTIVE_ICON = new DivIcon({
  ...DEFAULT_ICON_OPTIONS,
  iconSize: [10, 10],
  className: `${DEFAULT_ICON_OPTIONS.className} secondary`,
});

// Ms1: shunting prohibited (blue)
const SHUNTING_SIGNAL_MS1_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-shunting-ms1.svg",
  iconSize: [12, 18.48], // base size 10x15.4 x1.2
});

// Ms2: shunting allowed (white)
const SHUNTING_SIGNAL_MS2_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-shunting-ms2.svg",
  iconSize: [12, 18.48], // base size 10x15.4 x1.2
});

type BlockSignalAspect = "red" | "yellow" | "green";

function createBlockSignalIcons(aspect: BlockSignalAspect): Record<BlockSignalBoard | "none", Icon> {
  // the boards hang under the head (drawn 5.5 wide, 11.1125 high), which stays on the signal's position
  const scale = 15.9 / 5.5;
  const withBoard = (board: string, height: number) =>
    new Icon({
      className,
      iconUrl: `/assets/signals/signal-block-${aspect}-${board}.svg`,
      iconSize: [15.9, height * scale],
      iconAnchor: [2.648 * scale, (11.1125 / 2) * scale],
    });

  return {
    none: new Icon({
      className,
      iconUrl: `/assets/signals/signal-block-${aspect}.svg`,
      iconSize: [15.9, 33.3375], // base site 5.3x11.1125 ~x3
    }),
    W1: withBoard("w1", 17.257),
    W18: withBoard("w18", 15.512),
  };
}

const BLOCK_SIGNAL_ICONS: Record<BlockSignalAspect, Record<BlockSignalBoard | "none", Icon>> = {
  red: createBlockSignalIcons("red"),
  yellow: createBlockSignalIcons("yellow"),
  green: createBlockSignalIcons("green"),
};

const MAIN_SIGNAL_RED_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-red.svg",
  iconSize: [15, 51], // base size 5x17 x3
});

const MAIN_SIGNAL_40_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-40.svg",
  iconSize: [15, 39.3], // base size 5x13.1 x3
});

const MAIN_SIGNAL_40_ORANGE_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-40-orange.svg",
  iconSize: [15, 60], // base size 5x20 x3
});

const MAIN_SIGNAL_50_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-50.svg",
  iconSize: [15, 66], // base size 5x22 x3
});

const MAIN_SIGNAL_50_ORANGE_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-50-orange.svg",
  iconSize: [15, 66], // base size 5x22 x3
});

const MAIN_SIGNAL_60_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-60.svg",
  iconSize: [15, 39.3], // base size 5x13.1 x3
});

const MAIN_SIGNAL_60_ORANGE_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-60-orange.svg",
  iconSize: [15, 60], // base size 5x20 x3
});

const MAIN_SIGNAL_80_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-80.svg",
  iconSize: [15, 39.3], // base size 5x13.1 x3
});

const MAIN_SIGNAL_80_ORANGE_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-80-orange.svg",
  iconSize: [15, 60], // base size 5x20 x3
});

const MAIN_SIGNAL_100_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-100.svg",
  iconSize: [15, 39.3], // base size 5x13.1 x3
});

const MAIN_SIGNAL_100_ORANGE_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-100-orange.svg",
  iconSize: [15, 60], // base size 5x20 x3
});

const MAIN_SIGNAL_130_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-130.svg",
  iconSize: [15, 39.3], // base size 5x13.1 x3
});

const MAIN_SIGNAL_130_ORANGE_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-130-orange.svg",
  iconSize: [15, 60], // base size 5x20 x3
});

const MAIN_SIGNAL_VMAX_ORANGE_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-vmax-orange.svg",
  iconSize: [15, 51], // base size 5x17 x2
});

const MAIN_SIGNAL_VMAX_GREEN_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-vmax-green.svg",
  iconSize: [15, 51], // base size 5x17 x2
});

const SMALL_SIGNAL_RED_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-small-red.svg",
  iconSize: [15, 21.99], // base size 5x7.33 x3
});

const SMALL_SIGNAL_WHITE_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-small-white.svg",
  iconSize: [15, 21.99], // base size 5x7.33 x3
});

/** The icon showing the signal's aspect, from the first train approaching it or the trains ahead of it */
function getSignalIcon(
  signal: SignalStatus,
  signalTrains: Train[] | null,
  board: BlockSignalBoard | undefined,
): Icon<DivIconOptions | IconOptions> {
  if (signalTrains?.length) {
    const train = signalTrains[0];

    if (signal.Type === "block") {
      if (train.TrainData.SignalInFrontSpeed === 0) {
        return BLOCK_SIGNAL_ICONS.red[board ?? "none"];
      }

      if (signal.NextSignalWithTrainAhead) {
        return BLOCK_SIGNAL_ICONS.yellow[board ?? "none"];
      }

      if (train.TrainData.SignalInFrontSpeed > 200) {
        return BLOCK_SIGNAL_ICONS.green[board ?? "none"];
      }
    }

    if (signal.Type === "main") {
      if (train.TrainData.SignalInFrontSpeed > 200) {
        if (signal.NextSignalWithTrainAhead) {
          return MAIN_SIGNAL_VMAX_ORANGE_ICON;
        }

        return MAIN_SIGNAL_VMAX_GREEN_ICON;
      }

      if (train.TrainData.SignalInFrontSpeed === 0) {
        return MAIN_SIGNAL_RED_ICON;
      }

      if (train.TrainData.SignalInFrontSpeed === 40) {
        if (signal.NextSignalWithTrainAhead) {
          return MAIN_SIGNAL_40_ORANGE_ICON;
        }

        return MAIN_SIGNAL_40_ICON;
      }

      if (train.TrainData.SignalInFrontSpeed === 50) {
        if (signal.NextSignalWithTrainAhead) {
          return MAIN_SIGNAL_50_ORANGE_ICON;
        }

        return MAIN_SIGNAL_50_ICON;
      }

      if (train.TrainData.SignalInFrontSpeed === 60) {
        if (signal.NextSignalWithTrainAhead) {
          return MAIN_SIGNAL_60_ORANGE_ICON;
        }

        return MAIN_SIGNAL_60_ICON;
      }

      if (train.TrainData.SignalInFrontSpeed === 80) {
        if (signal.NextSignalWithTrainAhead) {
          return MAIN_SIGNAL_80_ORANGE_ICON;
        }

        return MAIN_SIGNAL_80_ICON;
      }

      if (train.TrainData.SignalInFrontSpeed === 100) {
        if (signal.NextSignalWithTrainAhead) {
          return MAIN_SIGNAL_100_ORANGE_ICON;
        }

        return MAIN_SIGNAL_100_ICON;
      }

      if (train.TrainData.SignalInFrontSpeed === 130) {
        if (signal.NextSignalWithTrainAhead) {
          return MAIN_SIGNAL_130_ORANGE_ICON;
        }

        return MAIN_SIGNAL_130_ICON;
      }
    }

    if (signal.Type === "shunting") {
      return train.TrainData.SignalInFrontSpeed === 0 ? SHUNTING_SIGNAL_MS1_ICON : SHUNTING_SIGNAL_MS2_ICON;
    }

    if (signal.Type === "small") {
      if (train.TrainData.SignalInFrontSpeed === 0) {
        return SMALL_SIGNAL_RED_ICON;
      }

      return SMALL_SIGNAL_WHITE_ICON;
    }

    return new DivIcon({
      ...DEFAULT_ICON_OPTIONS,
      className: `${DEFAULT_ICON_OPTIONS.className} ${getSpeedColorForSignal(train.TrainData.SignalInFrontSpeed)}`,
    });
  }

  if (signal.TrainsAhead?.length) {
    switch (signal.Type) {
      case "block":
        return BLOCK_SIGNAL_ICONS.red[board ?? "none"];
      case "main":
        return MAIN_SIGNAL_RED_ICON;
      case "small":
        return SMALL_SIGNAL_RED_ICON;
      case "shunting":
        return SHUNTING_SIGNAL_MS1_ICON;
      default:
        return new DivIcon({
          ...DEFAULT_ICON_OPTIONS,
          className: `${DEFAULT_ICON_OPTIONS.className} danger`,
        });
    }
  }

  if (signal.NextSignalWithTrainAhead) {
    switch (signal.Type) {
      case "block":
        return BLOCK_SIGNAL_ICONS.yellow[board ?? "none"];
      default:
        return new DivIcon({
          ...DEFAULT_ICON_OPTIONS,
          className: `${DEFAULT_ICON_OPTIONS.className} warning`,
        });
    }
  }

  return signal.Type === "shunting" ? SHUNTING_SIGNAL_INACTIVE_ICON : SECONDARY_ICON;
}

const SignalMarker: FunctionComponent<SignalMarkerProps> = ({
  signal,
  onSignalSelect,
  opacity = 1,
  pane,
  trains,
  board,
}) => {
  const signalTrains = trains || null;
  const icon = useMemo(() => getSignalIcon(signal, signalTrains, board), [signal, signalTrains, board]);
  const [rotateSignalIcons] = useSetting("rotateSignalIcons");
  const orientedIcon = useMemo(
    () => getOrientedSignalIcon(icon, signal.Heading, rotateSignalIcons),
    [icon, signal.Heading, rotateSignalIcons],
  );

  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const map = useMap();
  const { t } = useTranslation("translation", { keyPrefix: "SignalMarker" });
  // the signals under this marker (only the top one can be clicked): the popup switches between them
  const [signalsHere, setSignalsHere] = useState<SignalStatus[]>([]);
  const [shownName, setShownName] = useState<string | null>(null);
  const shown =
    (shownName && shownName !== signal.Name && dataProvider.signalsData$.value.find((s) => s.Name === shownName)) ||
    signal;
  const shownTrains = useMemo(() => (shown === signal ? signalTrains : trainsAt(shown)), [shown, signal, signalTrains]);

  return (
    <Marker
      opacity={opacity}
      key={signal.Name}
      position={[signal.Location.Y, signal.Location.X]}
      icon={orientedIcon}
      eventHandlers={{
        popupopen: () => {
          setSignalsHere(overlappingSignals(signal, map));
          setIsPopupOpen(true);
        },
        popupclose: () => {
          setIsPopupOpen(false);
          setShownName(null);
        },
      }}
      pane={pane}>
      <Popup autoPan={false}>
        {isPopupOpen && (
          <>
            {signalsHere.length > 1 && (
              <Stack direction="row" gap={0.5} alignItems="center" flexWrap="wrap" sx={{ mb: 1 }}>
                <Typography level="body-sm">{t("OtherSignalsHere")}</Typography>
                {signalsHere.map((s) => (
                  <Chip
                    key={s.Name}
                    size="sm"
                    color="primary"
                    variant={s.Name === shown.Name ? "solid" : "outlined"}
                    onClick={() => setShownName(s.Name)}>
                    {s.Name}
                  </Chip>
                ))}
              </Stack>
            )}
            <SignalMarkerPopup key={shown.Name} signal={shown} onSignalSelect={onSignalSelect} trains={shownTrains} />
          </>
        )}
      </Popup>
    </Marker>
  );
};

export default memo(SignalMarker, equals);
