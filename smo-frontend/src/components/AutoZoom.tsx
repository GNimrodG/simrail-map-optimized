import { useContext, useEffect } from "react";
import { useMap } from "react-leaflet";

import { useSetting } from "../hooks/useSetting";
import { dataProvider } from "../utils/data-manager";
import { getTargetZoom, isZooming } from "../utils/leaflet-zoom";
import SelectedTrainContext from "../utils/selected-train-context";

/** How often the zoom is checked. Not on every map move: following a train moves the map on every frame. */
const CHECK_INTERVAL_MS = 1000;

/** After a zoom, the map is left alone this long so the counts settle before the next check. */
const SETTLE_MS = 1500;

/** The largest zoom change in one step (zoom levels). */
const MAX_STEP = 1;

/** Steps smaller than this are skipped (the map snaps to 0.1 zoom levels anyway). */
const MIN_STEP = 0.1;

/** The fastest train speed (km/h) the importance below is scaled to. */
const MAX_SPEED = 200;

/**
 * Keeps the zoom around the selected, followed train so the map shows a comfortable amount of objects: the
 * "importance" of what's visible (trains and stations count 4, signals 1) plus how slow the train is (a slow train
 * gets a closer view) is kept between the two limits of the autoZoomLimits setting.
 *
 * The zoom is computed towards the middle of the limits in one step (the visible amount grows with the area, so with
 * the square of the scale), instead of nudging it, which used to overshoot the limits and zoom in and out endlessly.
 */
const AutoZoomHandler = () => {
  const map = useMap();
  const [autoZoom] = useSetting("autoZoom");
  const [autoZoomLimits] = useSetting("autoZoomLimits");
  const { selectedTrain } = useContext(SelectedTrainContext);

  const follow = !!selectedTrain?.follow && !selectedTrain.paused;
  const trainNo = selectedTrain?.trainNo;

  useEffect(() => {
    if (!map || !autoZoom || !follow || !trainNo) return;

    let lastZoomEnd = 0;
    const onZoomEnd = () => (lastZoomEnd = performance.now());
    map.on("zoomend", onZoomEnd);

    const check = () => {
      if (isZooming(map) || performance.now() - lastZoomEnd < SETTLE_MS) return;

      const bounds = map.getBounds();
      const trains = dataProvider.trainsData$.value;
      const visibleTrains = trains.filter((train) =>
        bounds.contains([train.TrainData.Latitude, train.TrainData.Longitude]),
      ).length;
      const visibleSignals = dataProvider.signalsData$.value.filter((signal) =>
        bounds.contains([signal.Location.Y, signal.Location.X]),
      ).length;
      const visibleStations = [...dataProvider.stationsData$.value, ...dataProvider.unplayableStations$.value].filter(
        (station) => bounds.contains([station.Latitude, station.Longitude]),
      ).length;

      const speed = trains.find((train) => train.TrainNoLocal === trainNo)?.TrainData.Velocity ?? 0;
      const slowness = MAX_SPEED - Math.min(Math.max(speed, 0), MAX_SPEED);

      // what's on the map grows with the visible area, the slowness doesn't
      const visible = visibleTrains * 4 + visibleStations * 4 + visibleSignals;
      const total = visible + slowness;
      const [low, high] = autoZoomLimits;
      if (total >= low && total <= high) return;

      // the visible amount that puts the total in the middle of the limits
      const wanted = Math.max((low + high) / 2 - slowness, 1);
      // nothing visible: zoom out as far as one step goes
      const step = visible > 0 ? Math.log2(visible / wanted) / 2 : -MAX_STEP;
      const clamped = Math.max(-MAX_STEP, Math.min(MAX_STEP, step));
      if (Math.abs(clamped) < MIN_STEP) return;

      const zoom = Math.min(Math.max(getTargetZoom(map) + clamped, map.getMinZoom()), map.getMaxZoom());
      if (zoom !== map.getZoom()) map.setZoom(zoom);
    };

    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      clearInterval(interval);
      map.off("zoomend", onZoomEnd);
    };
  }, [autoZoom, map, follow, trainNo, autoZoomLimits]);

  return null;
};

export default AutoZoomHandler;
