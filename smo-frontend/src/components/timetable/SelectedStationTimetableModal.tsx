import L from "leaflet";
import { FunctionComponent, useContext, useEffect, useRef } from "react";
import { useMap } from "react-leaflet";

import useBehaviorSubj from "../../hooks/useBehaviorSubj";
import useStationTimetableEntries from "../../hooks/useStationTimetableEntries";
import { dataProvider } from "../../utils/data-manager";
import { getStationGeometry } from "../../utils/geom-utils";
import SelectedStationTimetableContext from "../../utils/selected-station-timetable-context";
import StationTimetableModal from "./StationTimetableModal";

const STATION_HASH_PREFIX = "station:";

const SelectedStationTimetableModal: FunctionComponent = () => {
  const map = useMap();
  const stations = useBehaviorSubj(dataProvider.stationsData$);
  const { selectedStationTimetable, setSelectedStationTimetable } = useContext(SelectedStationTimetableContext);
  const { stationTimetable } = useStationTimetableEntries(selectedStationTimetable || "");
  const isStationHash = globalThis.location.hash.slice(1).startsWith(STATION_HASH_PREFIX);
  const shouldCollapsedRef = useRef(isStationHash);
  const shouldFocusRef = useRef(isStationHash);

  useEffect(() => {
    if (!selectedStationTimetable || !shouldFocusRef.current) {
      return;
    }

    const station = stations.find((x) => x.Name === selectedStationTimetable);
    if (!station) {
      if (stations.length > 0) {
        shouldFocusRef.current = false;
      }
      return;
    }

    const stationArea = getStationGeometry(station);
    if (stationArea.length >= 3) {
      map.fitBounds(L.latLngBounds(stationArea), {
        animate: true,
        duration: 1,
        padding: [40, 40],
      });
    } else {
      map.flyTo([station.Latitude, station.Longitude], 14, { animate: true, duration: 1 });
    }

    shouldFocusRef.current = false;
  }, [map, selectedStationTimetable, stations]);

  useEffect(() => {
    if (!selectedStationTimetable || !shouldCollapsedRef.current) {
      return;
    }

    shouldCollapsedRef.current = false;
  }, [selectedStationTimetable]);

  return (
    <StationTimetableModal
      open={!!selectedStationTimetable}
      onClose={() => setSelectedStationTimetable(null)}
      stationName={selectedStationTimetable || ""}
      stationTimetable={stationTimetable}
      startCollapsed={shouldCollapsedRef.current}
    />
  );
};

export default SelectedStationTimetableModal;
