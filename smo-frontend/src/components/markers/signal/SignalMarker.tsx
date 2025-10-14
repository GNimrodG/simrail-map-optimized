import { DivIcon, DivIconOptions, Icon, IconOptions } from "leaflet";
import equals from "lodash/isEqual";
import { type FunctionComponent, memo, useEffect, useMemo, useState } from "react";
import { Marker, Popup } from "react-leaflet";

import useBehaviorSubj from "../../../hooks/useBehaviorSubj.ts";
import { dataProvider } from "../../../utils/data-manager.ts";
import { SignalStatus } from "../../../utils/types.ts";
import { getSpeedColorForSignal } from "../../../utils/ui.ts";
import SignalIcon from "../icons/signal.svg?raw";
import SignalMarkerPopup from "./SignalMarkerPopup.tsx";

export interface SignalMarkerProps {
  signal: SignalStatus;
  onSignalSelect?: (signalId: string) => void;
  opacity?: number;
  pane?: string;
}

const className = "icon signal";

const DEFAULT_ICON_OPTIONS: DivIconOptions = {
  html: SignalIcon,
  iconSize: [14, 14],
  className,
};

const SECONDARY_ICON = new DivIcon({
  ...DEFAULT_ICON_OPTIONS,
  className: `${DEFAULT_ICON_OPTIONS.className} secondary`,
});

const BLOCK_SIGNAL_RED_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-block-red.svg",
  iconSize: [15.9, 33.3375], // base site 5.3x11.1125 ~x3
});

const BLOCK_SIGNAL_YELLOW_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-block-yellow.svg",
  iconSize: [15.9, 33.3375], // base site 5.3x11.1125 ~x3
});

const BLOCK_SIGNAL_GREEN_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-block-green.svg",
  iconSize: [15.9, 33.3375], // base site 5.3x11.1125 ~x3
});

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

const SignalMarker: FunctionComponent<SignalMarkerProps> = ({ signal, onSignalSelect, opacity = 1, pane }) => {
  const [icon, setIcon] = useState<Icon<DivIconOptions | IconOptions>>(new DivIcon(DEFAULT_ICON_OPTIONS));
  const trainsData = useBehaviorSubj(dataProvider.trainsData$);

  const trains = useMemo(
    () => (signal.Trains && trainsData.filter((t) => signal.Trains?.includes(t.TrainNoLocal))) || null,
    [signal.Trains, trainsData],
  );

  useEffect(() => {
    if (trains?.length) {
      const train = trains[0];

      if (signal.Type === "block") {
        if (train.TrainData.SignalInFrontSpeed === 0) {
          setIcon(BLOCK_SIGNAL_RED_ICON);
          return;
        }

        if (signal.NextSignalWithTrainAhead) {
          setIcon(BLOCK_SIGNAL_YELLOW_ICON);
          return;
        }

        if (train.TrainData.SignalInFrontSpeed > 200) {
          setIcon(BLOCK_SIGNAL_GREEN_ICON);
          return;
        }
      }

      if (signal.Type === "main") {
        if (train.TrainData.SignalInFrontSpeed > 200) {
          if (signal.NextSignalWithTrainAhead) {
            setIcon(MAIN_SIGNAL_VMAX_ORANGE_ICON);
            return;
          }

          setIcon(MAIN_SIGNAL_VMAX_GREEN_ICON);
          return;
        }

        if (train.TrainData.SignalInFrontSpeed === 0) {
          setIcon(MAIN_SIGNAL_RED_ICON);
          return;
        }

        if (train.TrainData.SignalInFrontSpeed === 40) {
          if (signal.NextSignalWithTrainAhead) {
            setIcon(MAIN_SIGNAL_40_ORANGE_ICON);
            return;
          }

          setIcon(MAIN_SIGNAL_40_ICON);
          return;
        }

        if (train.TrainData.SignalInFrontSpeed === 60) {
          if (signal.NextSignalWithTrainAhead) {
            setIcon(MAIN_SIGNAL_60_ORANGE_ICON);
            return;
          }

          setIcon(MAIN_SIGNAL_60_ICON);
          return;
        }

        if (train.TrainData.SignalInFrontSpeed === 80) {
          if (signal.NextSignalWithTrainAhead) {
            setIcon(MAIN_SIGNAL_80_ORANGE_ICON);
            return;
          }

          setIcon(MAIN_SIGNAL_80_ICON);
          return;
        }

        if (train.TrainData.SignalInFrontSpeed === 100) {
          if (signal.NextSignalWithTrainAhead) {
            setIcon(MAIN_SIGNAL_100_ORANGE_ICON);
            return;
          }

          setIcon(MAIN_SIGNAL_100_ICON);
          return;
        }

        if (train.TrainData.SignalInFrontSpeed === 130) {
          if (signal.NextSignalWithTrainAhead) {
            setIcon(MAIN_SIGNAL_130_ORANGE_ICON);
            return;
          }

          setIcon(MAIN_SIGNAL_130_ICON);
          return;
        }
      }

      if (signal.Type === "small") {
        if (train.TrainData.SignalInFrontSpeed === 0) {
          setIcon(SMALL_SIGNAL_RED_ICON);
          return;
        }

        setIcon(SMALL_SIGNAL_WHITE_ICON);
        return;
      }

      setIcon(
        new DivIcon({
          ...DEFAULT_ICON_OPTIONS,
          className: `${DEFAULT_ICON_OPTIONS.className} ${getSpeedColorForSignal(train.TrainData.SignalInFrontSpeed)}`,
        }),
      );

      return;
    }

    if (signal.TrainsAhead?.length) {
      switch (signal.Type) {
        case "block":
          setIcon(BLOCK_SIGNAL_RED_ICON);
          return;
        case "main":
          setIcon(MAIN_SIGNAL_RED_ICON);
          return;
        case "small":
          setIcon(SMALL_SIGNAL_RED_ICON);
          return;
        default:
          setIcon(
            new DivIcon({
              ...DEFAULT_ICON_OPTIONS,
              className: `${DEFAULT_ICON_OPTIONS.className} danger`,
            }),
          );
          return;
      }
    }

    if (signal.NextSignalWithTrainAhead) {
      switch (signal.Type) {
        case "block":
          setIcon(BLOCK_SIGNAL_YELLOW_ICON);
          return;
        default:
          setIcon(
            new DivIcon({
              ...DEFAULT_ICON_OPTIONS,
              className: `${DEFAULT_ICON_OPTIONS.className} warning`,
            }),
          );
          return;
      }
    }

    setIcon(SECONDARY_ICON);
  }, [signal.Name, signal.Type, signal.NextSignalWithTrainAhead, trains, signal.TrainsAhead]);

  const [isPopupOpen, setIsPopupOpen] = useState(false);

  return (
    <Marker
      opacity={opacity}
      key={signal.Name}
      position={[signal.Location.Y, signal.Location.X]}
      icon={icon}
      eventHandlers={{
        popupopen: () => setIsPopupOpen(true),
        popupclose: () => setIsPopupOpen(false),
      }}
      pane={pane}>
      <Popup autoPan={false}>
        {isPopupOpen && <SignalMarkerPopup signal={signal} onSignalSelect={onSignalSelect} trains={trains} />}
      </Popup>
    </Marker>
  );
};

export default memo(SignalMarker, equals);
