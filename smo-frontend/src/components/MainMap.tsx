import "leaflet/dist/leaflet.css";

import { useHotkeys, useLocalStorage } from "@mantine/hooks";
import Autocomplete from "@mui/joy/Autocomplete";
import Checkbox from "@mui/joy/Checkbox";
import Sheet from "@mui/joy/Sheet";
import Stack from "@mui/joy/Stack";
import { Map as LeafletMap } from "leaflet";
import { type FunctionComponent, useContext, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer } from "react-leaflet";
import Control from "react-leaflet-custom-control";

import {
  DataCallback,
  offData,
  onData,
  SignalWithTrain,
  Station,
  Train,
} from "../utils/data-manager";
import SelectedRouteContext from "../utils/selected-route-context";
import SelectedTrainContext from "../utils/selected-train-context";
import { getSteamProfileInfo, ProfileResponse } from "../utils/steam";
import ActiveSignalsLayer from "./layers/ActiveSignalsLayer";
import PassiveSignalsLayer from "./layers/PassiveSignalsLayer";
import SelectedTrainRouteLayer from "./layers/SelectedTrainRouteLayer";
import StationsLayer from "./layers/StationsLayer";
import TrainsLayer from "./layers/TrainsLayer";
import UnplayableStationsLayer from "./layers/UnplayableStationsLayer";
import MapTimeDisplay from "./MapTimeDisplay";
import TrainMarkerPopup from "./markers/TrainMarkerPopup";
import ServerSelector from "./ServerSelector";
import ThemeToggle from "./utils/ThemeToggle";

export interface MapProps {
  serverId: string;
}

const LAYERS = [
  { name: "Stations", key: "stations" },
  { name: "Trains", key: "trains" },
  { name: "Active Signals", key: "active-signals" },
  { name: "Passive Signals", key: "passive-signals" },
  { name: "Selected Route", key: "selected-route" },
  { name: "Unplayable Stations", key: "unplayable-stations" },
];

const MainMap: FunctionComponent<MapProps> = () => {
  const [map, setMap] = useState<LeafletMap | null>(null);

  const { selectedTrain, setSelectedTrain } = useContext(SelectedTrainContext);
  const { setSelectedRoute } = useContext(SelectedRouteContext);

  const [time, setTime] = useState(0);
  const [trains, setTrains] = useState<Train[]>([]);
  const [stations, setStations] = useState<Station[]>([]);
  const [signals, setSignals] = useState<SignalWithTrain[]>([]);

  const [visibleLayers, setVisibleLayers] = useLocalStorage<string[]>({
    key: "visibleLayers",
    defaultValue: ["stations", "trains", "active-signals", "selected-route", "unplayable-stations"],
  });

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
    const handler: DataCallback = (data) => {
      setTrains(data.trains || []);
      setStations(data.stations || []);
      setSignals(data.signals || []);
      setTime(data.time);
    };

    onData(handler);

    return () => {
      offData(handler);
    };
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

      {/* Server Select | Search | Time */}
      <Control
        prepend
        position="topleft">
        <Stack
          direction="row"
          spacing={1}>
          <ServerSelector />
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

      {/* Theme Toggle */}
      <Control position="topleft">
        <ThemeToggle />
      </Control>

      {/* Selected Train Popup */}
      <Control position="bottomleft">
        {selectedTrain && selectedTrainData && (
          <Sheet
            variant="outlined"
            sx={{
              p: 2,
              borderRadius: "var(--joy-radius-sm)",
            }}>
            <TrainMarkerPopup
              train={selectedTrainData}
              userData={selectedTrainUserData}
              showTrainRouteButton
            />
          </Sheet>
        )}
      </Control>

      {/* Layers */}
      <Control position="topright">
        <Sheet
          variant="outlined"
          sx={{
            p: 1,
            borderRadius: "var(--joy-radius-sm)",
          }}>
          <Stack spacing={1}>
            {LAYERS.map((layer) => (
              <Checkbox
                key={layer.key}
                checked={visibleLayers.includes(layer.key)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setVisibleLayers([...visibleLayers, layer.key]);
                  } else {
                    setVisibleLayers(visibleLayers.filter((l) => l !== layer.key));
                  }
                }}
                label={layer.name}
                size="sm"
              />
            ))}
          </Stack>
        </Sheet>
      </Control>

      {visibleLayers.includes("stations") && <StationsLayer stations={stations} />}

      {visibleLayers.includes("trains") && <TrainsLayer trains={trains} />}

      {visibleLayers.includes("active-signals") && <ActiveSignalsLayer signals={signals} />}

      {visibleLayers.includes("passive-signals") && <PassiveSignalsLayer signals={signals} />}

      {visibleLayers.includes("selected-route") && <SelectedTrainRouteLayer />}

      {visibleLayers.includes("unplayable-stations") && <UnplayableStationsLayer />}
    </MapContainer>
  );
};

export default MainMap;
