import "leaflet/dist/leaflet.css";

import { useHotkeys, useLocalStorage } from "@mantine/hooks";
import Autocomplete from "@mui/joy/Autocomplete";
import Option from "@mui/joy/Option";
import Select from "@mui/joy/Select";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import { LeafletEventHandlerFn, Map as LeafletMap } from "leaflet";
import {
  type FunctionComponent,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { LayerGroup, LayersControl, MapContainer, TileLayer } from "react-leaflet";
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
import { getSteamProfileInfo, ProfileResponse } from "../utils/steam";
import SelectedTrainRouteLayer from "./layers/SelectedTrainRouteLayer";
import MapTimeDisplay from "./MapTimeDisplay";
import SignalMarker from "./markers/SignalMarker";
import StationMarker from "./markers/StationMarker";
import TrainMarker from "./markers/TrainMarker";
import TrainMarkerPopup from "./markers/TrainMarkerPopup";
import UnplayableStation from "./markers/UnplayableStation";
import ThemeToggle from "./ThemeToggle";

export interface MapProps {
  serverId: string;
}

function getVisibleTrains(trains: Train[], map: LeafletMap | null) {
  const bounds = map?.getBounds();
  return trains.filter((train) =>
    bounds?.contains([train.TrainData.Latititute, train.TrainData.Longitute])
  );
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
  const { selectedRoute, setSelectedRoute } = useContext(SelectedRouteContext);

  const [servers, setServers] = useState<ServerStatus[]>(getServerStatus());
  const [time, setTime] = useState(0);
  const [trains, setTrains] = useState<Train[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [signals, setSignals] = useState<SignalWithTrain[]>([]);

  const [visibleTrains, setVisibleTrains] = useState<Train[]>([]);
  const [visibleSignals, setVisibleSignals] = useState<SignalWithTrain[]>([]);

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
      setServers(getServerStatus());
      setSignals(data.signals);
      setTime(data.time);
    });
  }, []);

  useEffect(() => {
    if (selectedTrain?.follow) {
      const train = trains.find((train) => train.TrainNoLocal === selectedTrain.trainNo);
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
  }, [map, selectedRoute, signals, trains]);

  useEffect(() => {
    setVisibleSignals(getVisibleSignals(signals || [], map));
  }, [map, signals]);

  useEffect(() => {
    setVisibleTrains(getVisibleTrains(trains || [], map));
  }, [map, trains]);

  const [selectedTrainUserData, setSelectedTrainUserData] = useState<ProfileResponse | null>(null);

  const selectedTrainData = useMemo(() => {
    if (!selectedTrain) return null;

    const train = trains.find((train) => train.TrainNoLocal === selectedTrain.trainNo);
    if (!train) return null;

    if (!train.TrainData.ControlledBySteamID) {
      setSelectedTrainUserData(null);
      return train;
    }

    getSteamProfileInfo(train.TrainData.ControlledBySteamID).then((profile) => {
      setSelectedTrainUserData(profile);
    });

    return train;
  }, [selectedTrain, trains]);

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
        <Stack
          direction="row"
          spacing={1}>
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
          <Autocomplete
            placeholder="Search"
            options={trains}
            getOptionLabel={(option) => `${option.TrainNoLocal} (${option.TrainName})`}
            value={selectedTrainData}
            onChange={(_e, v) =>
              setSelectedTrain(v?.TrainNoLocal ? { trainNo: v.TrainNoLocal, follow: true } : null)
            }
          />
          {!!time && <MapTimeDisplay time={time} />}
        </Stack>
      </Control>

      <Control position="topleft">
        <ThemeToggle />
      </Control>

      <Control position="bottomleft">
        {selectedTrain && selectedTrainData && (
          <Sheet
            sx={{
              p: 2,
              borderRadius: 10,
            }}
            variant="outlined">
            <TrainMarkerPopup
              train={selectedTrainData}
              userData={selectedTrainUserData}
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
          <SelectedTrainRouteLayer />
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
