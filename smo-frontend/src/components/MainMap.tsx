import "leaflet/dist/leaflet.css";

import { useHotkeys, useLocalStorage } from "@mantine/hooks";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import { DivIcon, LeafletEventHandlerFn, Map as LeafletMap } from "leaflet";
import { type FunctionComponent, useCallback, useContext, useEffect, useState } from "react";
import { LayerGroup, LayersControl, MapContainer, Marker, TileLayer } from "react-leaflet";
import Control from "react-leaflet-custom-control";

import UnplayableStations from "../assets/unplayable-stations.json";
import {
  getServerStatus,
  onData,
  selectServer,
  ServerStatus,
  SignalWithTrain,
  Station,
  Train,
} from "../utils/data-manager";
import { debounce } from "../utils/debounce";
import SelectedRouteContext from "../utils/selected-route-context";
import SelectedTrainContext from "../utils/selected-train-context";
import DotIcon from "./dot.svg?raw";
import SignalMarker from "./markers/SignalMarker";
import StationMarker from "./markers/StationMarker";
import TrainMarker from "./markers/TrainMarker";
import TrainMarkerPopup from "./markers/TrainMarkerPopup";
import UnplayableStation from "./markers/UnplayableStation";

export interface MapProps {
  serverId: string;
}

const SELECTED_ROUTE_ICON = new DivIcon({
  html: DotIcon,
  iconSize: [10, 10],
  className: "icon selected-route",
});

function getVisibleTrains(trains: Train[], map: LeafletMap | null) {
  const bounds = map?.getBounds();
  return trains.filter((train) =>
    bounds?.contains([train.TrainData.Latititute, train.TrainData.Longitute])
  );
}

function getVisibleTrainRoutePoints(route: [number, number][], map: LeafletMap | null) {
  const bounds = map?.getBounds();
  return route.filter((point) => bounds?.contains(point));
}

function getVisibleSignals(signals: SignalWithTrain[], map: LeafletMap | null) {
  const mapBounds = map?.getBounds();
  return signals.filter((signal) => mapBounds?.contains([signal.lat, signal.lon]));
}

const MainMap: FunctionComponent<MapProps> = () => {
  const [map, setMap] = useState<LeafletMap | null>(null);

  const [selectedServer, setSelectedServer] = useLocalStorage({
    key: "selectedServer",
    defaultValue: "en1",
  });
  const { selectedTrain, setSelectedTrain } = useContext(SelectedTrainContext);
  const [servers, setServers] = useState<ServerStatus[]>(getServerStatus());
  const [trains, setTrains] = useState<Train[]>([]);
  const [visibleTrains, setVisibleTrains] = useState<Train[]>([]);
  const [trainRoutes, setTrainRoutes] = useState<Record<string, [number, number][]>>({});
  const [stations, setStations] = useState<Station[]>([]);
  const [signals, setSignals] = useState<SignalWithTrain[]>([]);
  const [visibleSignals, setVisibleSignals] = useState<SignalWithTrain[]>([]);
  const [visibleSelectedTrainRoutePoints, setVisibleSelectedTrainRoutePoints] = useState<
    [number, number][] | null
  >(null);
  const { selectedRoute, setSelectedRoute } = useContext(SelectedRouteContext);

  useHotkeys([
    [
      "Escape",
      () => {
        setSelectedRoute(null);
        setSelectedTrain(null);
      },
    ],
  ]);

  useEffect(() => {
    onData((data) => {
      setTrains(data.trains);
      setStations(data.stations);
      setTrainRoutes(
        (trainRoutes) =>
          data.trainRoutes?.reduce<Record<string, [number, number][]>>((acc, route) => {
            acc[route.route] = route.points;
            return acc;
          }, {}) || trainRoutes
      );
      setServers(getServerStatus());
      setSignals(data.signals);
    });
  }, []);

  useEffect(() => {
    if (selectedTrain) {
      const train = trains.find((train) => train.TrainNoLocal === selectedTrain);
      if (train) {
        map?.panTo([train.TrainData.Latititute, train.TrainData.Longitute], {
          animate: true,
          duration: 1,
        });
      }
    }
  }, [map, selectedTrain, trains]);

  const handleServerChange = useCallback(
    (serverCode: string) => {
      setSelectedTrain(null);
      setSelectedRoute(null);
      setSelectedServer(serverCode);
      selectServer(serverCode);
    },
    [setSelectedRoute, setSelectedServer, setSelectedTrain]
  );

  useEffect(() => {
    const handler: LeafletEventHandlerFn = (e) => {
      setVisibleTrains(getVisibleTrains(trains || [], e.target));
      setVisibleSignals(getVisibleSignals(signals || [], e.target));
      if (selectedRoute) {
        setVisibleSelectedTrainRoutePoints(
          getVisibleTrainRoutePoints(trainRoutes[selectedRoute] || [], e.target)
        );
      }
    };

    const debounceHandler = debounce(handler, 200);

    if (!map) return;

    const _map = map;

    _map.on("move", debounceHandler);
    _map.on("zoom", debounceHandler);
    _map.on("resize", debounceHandler);

    return () => {
      _map.off("move", debounceHandler);
      _map.off("zoom", debounceHandler);
      _map.off("resize", debounceHandler);
    };
  }, [map, selectedRoute, signals, trainRoutes, trains]);

  useEffect(() => {
    setVisibleSignals(getVisibleSignals(signals || [], map));
  }, [map, signals]);

  useEffect(() => {
    setVisibleTrains(getVisibleTrains(trains || [], map));
  }, [map, trains]);

  useEffect(() => {
    if (selectedRoute) {
      setVisibleSelectedTrainRoutePoints(
        getVisibleTrainRoutePoints(trainRoutes[selectedRoute] || [], map)
      );
    } else {
      setVisibleSelectedTrainRoutePoints(null);
    }
  }, [map, selectedRoute, trainRoutes]);

  const selectedTrainData = trains.find((train) => train.TrainNoLocal === selectedTrain);

  return (
    <MapContainer
      ref={setMap}
      center={[51.015482, 19.572143]}
      zoom={8}
      scrollWheelZoom={true}
      style={{ height: "100vh", width: "100vw" }}>
      <TileLayer
        attribution='&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <Control
        prepend
        position="topleft">
        <Select
          value={selectedServer}
          onChange={(_e, v) => handleServerChange(v!)}>
          {servers.map((server) => (
            <Option
              key={server.id}
              value={server.ServerCode}>
              {server.ServerName}
            </Option>
          ))}
        </Select>
      </Control>

      <Control position="bottomleft">
        {selectedTrain && selectedTrainData && (
          <Sheet
            sx={{
              p: 1,
              borderRadius: 10,
            }}
            variant="outlined">
            <TrainMarkerPopup
              train={selectedTrainData}
              showTrainRouteButton
            />
          </Sheet>
        )}
      </Control>

      <LayersControl position="topright">
        <LayersControl.Overlay
          name="Stations"
          checked>
          <LayerGroup>
            {stations?.map((stationIcon) => (
              <StationMarker
                key={stationIcon.id}
                station={stationIcon}
              />
            ))}
          </LayerGroup>
        </LayersControl.Overlay>
        <LayersControl.Overlay
          name="Trains"
          checked>
          <LayerGroup>
            {visibleTrains.map((train) => (
              <TrainMarker
                key={train.id}
                train={train}
              />
            ))}
          </LayerGroup>
        </LayersControl.Overlay>
        <LayersControl.Overlay
          name="Signals"
          checked>
          <LayerGroup>
            {visibleSignals.map((signal) => (
              <SignalMarker
                key={signal.name}
                signal={signal}
              />
            ))}
          </LayerGroup>
        </LayersControl.Overlay>
        <LayersControl.Overlay
          name="Selected Route"
          checked>
          <LayerGroup>
            {/* {visibleSelectedTrainRoutePoints && (
              <Polyline
                positions={visibleSelectedTrainRoutePoints}
                color="red"
                weight={2}
              />
            )} */}
            {visibleSelectedTrainRoutePoints?.map((point) => (
              <Marker
                key={point[0] + "-" + point[1]}
                position={point}
                icon={SELECTED_ROUTE_ICON}
              />
            ))}
          </LayerGroup>
        </LayersControl.Overlay>
        <LayersControl.Overlay
          name="Unplayable Stations"
          checked>
          <LayerGroup>
            {UnplayableStations.map((station) => (
              <UnplayableStation
                key={station.Name}
                station={station as unknown as Station}
              />
            ))}
          </LayerGroup>
        </LayersControl.Overlay>
      </LayersControl>
    </MapContainer>
  );
};

export default MainMap;
