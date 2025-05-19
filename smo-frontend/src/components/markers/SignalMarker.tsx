import { DivIcon, DivIconOptions, Icon, IconOptions } from "leaflet";
import equals from "lodash/isEqual";
import { type FunctionComponent, memo, useEffect, useMemo, useState } from "react";
import { Marker, Popup } from "react-leaflet";

import { dataProvider } from "../../utils/data-manager.ts";
import { SignalStatus } from "../../utils/types.ts";
import { getSpeedColorForSignal } from "../../utils/ui";
import SignalIcon from "./icons/signal.svg?raw";
import SignalMarkerPopup from "./SignalMarkerPopup.tsx";

export interface SignalMarkerProps {
  signal: SignalStatus;
  onSignalSelect?: (signalId: string) => void;
  opacity?: number;
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

const MAIN_SIGNAL_60_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-60.svg",
  iconSize: [15, 39.3], // base size 5x13.1 x3
});

const MAIN_SIGNAL_100_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-100.svg",
  iconSize: [15, 39.3], // base size 5x13.1 x3
});

const MAIN_SIGNAL_GREEN_ICON = new Icon({
  className,
  iconUrl: "/assets/signals/signal-main-green.svg",
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

const SignalMarker: FunctionComponent<SignalMarkerProps> = ({ signal, onSignalSelect, opacity = 1 }) => {
  const [icon, setIcon] = useState<Icon<DivIconOptions | IconOptions>>(new DivIcon(DEFAULT_ICON_OPTIONS));

  const trains = useMemo(
    () =>
      (signal.Trains && dataProvider.trainsData$.value.filter((t) => signal.Trains?.includes(t.TrainNoLocal))) || null,
    [signal.Trains],
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
          setIcon(MAIN_SIGNAL_GREEN_ICON);
          return;
        }

        if (train.TrainData.SignalInFrontSpeed === 0) {
          setIcon(MAIN_SIGNAL_RED_ICON);
          return;
        }

        if (train.TrainData.SignalInFrontSpeed === 40) {
          setIcon(MAIN_SIGNAL_40_ICON);
          return;
        }

        if (train.TrainData.SignalInFrontSpeed === 60) {
          setIcon(MAIN_SIGNAL_60_ICON);
          return;
        }

        if (train.TrainData.SignalInFrontSpeed === 100) {
          setIcon(MAIN_SIGNAL_100_ICON);
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

    // it's only guaranteed to be red if it's a block signal
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
      }}>
      <Popup autoPan={false}>
        {isPopupOpen && <SignalMarkerPopup signal={signal} onSignalSelect={onSignalSelect} trains={trains} />}
      </Popup>
    </Marker>
  );
};

export default memo(SignalMarker, equals);
