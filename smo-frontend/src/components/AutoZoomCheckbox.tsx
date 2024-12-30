import { useEffect } from "react";
import { useMap } from "react-leaflet";
import { useTranslation } from "react-i18next";
import Checkbox from "@mui/joy/Checkbox";
import { useSetting } from "../utils/use-setting";
import { signalsData$, trainsData$, stationsData$ } from "../utils/data-manager";
import useBehaviorSubj from "../utils/use-behaviorSubj";

const AutoZoomCheckbox = () => {
  const { t } = useTranslation("translation", { keyPrefix: "Settings" });
  const map = useMap();
  const [autoZoom, setAutoZoom] = useSetting("autoZoom");

  const trains = useBehaviorSubj(trainsData$);
  const signals = useBehaviorSubj(signalsData$);
  const stations = useBehaviorSubj(stationsData$);

  useEffect(() => {
    if (!autoZoom) return;

    const handleZoom = () => {
      const bounds = map.getBounds();
      const visibleTrains = trains.filter((train) =>
        bounds.contains([train.TrainData.Latititute, train.TrainData.Longitute])
      );
      const visibleSignals = signals.filter((signal) =>
        bounds.contains([signal.lat, signal.lon])
      );
      const visibleStations = stations.filter((station) =>
        bounds.contains([station.lat, station.lon])
      );

      const totalVisibleObjects = visibleTrains.length + visibleSignals.length + visibleStations.length;

      if (totalVisibleObjects < 10) {
        map.zoomOut();
      } else if (totalVisibleObjects > 20) {
        map.zoomIn();
      }
    };

    map.on("moveend", handleZoom);
    return () => {
      map.off("moveend", handleZoom);
    };
  }, [autoZoom, map, signals, stations, trains]);

  return (
    <Checkbox
      label={t("autoZoom.Label")}
      checked={autoZoom}
      onChange={(e) => setAutoZoom(e.target.checked)}
    />
  );
};

export default AutoZoomCheckbox;
